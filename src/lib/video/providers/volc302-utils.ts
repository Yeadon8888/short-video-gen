import type {
  VideoModelRecord,
  VideoProviderCapabilities,
} from "@/lib/video/service";
import type { VideoDuration } from "@/lib/video/types";

/**
 * 302.ai 转发的 Volcengine 即梦（Seedance）视频生成 API。
 *
 * Submit:   POST {baseUrl}/volcengine/api/v3/contents/generations/tasks
 * Query:    GET  {baseUrl}/volcengine/api/v3/contents/generations/tasks/{taskId}
 * Auth:     Bearer {apiKey}
 *
 * 异步轮询，task_id 形如 "cgt-20260514165529-9djp7"。返回的视频 URL 是
 * Volcengine TOS 预签名链接，X-Tos-Expires=86400 (24h)，必须 rehost。
 */
export const VOLC302_DEFAULT_BASE_URL = "https://api.302.ai";
export const VOLC302_TASKS_ENDPOINT = "/volcengine/api/v3/contents/generations/tasks";

/** Volcengine 状态枚举，小写匹配 spec + 实测值. */
export const VOLC302_SUCCESS_STATES = new Set(["succeeded", "success", "done", "completed"]);
export const VOLC302_FAILURE_STATES = new Set(["failed", "error", "cancelled", "canceled", "expired"]);
export const VOLC302_ACTIVE_STATES = new Set(["queued", "running", "processing", "pending"]);

/** Seedance 2.0 fast 实测支持 [4, 15] 整数秒, -1 = 自动. */
const VALID_DURATIONS = new Set<VideoDuration>([4, 5, 6, 8, 10, 12, 15]);

export interface Volc302CreateResponse {
  id?: string;
  task_id?: string;
}

export interface Volc302StatusResponse {
  id?: string;
  model?: string;
  status?: string;
  content?: { video_url?: string };
  /** Volcengine 不返回 progress，但保留以兼容上游字段名变更 */
  progress?: string | number;
  /** spec 里 failed 状态会带 error 信息；实测尚未触发，留作兜底解析 */
  error?: { code?: string; message?: string };
  message?: string;
  duration?: number;
}

export function normalizeVolc302BaseUrl(raw?: string | null): string {
  const value = (raw ?? "").trim().replace(/\/+$/, "");
  if (!value) return VOLC302_DEFAULT_BASE_URL;
  try {
    const url = new URL(value);
    // 容忍用户粘贴完整端点路径，剥掉它
    url.pathname = url.pathname.replace(
      /\/volcengine\/api\/v3\/contents\/generations\/tasks(?:\/[^/?#]+)?$/,
      "",
    ) || "/";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return VOLC302_DEFAULT_BASE_URL;
  }
}

export function normalizeVolc302Status(value: unknown): string {
  return String(value || "unknown").trim().toLowerCase();
}

export function normalizeVolc302Progress(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${Math.max(0, Math.min(100, Math.trunc(value)))}%`;
  }
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    return trimmed.includes("%") ? trimmed : `${trimmed}%`;
  }
  return "0%";
}

export function extractVolc302TaskId(payload: Volc302CreateResponse): string {
  return String(payload.id || payload.task_id || "");
}

export function extractVolc302VideoUrl(payload: Volc302StatusResponse): string | undefined {
  const url = payload.content?.video_url;
  if (typeof url === "string" && url) return url;
  return undefined;
}

export function extractVolc302FailReason(payload: Volc302StatusResponse): string {
  if (payload.error?.message) return String(payload.error.message);
  if (payload.error?.code) return String(payload.error.code);
  if (payload.message) return String(payload.message);
  return "Volcengine video task failed";
}

export function inferVolc302Capabilities(model: VideoModelRecord): VideoProviderCapabilities {
  const defaults = model.defaultParams ?? {};
  const configuredDurations = Array.isArray(defaults.allowedDurations)
    ? defaults.allowedDurations.filter((value): value is VideoDuration =>
        VALID_DURATIONS.has(value as VideoDuration),
      )
    : [];
  const allowedDurations: VideoDuration[] =
    configuredDurations.length > 0 ? Array.from(new Set(configuredDurations)) : [10];
  const defaultDuration =
    typeof defaults.duration === "number" &&
    allowedDurations.includes(defaults.duration as VideoDuration)
      ? (defaults.duration as VideoDuration)
      : allowedDurations.includes(10)
        ? 10
        : allowedDurations[0];

  return { allowedDurations, defaultDuration };
}
