import type {
  ProviderCreateResult,
  VideoModelRecord,
  VideoProviderAdapter,
} from "@/lib/video/service";
import type { TaskStatusResult } from "@/lib/video/types";
import { delayStaggeredSubmission } from "@/lib/tasks/batch-queue";
import { uploadSharedVideo } from "@/lib/storage/gateway";
import {
  extractNfvidFailReason,
  extractNfvidStatus,
  extractNfvidTaskId,
  extractNfvidVideoUrl,
  inferNfvidCapabilities,
  NFVID_ACTIVE_STATES,
  NFVID_DEFAULT_BASE_URL,
  NFVID_FAILURE_STATES,
  NFVID_SUCCESS_STATES,
  NFVID_VIDEOS_ENDPOINT,
  nfvidUsesGrokForm,
  normalizeNfvidBaseUrl,
  normalizeNfvidProgress,
  type NfvidCreateResponse,
  type NfvidStatusResponse,
} from "./nfvid-utils";
import {
  classifyVideoProviderFailure,
  extractProviderErrorMessage,
  isRetryableOverload,
} from "./shared";

function getBaseUrl(model: VideoModelRecord): string {
  return normalizeNfvidBaseUrl(
    model.baseUrl ||
    process.env.NFVID_BASE_URL ||
    process.env.VIDEO_BASE_URL ||
    NFVID_DEFAULT_BASE_URL,
  );
}

function getApiKey(model: VideoModelRecord): string {
  return (
    model.apiKey ||
    process.env.NFVID_API_KEY ||
    process.env.VIDEO_API_KEY ||
    ""
  ).trim();
}

/**
 * Marker error: response was a definitive HTTP failure (e.g. 400/401/403/404)
 * that should NOT be retried. Without this marker the outer catch would treat
 * it like a transient network failure and burn 9s on pointless retries.
 */
class NfvidNonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NfvidNonRetryableError";
  }
}

/**
 * JSON-only API request, used by the sora2 family + status polling + queryTaskStatus.
 * Grok-imagine-family uses a separate multipart POST helper (see createViaGrokForm).
 */
async function apiRequest<T>(params: {
  model: VideoModelRecord;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  timeoutMs?: number;
}): Promise<T> {
  const apiKey = getApiKey(params.model);
  if (!apiKey) {
    throw new Error("NFVID_API_KEY is not set");
  }

  const url = `${getBaseUrl(params.model)}${params.path}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: params.method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: params.body ? JSON.stringify(params.body) : undefined,
        signal: AbortSignal.timeout(params.timeoutMs ?? 120_000),
      });

      const text = await response.text();
      let payload: unknown = {};
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = { raw: text.slice(0, 500) };
        }
      }

      if (!response.ok) {
        const message = extractProviderErrorMessage(payload);
        if (attempt < 2 && isRetryableOverload(response.status, message)) {
          await new Promise((resolve) => setTimeout(resolve, 15_000 * (attempt + 1)));
          continue;
        }
        throw new NfvidNonRetryableError(`HTTP ${response.status}: ${message}`);
      }

      return payload as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (error instanceof NfvidNonRetryableError) throw error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 3_000 * (attempt + 1)));
        continue;
      }
    }
  }

  throw lastError ?? new Error("NFVid video provider request failed");
}

async function rehostTaskContent(params: {
  model: VideoModelRecord;
  taskId: string;
}): Promise<string | undefined> {
  const apiKey = getApiKey(params.model);
  const url = `${getBaseUrl(params.model)}${NFVID_VIDEOS_ENDPOINT}/${encodeURIComponent(params.taskId)}/content`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(180_000),
    });
    if (!response.ok) return undefined;

    const buffer = await response.arrayBuffer();
    const stored = await uploadSharedVideo({
      bucket: "nfvid",
      filename: `${params.taskId}.mp4`,
      data: buffer,
      contentType: response.headers.get("content-type") ?? "video/mp4",
    });
    return stored.url;
  } catch {
    return undefined;
  }
}

/**
 * 推断 grok-imagine-frames 的 size 参数 —— 上游接受固定 5 种像素值。
 * - portrait → 720x1280（默认） 或 1024x1792
 * - landscape → 1280x720 或 1792x1024
 * - square → 1024x1024
 *
 * default_params.size 优先于自动推断；providerOptions.size 又优先于 default_params.size。
 */
function pickGrokFormSize(
  orientation: "portrait" | "landscape",
  providerOptions: Record<string, unknown>,
): string {
  if (typeof providerOptions.size === "string" && providerOptions.size) {
    return providerOptions.size;
  }
  return orientation === "portrait" ? "720x1280" : "1280x720";
}

/**
 * Grok Imagine Frames 路径：multipart/form-data 异步提交。
 *
 * 关键 spec（来自 nfvid 官方）：
 * - POST /v1/videos  Content-Type: multipart/form-data
 * - seconds 必须是字符串（"6"/"10"/"12"/"16"/"20"）
 * - input_reference[] 是 **二进制文件**（fetch 图片再以 Blob 上传，URL 不行）
 *
 * 投递后返回 task_id；之后走跟 sora2 同一条 GET /v1/videos/{id} 轮询路径。
 */
async function createViaGrokForm(params: {
  model: VideoModelRecord;
  prompt: string;
  imageUrls: string[];
  durationSeconds: number;
  orientation: "portrait" | "landscape";
  count: number;
  providerOptions: Record<string, unknown>;
}): Promise<ProviderCreateResult> {
  const apiKey = getApiKey(params.model);
  if (!apiKey) throw new Error("NFVID_API_KEY is not set");

  const baseUrl = getBaseUrl(params.model);
  const taskIds: string[] = [];

  const size = pickGrokFormSize(params.orientation, params.providerOptions);
  const resolutionName =
    typeof params.providerOptions.resolution_name === "string"
      ? params.providerOptions.resolution_name
      : "720p";
  const preset =
    typeof params.providerOptions.preset === "string"
      ? params.providerOptions.preset
      : "normal";

  for (let index = 0; index < params.count; index += 1) {
    await delayStaggeredSubmission(index);
    const imageUrl = params.imageUrls[index] ?? params.imageUrls[0];
    if (!imageUrl) {
      throw new Error("grok-imagine-video-frames requires at least one reference image");
    }

    // Fetch the image bytes — nfvid's multipart endpoint only accepts file
    // uploads, not URLs. The image URL is either user-uploaded R2 or an
    // image-prep output, both fetchable without auth.
    const imgRes = await fetch(imageUrl, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!imgRes.ok) {
      throw new Error(
        `Failed to fetch reference image ${imageUrl}: HTTP ${imgRes.status}`,
      );
    }
    const imgBuf = await imgRes.arrayBuffer();
    const imgContentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const imgExt = imgContentType.includes("png") ? "png" : "jpg";

    const form = new FormData();
    form.append("model", params.model.slug);
    form.append("prompt", params.prompt);
    form.append("seconds", String(params.durationSeconds));   // upstream wants string
    form.append("size", size);
    form.append("resolution_name", resolutionName);
    form.append("preset", preset);
    form.append(
      "input_reference[]",
      new Blob([imgBuf], { type: imgContentType }),
      `ref-${index}.${imgExt}`,
    );

    const submitUrl = `${baseUrl}${NFVID_VIDEOS_ENDPOINT}`;
    const response = await fetch(submitUrl, {
      method: "POST",
      // Do NOT set Content-Type — fetch sets the multipart boundary automatically.
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    });

    const text = await response.text();
    let payload: unknown = {};
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text.slice(0, 500) };
      }
    }

    if (!response.ok) {
      const message = extractProviderErrorMessage(payload);
      throw new NfvidNonRetryableError(`HTTP ${response.status}: ${message}`);
    }

    const taskId = extractNfvidTaskId(payload as NfvidCreateResponse);
    if (!taskId) {
      throw new Error(
        `NFVid grok-form task creation returned no task_id: ${JSON.stringify(payload).slice(0, 200)}`,
      );
    }
    taskIds.push(taskId);
  }

  // Async — runner will poll via the existing queryTaskStatus.
  return { providerTaskIds: taskIds };
}

export const nfvidProvider: VideoProviderAdapter = {
  id: "nfvid",
  // Grok-imagine fidelity is best with the original image, but image-prep on
  // server side typically just resizes/normalizes — fine. Leave default true.

  getCapabilities(model) {
    return inferNfvidCapabilities(model);
  },

  async createTasks({ model, params }) {
    const providerOptions = (params.providerOptions ?? {}) as Record<string, unknown>;

    // Dispatch on slug: Grok Imagine Frames family uses multipart /v1/videos;
    // sora2 family uses JSON /v1/videos. Same endpoint, different content-type.
    if (nfvidUsesGrokForm(model.slug)) {
      return createViaGrokForm({
        model,
        prompt: params.prompt,
        imageUrls: params.imageUrls ?? [],
        durationSeconds: params.duration,
        orientation: params.orientation,
        count: params.count,
        providerOptions,
      });
    }

    const group = typeof providerOptions.group === "string" ? providerOptions.group : "vip";
    const stream = typeof providerOptions.stream === "boolean" ? providerOptions.stream : false;
    const taskIds: string[] = [];

    for (let index = 0; index < params.count; index += 1) {
      await delayStaggeredSubmission(index);
      const imageUrl = params.imageUrls?.[index] ?? params.imageUrls?.[0];
      const content: unknown[] = [{ type: "text", text: params.prompt }];
      if (imageUrl) {
        content.push({ type: "image_url", image_url: { url: imageUrl } });
      }

      const payload = {
        ...providerOptions,
        model: model.slug,
        group,
        stream,
        prompt: params.prompt,
        messages: [{ role: "user", content }],
      };

      const result = await apiRequest<NfvidCreateResponse>({
        model,
        method: "POST",
        path: NFVID_VIDEOS_ENDPOINT,
        body: payload,
      });
      const taskId = extractNfvidTaskId(result);
      if (!taskId) {
        throw new Error(`NFVid task creation failed: ${JSON.stringify(result).slice(0, 200)}`);
      }
      taskIds.push(taskId);
    }

    return { providerTaskIds: taskIds };
  },

  async queryTaskStatus({ model, taskId }): Promise<TaskStatusResult> {
    let result: NfvidStatusResponse;
    try {
      result = await apiRequest<NfvidStatusResponse>({
        model,
        method: "GET",
        path: `${NFVID_VIDEOS_ENDPOINT}/${encodeURIComponent(taskId)}`,
        timeoutMs: 60_000,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        /HTTP\s+400/i.test(message) &&
        /task[_\s-]?not[_\s-]?(exist|found)/i.test(message)
      ) {
        return {
          taskId,
          status: "FAILED",
          progress: "0%",
          failReason:
            "上游任务记录已丢失（task_not_exist）—— 通常是 nfvid → 上游链路里 GPU 任务超时被丢弃，自动退款",
          retryable: false,
          terminalClass: "provider_error",
        };
      }
      throw error;
    }

    const status = extractNfvidStatus(result);
    const progress = normalizeNfvidProgress(result.progress ?? result.data?.progress);

    if (NFVID_SUCCESS_STATES.has(status)) {
      const directUrl = extractNfvidVideoUrl(result);
      const rehostedUrl = await rehostTaskContent({ model, taskId });
      return {
        taskId,
        status: "SUCCESS",
        progress: "100%",
        url: rehostedUrl ?? directUrl ?? `${getBaseUrl(model)}${NFVID_VIDEOS_ENDPOINT}/${encodeURIComponent(taskId)}/content`,
      };
    }

    if (NFVID_FAILURE_STATES.has(status)) {
      const failReason = extractNfvidFailReason(result);
      const { retryable, terminalClass } = classifyVideoProviderFailure(failReason);
      return {
        taskId,
        status: "FAILED",
        progress,
        failReason,
        retryable,
        terminalClass,
      };
    }

    if (NFVID_ACTIVE_STATES.has(status)) {
      return { taskId, status, progress };
    }

    return { taskId, status, progress };
  },
};

export { normalizeNfvidBaseUrl };
