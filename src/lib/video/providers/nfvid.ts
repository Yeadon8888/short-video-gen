import type {
  ProviderCreateResult,
  VideoModelRecord,
  VideoProviderAdapter,
} from "@/lib/video/service";
import type { TaskStatusResult } from "@/lib/video/types";
import { delayStaggeredSubmission } from "@/lib/tasks/batch-queue";
import { isUploadGatewayEnabled, uploadSharedVideo } from "@/lib/storage/gateway";
import {
  extractNfvidFailReason,
  extractNfvidStatus,
  extractNfvidTaskId,
  extractNfvidVideoUrl,
  inferNfvidCapabilities,
  NFVID_ACTIVE_STATES,
  NFVID_CHAT_ENDPOINT,
  NFVID_DEFAULT_BASE_URL,
  NFVID_FAILURE_STATES,
  NFVID_SUCCESS_STATES,
  NFVID_VIDEOS_ENDPOINT,
  nfvidUsesSyncChat,
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
      // Definitively non-retryable response error — bail out, do not waste
      // retry budget on the same 400/401/403 etc.
      if (error instanceof NfvidNonRetryableError) {
        throw error;
      }
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
 * 同步路径下 chat-completions 直接返回视频 URL，把它镜像到 R2 让 URL 持久化、
 * 不依赖 nfvid CDN 长期可用性。URL 本身公网可下，无需 Bearer（已验证）。
 */
async function rehostSyncChatUrl(params: {
  upstreamUrl: string;
  fallbackName: string;
}): Promise<string> {
  if (!isUploadGatewayEnabled()) return params.upstreamUrl;
  try {
    const fileRes = await fetch(params.upstreamUrl, {
      signal: AbortSignal.timeout(180_000),
    });
    if (!fileRes.ok) return params.upstreamUrl;
    const buffer = await fileRes.arrayBuffer();
    const stored = await uploadSharedVideo({
      bucket: "nfvid",
      filename: `${params.fallbackName}.mp4`,
      data: buffer,
      contentType: fileRes.headers.get("content-type") ?? "video/mp4",
    });
    return stored.url;
  } catch {
    return params.upstreamUrl;
  }
}

/**
 * Synchronous chat-completions path —— 用于 nfvid 上的 Grok-lineage 模型
 * （比如 grok-imagine-video-frames）。
 *
 * 行为跟 grok2api Railway 代理的 chat-completions 一致：阻塞 ~55s，视频 URL
 * 出现在 choices[0].message.content。createTasks 必须自带 immediateResults
 * 标记 SUCCESS，让 runner 跳过轮询。
 */
async function createViaSyncChat(params: {
  model: VideoModelRecord;
  prompt: string;
  imageUrls: string[];
  count: number;
  providerOptions: Record<string, unknown>;
}): Promise<ProviderCreateResult> {
  const taskIds: string[] = [];
  const immediateResults: TaskStatusResult[] = [];

  for (let index = 0; index < params.count; index += 1) {
    await delayStaggeredSubmission(index);
    const imageUrl = params.imageUrls[index] ?? params.imageUrls[0];
    const content: unknown[] = [{ type: "text", text: params.prompt }];
    if (imageUrl) {
      content.push({ type: "image_url", image_url: { url: imageUrl } });
    }

    const payload = {
      ...params.providerOptions,
      model: params.model.slug,
      stream: false,
      messages: [{ role: "user", content }],
    };

    const result = await apiRequest<{
      id?: string;
      choices?: Array<{ message?: { content?: string } }>;
    }>({
      model: params.model,
      method: "POST",
      path: NFVID_CHAT_ENDPOINT,
      body: payload,
      timeoutMs: 240_000,
    });

    const url = result?.choices?.[0]?.message?.content?.trim();
    if (!url || !/^https?:\/\//.test(url)) {
      throw new Error(
        `NFVid sync chat returned no video URL: ${JSON.stringify(result).slice(0, 300)}`,
      );
    }
    const chatId = result.id ?? `nfvid-chat-${Date.now()}-${index}`;

    const finalUrl = await rehostSyncChatUrl({
      upstreamUrl: url,
      fallbackName: `${chatId}`,
    });

    taskIds.push(chatId);
    immediateResults.push({
      taskId: chatId,
      status: "SUCCESS",
      progress: "100%",
      url: finalUrl,
    });
  }

  return { providerTaskIds: taskIds, immediateResults };
}

export const nfvidProvider: VideoProviderAdapter = {
  id: "nfvid",

  getCapabilities(model) {
    return inferNfvidCapabilities(model);
  },

  async createTasks({ model, params }) {
    const providerOptions = params.providerOptions ?? {};

    // Dispatch on slug: Grok-lineage models on nfvid use synchronous
    // chat-completions; everything else uses async /v1/videos.
    if (nfvidUsesSyncChat(model.slug)) {
      return createViaSyncChat({
        model,
        prompt: params.prompt,
        imageUrls: params.imageUrls ?? [],
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
      // 上游偶尔会"丢任务"——nfvid → OpenAI Sora 链路里，超时未交付的任务会被
      // 上游清理。后续 GET /v1/videos/{id} 返回 HTTP 400 {"code":"task_not_exist"}。
      // 这是终态：上游已无记录、无法重试。直接报 FAILED 让 runner 退款。
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
            "上游任务记录已丢失（task_not_exist）—— 通常是 nfvid → OpenAI Sora 链路里 GPU 任务超时被丢弃，自动退款",
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
