import { delayStaggeredSubmission } from "@/lib/tasks/batch-queue";
import type {
  VideoModelRecord,
  VideoProviderAdapter,
  VideoProviderCapabilities,
} from "@/lib/video/service";
import type { VideoDuration } from "@/lib/video/types";
import {
  classifyVideoProviderFailure,
  extractProviderErrorMessage,
  isRetryableOverload,
  toPortraitLandscapeAspectRatio,
} from "./shared";
import { mirrorReferenceImagesToCnOss } from "./cn-oss-mirror";

const DEFAULT_BASE_URL = "https://api.newtoken.club";
const VIDEOS_ENDPOINT = "/v1/videos";
const SUCCESS_STATES = new Set(["COMPLETED", "SUCCESS", "SUCCEEDED"]);
const FAILURE_STATES = new Set(["FAILED", "FAILURE", "ERROR", "CANCELLED"]);
const ACTIVE_STATES = new Set(["QUEUED", "IN_PROGRESS", "PENDING", "PROCESSING"]);

// Per-model fixed durations. The NewAPI gateway exposes each model with a
// single allowed length; admin `defaultParams.allowedDurations` may override.
const SLUG_DURATIONS: Record<string, VideoDuration> = {
  "veo-3-1": 8,
  "sora-pro": 15,
};

function normalizeNewtokenBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_BASE_URL;

  try {
    const url = new URL(trimmed);
    url.pathname = url.pathname.replace(/\/v1\/videos(?:\/.*)?$/, "") || "/";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return trimmed;
  }
}

function getBaseUrl(model: VideoModelRecord): string {
  return normalizeNewtokenBaseUrl(
    model.baseUrl ||
      process.env.NEWTOKEN_BASE_URL ||
      process.env.VIDEO_BASE_URL ||
      DEFAULT_BASE_URL,
  );
}

function getApiKey(model: VideoModelRecord): string {
  return (
    model.apiKey ||
    process.env.NEWTOKEN_API_KEY ||
    process.env.VIDEO_API_KEY ||
    ""
  ).trim();
}

function normalizeStatus(value: unknown): string {
  return String(value || "UNKNOWN").trim().toUpperCase();
}

function inferDuration(model: VideoModelRecord): VideoDuration {
  const slug = model.slug.trim().toLowerCase();
  return SLUG_DURATIONS[slug] ?? 8;
}

function inferCapabilities(model: VideoModelRecord): VideoProviderCapabilities {
  const defaults = model.defaultParams ?? {};
  const configured = Array.isArray(defaults.allowedDurations)
    ? defaults.allowedDurations.filter(
        (v): v is VideoDuration =>
          v === 4 || v === 5 || v === 6 || v === 8 ||
          v === 10 || v === 12 || v === 15 || v === 16 || v === 20,
      )
    : [];

  const allowedDurations: VideoDuration[] =
    configured.length > 0
      ? Array.from(new Set(configured))
      : [inferDuration(model)];

  const defaultDuration =
    typeof defaults.duration === "number" &&
    allowedDurations.includes(defaults.duration as VideoDuration)
      ? (defaults.duration as VideoDuration)
      : allowedDurations[0];

  return { allowedDurations, defaultDuration };
}

function extractFailReason(result: Record<string, unknown>): string {
  const error = result.error;
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  const candidate = result.message || result.status_message;
  return String(candidate || "Video task failed").trim();
}

function extractProgress(result: Record<string, unknown>): string {
  const raw = result.progress;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return `${Math.max(0, Math.min(100, Math.trunc(raw)))}%`;
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw.includes("%") ? raw.trim() : `${raw.trim()}%`;
  }
  return "0%";
}

function extractResultUrl(result: Record<string, unknown>): string | undefined {
  for (const key of ["url", "video_url"]) {
    const value = result[key];
    if (typeof value === "string" && value) return value;
  }
  const metadata = result.metadata;
  if (metadata && typeof metadata === "object") {
    const urls = (metadata as Record<string, unknown>).result_urls;
    if (Array.isArray(urls)) {
      const first = urls.find((u) => typeof u === "string" && u);
      if (typeof first === "string") return first;
    }
  }
  return undefined;
}

async function apiRequest(
  model: VideoModelRecord,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<Record<string, unknown>> {
  const apiKey = getApiKey(model);
  if (!apiKey) {
    throw new Error("NEWTOKEN_API_KEY is not set");
  }

  const url = `${getBaseUrl(model)}${path}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(180_000),
      });

      const text = await response.text();
      let payload: Record<string, unknown> = {};
      if (text) {
        try {
          payload = JSON.parse(text) as Record<string, unknown>;
        } catch {
          payload = { raw: text.slice(0, 500) };
        }
      }

      if (!response.ok) {
        const message = extractProviderErrorMessage(payload);
        const rawSnippet = text.trim().slice(0, 500);
        const detail =
          rawSnippet && rawSnippet !== message ? ` | body=${rawSnippet}` : "";
        if (attempt < 2 && isRetryableOverload(response.status, message)) {
          await new Promise((resolve) =>
            setTimeout(resolve, 15_000 * (attempt + 1)),
          );
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${message}${detail}`);
      }

      return payload;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < 2) {
        await new Promise((resolve) =>
          setTimeout(resolve, 3_000 * (attempt + 1)),
        );
        continue;
      }
    }
  }

  throw lastError ?? new Error("Newtoken video provider request failed");
}

export const newtokenProvider: VideoProviderAdapter = {
  id: "newtoken",
  getCapabilities(model) {
    return inferCapabilities(model);
  },
  async createTasks({ model, params }) {
    const taskIds: string[] = [];
    const providerOptions = params.providerOptions ?? {};
    const rawImages = params.imageUrls ?? [];

    // sora-pro 走 Seedance(境内),omni_reference 只认它能拉到的 https URL,
    // 而我们的 CF 图床在境内拉不动 —— 仅对此模型把参考图镜像到国内 OSS。
    // 其他模型/渠道一律不动。
    const images =
      model.slug.trim().toLowerCase() === "sora-pro" && rawImages.length > 0
        ? await mirrorReferenceImagesToCnOss(rawImages)
        : rawImages;

    const resolution =
      typeof providerOptions.resolution === "string" &&
      providerOptions.resolution.trim()
        ? providerOptions.resolution.trim()
        : undefined;

    for (let index = 0; index < params.count; index += 1) {
      await delayStaggeredSubmission(index);

      const result = await apiRequest(model, "POST", VIDEOS_ENDPOINT, {
        model: model.slug,
        prompt: params.prompt,
        duration: params.duration,
        aspect_ratio: toPortraitLandscapeAspectRatio(params.orientation),
        ...(resolution ? { resolution } : {}),
        ...(images.length > 0 ? { images } : {}),
      });

      const taskId = String(result.task_id || result.id || "");
      if (!taskId) {
        throw new Error(
          `Newtoken video task creation failed: ${JSON.stringify(result).slice(0, 200)}`,
        );
      }

      taskIds.push(taskId);
    }

    return { providerTaskIds: taskIds };
  },
  async queryTaskStatus({ model, taskId }) {
    const result = await apiRequest(
      model,
      "GET",
      `${VIDEOS_ENDPOINT}/${encodeURIComponent(taskId)}`,
    );

    const status = normalizeStatus(result.status);
    const progress = extractProgress(result);
    const url = extractResultUrl(result);

    if (SUCCESS_STATES.has(status) && url) {
      return {
        taskId,
        status: "SUCCESS",
        progress: "100%",
        url,
      };
    }

    if (FAILURE_STATES.has(status)) {
      const failReason = extractFailReason(result);
      const { retryable, terminalClass } =
        classifyVideoProviderFailure(failReason);
      return {
        taskId,
        status: "FAILED",
        progress,
        failReason,
        retryable,
        terminalClass,
      };
    }

    if (SUCCESS_STATES.has(status) && !url) {
      return { taskId, status: "PROCESSING", progress };
    }

    if (ACTIVE_STATES.has(status)) {
      return { taskId, status, progress };
    }

    return { taskId, status, progress };
  },
};

export { normalizeNewtokenBaseUrl };
