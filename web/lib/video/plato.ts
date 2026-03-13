import type { TaskResult, VideoParams } from "./types";

const DEFAULT_BASE_URL = "https://api.bltcy.ai";
const CREATE_ENDPOINT = "/v2/videos/generations";
const STATUS_ENDPOINT = "/v2/videos/generations";
const SUCCESS_STATES = new Set(["SUCCESS", "SUCCEEDED", "COMPLETED"]);
const FAILURE_STATES = new Set(["FAILURE", "FAILED", "ERROR", "CANCELLED"]);

function getBaseUrl(): string {
  return (
    process.env.VIDEO_BASE_URL ||
    process.env.PLATO_BASE_URL ||
    DEFAULT_BASE_URL
  ).trim().replace(/\/+$/, "");
}

function getApiKey(): string {
  return (
    process.env.VIDEO_API_KEY ||
    process.env.PLATO_API_KEY ||
    ""
  ).trim();
}

function getModel(): string {
  return process.env.VIDEO_MODEL || "sora-2";
}

function getHdEnabled(): boolean {
  const raw = process.env.VIDEO_HD;
  return raw === "1" || raw?.toLowerCase() === "true";
}

function toAspectRatio(orientation: VideoParams["orientation"]): "9:16" | "16:9" {
  return orientation === "portrait" ? "9:16" : "16:9";
}

function extractErrorMessage(payload: unknown): string {
  if (payload && typeof payload === "object") {
    const maybeError = (payload as Record<string, unknown>).error;
    if (maybeError && typeof maybeError === "object") {
      const errorObj = maybeError as Record<string, unknown>;
      return String(errorObj.message || errorObj.code || "Unknown API error");
    }
    if ("message" in (payload as Record<string, unknown>)) {
      return String((payload as Record<string, unknown>).message);
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
  method: string,
  path: string,
  body?: unknown
): Promise<Record<string, unknown>> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("VIDEO_API_KEY or PLATO_API_KEY is not set");
  }

  const url = `${getBaseUrl()}${path}`;
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
      const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};

      if (!response.ok) {
        const message = extractErrorMessage(payload);
        if (attempt < 2 && isRetryableOverload(response.status, message)) {
          await new Promise((resolve) => setTimeout(resolve, 15_000 * (attempt + 1)));
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${message}`);
      }

      return payload;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 3_000 * (attempt + 1)));
        continue;
      }
    }
  }

  throw lastError ?? new Error("Video provider request failed");
}

export async function createTasks(params: VideoParams): Promise<string[]> {
  const taskIds: string[] = [];
  const payload = {
    prompt: params.prompt,
    model: getModel(),
    images: params.imageUrls ?? [],
    aspect_ratio: toAspectRatio(params.orientation),
    duration: String(params.duration),
    watermark: true,
    private: false,
    ...(getHdEnabled() ? { hd: true } : {}),
  };

  for (let index = 0; index < params.count; index += 1) {
    const result = await apiRequest("POST", CREATE_ENDPOINT, payload);
    const taskId = String(result.task_id || result.id || "");
    if (!taskId) {
      throw new Error(`Video task creation failed: ${JSON.stringify(result).slice(0, 200)}`);
    }
    taskIds.push(taskId);
  }

  return taskIds;
}

async function queryTask(taskId: string): Promise<Record<string, unknown>> {
  return apiRequest("GET", `${STATUS_ENDPOINT}/${taskId}`);
}

export async function queryTaskStatus(taskId: string): Promise<{
  taskId: string;
  status: string;
  progress: string;
  url?: string;
  failReason?: string;
}> {
  const result = await queryTask(taskId);
  const status = normalizeStatus(result.status);
  const progress = String(result.progress || "0%");

  if (SUCCESS_STATES.has(status)) {
    return { taskId, status: "SUCCESS", progress: "100%", url: extractVideoUrl(result) };
  }
  if (FAILURE_STATES.has(status)) {
    return {
      taskId,
      status: "FAILED",
      progress,
      failReason: String(result.fail_reason || result.message || "Video task failed"),
    };
  }
  return { taskId, status, progress };
}

function normalizeStatus(value: unknown): string {
  return String(value || "UNKNOWN").toUpperCase();
}

function extractVideoUrl(result: Record<string, unknown>): string | undefined {
  const data = result.data;
  if (data && typeof data === "object") {
    for (const key of ["output", "video_url", "url"]) {
      const value = (data as Record<string, unknown>)[key];
      if (typeof value === "string" && value) {
        return value;
      }
    }
  }

  for (const key of ["output", "video_url", "url"]) {
    const value = result[key];
    if (typeof value === "string" && value) {
      return value;
    }
  }

  return undefined;
}

export async function pollTasks(
  taskIds: string[],
  onProgress: (msg: string) => void,
  options?: {
    pollIntervalMs?: number;
    maxWaitMs?: number;
  }
): Promise<Map<string, TaskResult>> {
  const pollIntervalMs = options?.pollIntervalMs ?? 15_000;
  const maxWaitMs = options?.maxWaitMs ?? 180_000; // 3 min default
  const pending = new Set(taskIds);
  const results = new Map<string, TaskResult>();
  let elapsedMs = 0;

  onProgress(`提交了 ${taskIds.length} 个柏拉图视频任务`);

  while (pending.size > 0) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    elapsedMs += pollIntervalMs;

    if (elapsedMs > maxWaitMs) {
      for (const taskId of pending) {
        results.set(taskId, {
          taskId,
          success: false,
          status: "TIMEOUT",
          failReason: "Polling timed out",
        });
      }
      break;
    }

    for (const taskId of [...pending]) {
      let result: Record<string, unknown>;
      try {
        result = await queryTask(taskId);
      } catch (error) {
        onProgress(`查询 ${taskId.slice(0, 16)}... 失败，稍后重试`);
        continue;
      }

      const status = normalizeStatus(result.status);
      const progress = String(result.progress || "0%");
      onProgress(`[轮询] ${taskId.slice(0, 16)}... 状态=${status} 进度=${progress}`);

      if (SUCCESS_STATES.has(status)) {
        results.set(taskId, {
          taskId,
          success: true,
          status,
          url: extractVideoUrl(result),
        });
        pending.delete(taskId);
        continue;
      }

      if (FAILURE_STATES.has(status)) {
        results.set(taskId, {
          taskId,
          success: false,
          status,
          failReason: String(result.fail_reason || result.message || "Video task failed"),
        });
        pending.delete(taskId);
      }
    }
  }

  return results;
}
