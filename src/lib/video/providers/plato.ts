import type {
  VideoModelRecord,
  VideoProviderAdapter,
  VideoProviderCapabilities,
} from "@/lib/video/service";
import type { TaskStatusResult, VideoParams } from "@/lib/video/types";

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

function inferPlatoCapabilities(model: VideoModelRecord): VideoProviderCapabilities {
  const slug = model.slug.toLowerCase();
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
    const payload = {
      prompt: params.prompt,
      model: model.slug,
      images: params.imageUrls ?? [],
      aspect_ratio: toAspectRatio(params.orientation),
      duration: params.duration,
      watermark: true,
      private: false,
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
      return {
        taskId,
        status: "FAILED",
        progress,
        failReason: String(
          result.fail_reason || result.message || "Video task failed",
        ),
      };
    }
    return { taskId, status, progress };
  },
};
