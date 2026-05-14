import type {
  VideoModelRecord,
  VideoProviderAdapter,
} from "@/lib/video/service";
import type { TaskStatusResult } from "@/lib/video/types";
import { delayStaggeredSubmission } from "@/lib/tasks/batch-queue";
import { isUploadGatewayEnabled, uploadSharedVideo } from "@/lib/storage/gateway";
import {
  extractVolc302FailReason,
  extractVolc302TaskId,
  extractVolc302VideoUrl,
  inferVolc302Capabilities,
  normalizeVolc302BaseUrl,
  normalizeVolc302Progress,
  normalizeVolc302Status,
  VOLC302_ACTIVE_STATES,
  VOLC302_DEFAULT_BASE_URL,
  VOLC302_FAILURE_STATES,
  VOLC302_SUCCESS_STATES,
  VOLC302_TASKS_ENDPOINT,
  type Volc302CreateResponse,
  type Volc302StatusResponse,
} from "./volc302-utils";
import {
  classifyVideoProviderFailure,
  extractProviderErrorMessage,
  isRetryableOverload,
} from "./shared";

class Volc302NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Volc302NonRetryableError";
  }
}

function getBaseUrl(model: VideoModelRecord): string {
  return normalizeVolc302BaseUrl(model.baseUrl || VOLC302_DEFAULT_BASE_URL);
}

function getApiKey(model: VideoModelRecord): string {
  return (model.apiKey || process.env.VOLC302_API_KEY || "").trim();
}

async function apiRequest<T>(params: {
  model: VideoModelRecord;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  timeoutMs?: number;
}): Promise<T> {
  const apiKey = getApiKey(params.model);
  if (!apiKey) throw new Error("VOLC302_API_KEY is not set");

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
        signal: AbortSignal.timeout(params.timeoutMs ?? 60_000),
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
        throw new Volc302NonRetryableError(`HTTP ${response.status}: ${message}`);
      }

      return payload as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (error instanceof Volc302NonRetryableError) throw error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 3_000 * (attempt + 1)));
        continue;
      }
    }
  }

  throw lastError ?? new Error("302 Volcengine video provider request failed");
}

/**
 * 把 Volcengine TOS 预签名 URL 拉下来 rehost 到 R2。
 * TOS URL 默认 24h 过期 (X-Tos-Expires=86400)，不 rehost 第二天就 404。
 * 实测 HEAD 在 TOS 上是 403（签名头限制），但 GET 完美，所以这里只用 GET。
 */
async function rehostToR2(params: {
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
      bucket: "volc302",
      filename: `${params.fallbackName}.mp4`,
      data: buffer,
      contentType: fileRes.headers.get("content-type") ?? "video/mp4",
    });
    return stored.url;
  } catch {
    return params.upstreamUrl;
  }
}

function ratioFromOrientation(orientation: "portrait" | "landscape"): string {
  return orientation === "portrait" ? "9:16" : "16:9";
}

export const volc302Provider: VideoProviderAdapter = {
  id: "volc302",

  getCapabilities(model) {
    return inferVolc302Capabilities(model);
  },

  async createTasks({ model, params }) {
    const providerOptions = (params.providerOptions ?? {}) as Record<string, unknown>;
    const taskIds: string[] = [];

    const ratio =
      typeof providerOptions.ratio === "string"
        ? providerOptions.ratio
        : ratioFromOrientation(params.orientation);
    const generateAudio =
      typeof providerOptions.generate_audio === "boolean"
        ? providerOptions.generate_audio
        : true;
    const watermark =
      typeof providerOptions.watermark === "boolean"
        ? providerOptions.watermark
        : false;

    // 允许 default_params.upstream_model 把 DB slug 重映射到上游真实 model 名。
    // 比如 DB 里 slug='doubao-seedance-2-0-fast-260128-302' 保证唯一，
    // 但上游 302.ai 认的是 'doubao-seedance-2-0-fast-260128'。
    const upstreamModel =
      (typeof providerOptions.upstream_model === "string" && providerOptions.upstream_model) ||
      model.slug;

    for (let index = 0; index < params.count; index += 1) {
      await delayStaggeredSubmission(index);
      const imageUrl = params.imageUrls?.[index] ?? params.imageUrls?.[0];
      const content: unknown[] = [{ type: "text", text: params.prompt }];
      if (imageUrl) {
        content.push({ type: "image_url", image_url: { url: imageUrl } });
      }

      const payload: Record<string, unknown> = {
        ...providerOptions,
        model: upstreamModel,
        content,
        ratio,
        duration: params.duration,
        generate_audio: generateAudio,
        watermark,
      };
      // upstream_model is an internal mapping field — strip from payload so
      // we don't send it to the upstream.
      delete payload.upstream_model;

      const result = await apiRequest<Volc302CreateResponse>({
        model,
        method: "POST",
        path: VOLC302_TASKS_ENDPOINT,
        body: payload,
      });
      const taskId = extractVolc302TaskId(result);
      if (!taskId) {
        throw new Error(
          `Volc302 task creation failed: ${JSON.stringify(result).slice(0, 200)}`,
        );
      }
      taskIds.push(taskId);
    }

    return { providerTaskIds: taskIds };
  },

  async queryTaskStatus({ model, taskId }): Promise<TaskStatusResult> {
    let result: Volc302StatusResponse;
    try {
      result = await apiRequest<Volc302StatusResponse>({
        model,
        method: "GET",
        path: `${VOLC302_TASKS_ENDPOINT}/${encodeURIComponent(taskId)}`,
        timeoutMs: 30_000,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // 上游清理任务记录（罕见但合理） → 终态失败让 runner 退款
      if (
        /HTTP\s+(400|404)/i.test(message) &&
        /task[_\s-]?not[_\s-]?(exist|found)|not\s*found/i.test(message)
      ) {
        return {
          taskId,
          status: "FAILED",
          progress: "0%",
          failReason: "上游任务记录已丢失（task not found），自动退款",
          retryable: false,
          terminalClass: "provider_error",
        };
      }
      throw error;
    }

    const status = normalizeVolc302Status(result.status);
    const progress = normalizeVolc302Progress(result.progress);

    if (VOLC302_SUCCESS_STATES.has(status)) {
      const directUrl = extractVolc302VideoUrl(result);
      if (!directUrl) {
        return {
          taskId,
          status: "FAILED",
          progress,
          failReason: "Succeeded status but no video_url in response",
          retryable: false,
          terminalClass: "provider_error",
        };
      }
      const finalUrl = await rehostToR2({
        upstreamUrl: directUrl,
        fallbackName: taskId,
      });
      return {
        taskId,
        status: "SUCCESS",
        progress: "100%",
        url: finalUrl,
      };
    }

    if (VOLC302_FAILURE_STATES.has(status)) {
      const failReason = extractVolc302FailReason(result);
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

    // Active or unknown — return as-is, runner keeps polling
    if (VOLC302_ACTIVE_STATES.has(status)) {
      return { taskId, status: status.toUpperCase(), progress };
    }
    return { taskId, status: status.toUpperCase(), progress };
  },
};

export { normalizeVolc302BaseUrl };
