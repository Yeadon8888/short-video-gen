import type {
  VideoModelRecord,
  VideoProviderCapabilities,
} from "@/lib/video/service";
import type { VideoDuration } from "@/lib/video/types";

export const NFVID_DEFAULT_BASE_URL = "https://api.nfvid.vip";
export const NFVID_VIDEOS_ENDPOINT = "/v1/videos";
export const NFVID_SUCCESS_STATES = new Set(["SUCCESS", "SUCCEEDED", "COMPLETED", "DONE"]);
export const NFVID_FAILURE_STATES = new Set(["FAILED", "FAILURE", "ERROR", "CANCELLED", "CANCELED"]);
export const NFVID_ACTIVE_STATES = new Set(["PENDING", "QUEUED", "PROCESSING", "RUNNING", "IN_PROGRESS"]);

const VALID_DURATIONS = new Set<VideoDuration>([4, 5, 6, 8, 10, 12, 15]);

export interface NfvidCreateResponse {
  id?: string;
  task_id?: string;
  taskId?: string;
  data?: {
    id?: string;
    task_id?: string;
    taskId?: string;
  };
}

export interface NfvidStatusResponse {
  id?: string;
  task_id?: string;
  taskId?: string;
  status?: string;
  state?: string;
  progress?: string | number;
  fail_reason?: string;
  failReason?: string;
  error?: unknown;
  message?: string;
  video_url?: string;
  url?: string;
  output?: string;
  data?: Record<string, unknown>;
}

export function normalizeNfvidBaseUrl(raw?: string | null): string {
  const value = (raw ?? "").trim().replace(/\/+$/, "");
  if (!value) return NFVID_DEFAULT_BASE_URL;

  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/\/v1\/videos(?:\/[^/?#]+)?(?:\/content)?$/, "") || "/";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return NFVID_DEFAULT_BASE_URL;
  }
}

function normalizeStatus(value: unknown): string {
  return String(value || "UNKNOWN").trim().toUpperCase();
}

export function normalizeNfvidProgress(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${Math.max(0, Math.min(100, Math.trunc(value)))}%`;
  }
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    return trimmed.includes("%") ? trimmed : `${trimmed}%`;
  }
  return "0%";
}

export function inferNfvidCapabilities(model: VideoModelRecord): VideoProviderCapabilities {
  const defaults = model.defaultParams ?? {};
  const configuredDurations = Array.isArray(defaults.allowedDurations)
    ? defaults.allowedDurations.filter((value): value is VideoDuration =>
        VALID_DURATIONS.has(value as VideoDuration),
      )
    : [];
  const allowedDurations: VideoDuration[] =
    configuredDurations.length > 0 ? Array.from(new Set(configuredDurations)) : [12];
  const defaultDuration =
    typeof defaults.duration === "number" && allowedDurations.includes(defaults.duration as VideoDuration)
      ? (defaults.duration as VideoDuration)
      : allowedDurations.includes(12)
        ? 12
        : allowedDurations[0];

  return { allowedDurations, defaultDuration };
}

export function extractNfvidTaskId(payload: NfvidCreateResponse): string {
  return String(
    payload.task_id ||
      payload.taskId ||
      payload.id ||
      payload.data?.task_id ||
      payload.data?.taskId ||
      payload.data?.id ||
      "",
  );
}

export function extractNfvidStatus(payload: NfvidStatusResponse): string {
  return normalizeStatus(payload.status || payload.state || payload.data?.status || payload.data?.state);
}

export function extractNfvidFailReason(payload: NfvidStatusResponse): string {
  const data = payload.data ?? {};
  const error = payload.error ?? data.error;
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message || (error as Record<string, unknown>).code;
    if (message) return String(message);
  }
  return String(
    payload.fail_reason ||
      payload.failReason ||
      payload.message ||
      data.fail_reason ||
      data.failReason ||
      data.message ||
      "Video task failed",
  );
}

export function extractNfvidVideoUrl(payload: NfvidStatusResponse): string | undefined {
  const data = payload.data ?? {};
  for (const key of ["video_url", "url", "output", "content_url"]) {
    const direct = (payload as Record<string, unknown>)[key];
    if (typeof direct === "string" && direct) return direct;
    const nested = data[key];
    if (typeof nested === "string" && nested) return nested;
  }
  return undefined;
}
