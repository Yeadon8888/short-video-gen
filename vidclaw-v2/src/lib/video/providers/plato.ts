import type {
  VideoModelRecord,
  VideoProviderAdapter,
  VideoProviderCapabilities,
} from "@/lib/video/service";
import type { TaskStatusResult, TerminalClass, VideoParams } from "@/lib/video/types";

const DEFAULT_BASE_URL = "https://api.bltcy.ai";
const CREATE_ENDPOINT = "/v2/videos/generations";
const STATUS_ENDPOINT = "/v2/videos/generations";
const SUCCESS_STATES = new Set(["SUCCESS", "SUCCEEDED", "COMPLETED"]);
const FAILURE_STATES = new Set(["FAILURE", "FAILED", "ERROR", "CANCELLED"]);

export function normalizePlatoBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_BASE_URL;

  try {
    const url = new URL(trimmed);
    const normalizedPath = url.pathname.replace(
      /\/v2\/videos\/generations(?:\/[^/?#]+)?$/,
      "",
    );

    url.pathname = normalizedPath || "/";
    url.search = "";
    url.hash = "";

    return url.toString().replace(/\/+$/, "");
  } catch {
    return trimmed;
  }
}

function getBaseUrl(model: VideoModelRecord): string {
  return normalizePlatoBaseUrl(
    model.baseUrl ||
    process.env.VIDEO_BASE_URL ||
    process.env.PLATO_BASE_URL ||
    DEFAULT_BASE_URL,
  );
}

function getApiKey(model: VideoModelRecord): string {
  return (
    model.apiKey ||
    process.env.VIDEO_API_KEY ||
    process.env.PLATO_API_KEY ||
    ""
  ).trim();
}

function getHdEnabled(): boolean {
  const raw = process.env.VIDEO_HD;
  return raw === "1" || raw?.toLowerCase() === "true";
}

function toAspectRatio(
  orientation: VideoParams["orientation"],
): "9:16" | "16:9" {
  return orientation === "portrait" ? "9:16" : "16:9";
}

function extractErrorMessage(payload: unknown): string {
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const maybeError = obj.error;
    if (maybeError && typeof maybeError === "object") {
      const errorObj = maybeError as Record<string, unknown>;
      const message = String(errorObj.message || errorObj.code || "").trim();
      if (message) return message;
    }
    if ("message" in obj) {
      const message = String(obj.message || "").trim();
      if (message) return message;
    }
  }
  return "Unknown API error";
}

function isRetryableOverload(status: number, message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    status === 429 ||
    normalized.includes("负载已饱和") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("try again later")
  );
}

function classifyFailReason(failReason: string): {
  retryable: boolean;
  terminalClass: TerminalClass;
} {
  const msg = failReason.toLowerCase();

  if (
    msg.includes("prominent_people") ||
    msg.includes("content policy") ||
    msg.includes("safety") ||
    msg.includes("违规") ||
    msg.includes("审核")
  ) {
    return { retryable: false, terminalClass: "content_policy" };
  }

  if (
    msg.includes("quota") ||
    msg.includes("limit exceeded") ||
    msg.includes("余额不足") ||
    msg.includes("account")
  ) {
    return { retryable: false, terminalClass: "quota_exceeded" };
  }

  if (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("超时")
  ) {
    return { retryable: true, terminalClass: "timeout" };
  }

  if (
    msg.includes("server error") ||
    msg.includes("internal") ||
    msg.includes("500") ||
    msg.includes("服务器") ||
    msg.includes("provider")
  ) {
    return { retryable: true, terminalClass: "provider_error" };
  }

  // Default: treat as retryable unknown
  return { retryable: true, terminalClass: "unknown" };
}

async function apiRequest(
  model: VideoModelRecord,
  method: string,
  path: string,
  body?: unknown,
): Promise<Record<string, unknown>> {
  const apiKey = getApiKey(model);
  if (!apiKey) {
    throw new Error("VIDEO_API_KEY is not set");
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
        const message = extractErrorMessage(payload);
        const rawSnippet = text.trim().slice(0, 500);
        const detail = rawSnippet && rawSnippet !== message
          ? ` | body=${rawSnippet}`
          : "";
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

  throw lastError ?? new Error("Video provider request failed");
}

function normalizeStatus(value: unknown): string {
  return String(value || "UNKNOWN").toUpperCase();
}

function extractVideoUrl(result: Record<string, unknown>): string | undefined {
  const data = result.data;
  if (data && typeof data === "object") {
    for (const key of ["output", "video_url", "url"]) {
      const value = (data as Record<string, unknown>)[key];
      if (typeof value === "string" && value) return value;
    }
  }
  for (const key of ["output", "video_url", "url"]) {
    const value = result[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

function isGrokSlug(slug: string): boolean {
  return slug.toLowerCase().includes("grok");
}

/**
 * Map orientation → Grok ratio string.
 * portrait → "2:3", landscape → "3:2"
 */
function toGrokRatio(
  orientation: VideoParams["orientation"],
): "2:3" | "3:2" {
  return orientation === "portrait" ? "2:3" : "3:2";
}

/**
 * Map our internal duration to the nearest Grok-supported value (6 or 10).
 */
function toGrokDuration(duration: number): 6 | 10 {
  return duration <= 6 ? 6 : 10;
}

function inferPlatoCapabilities(model: VideoModelRecord): VideoProviderCapabilities {
  const slug = model.slug.toLowerCase();
  if (isGrokSlug(slug)) {
    return {
      allowedDurations: [8, 10],
      defaultDuration: 10,
    };
  }
  if (slug.includes("veo")) {
    return {
      allowedDurations: [8],
      defaultDuration: 8,
    };
  }
  if (slug.includes("sora")) {
    return {
      allowedDurations: [10, 15],
      defaultDuration: 10,
    };
  }
  return {
    allowedDurations: [8, 10, 15],
    defaultDuration: 10,
  };
}

export const platoProvider: VideoProviderAdapter = {
  id: "plato",
  getCapabilities(model) {
    return inferPlatoCapabilities(model);
  },
  async createTasks({ model, params }) {
    const taskIds: string[] = [];
    const providerOptions = params.providerOptions ?? {};

    const grok = isGrokSlug(model.slug);
    const images = params.imageUrls ?? [];

    const payload = grok
      ? {
          // Grok-specific payload: ratio / resolution / images (max 1)
          prompt: params.prompt,
          model: model.slug,
          ratio: toGrokRatio(params.orientation),
          resolution:
            typeof providerOptions.resolution === "string"
              ? providerOptions.resolution
              : "720P",
          duration: toGrokDuration(params.duration),
          ...(images.length > 0 ? { images: [images[0]] } : {}),
        }
      : {
          // Standard plato payload
          ...providerOptions,
          prompt: params.prompt,
          model: model.slug,
          images,
          aspect_ratio: toAspectRatio(params.orientation),
          duration: params.duration,
          watermark:
            typeof providerOptions.watermark === "boolean"
              ? providerOptions.watermark
              : true,
          private:
            typeof providerOptions.private === "boolean"
              ? providerOptions.private
              : false,
          ...(getHdEnabled() ? { hd: true } : {}),
        };

    for (let index = 0; index < params.count; index += 1) {
      const result = await apiRequest(model, "POST", CREATE_ENDPOINT, payload);
      const taskId = String(result.task_id || result.id || "");
      if (!taskId) {
        throw new Error(
          `Video task creation failed: ${JSON.stringify(result).slice(0, 200)}`,
        );
      }
      taskIds.push(taskId);
    }

    return taskIds;
  },
  async queryTaskStatus({ model, taskId }) {
    const result = await apiRequest(
      model,
      "GET",
      `${STATUS_ENDPOINT}/${taskId}`,
      undefined,
    );
    const status = normalizeStatus(result.status);
    const progress = String(result.progress || "0%");

    if (SUCCESS_STATES.has(status)) {
      return {
        taskId,
        status: "SUCCESS",
        progress: "100%",
        url: extractVideoUrl(result),
      };
    }
    if (FAILURE_STATES.has(status)) {
      const failReason = String(
        result.fail_reason || result.message || "Video task failed",
      );
      const { retryable, terminalClass } = classifyFailReason(failReason);
      return {
        taskId,
        status: "FAILED",
        progress,
        failReason,
        retryable,
        terminalClass,
      };
    }
    return { taskId, status, progress };
  },
};
