import type { TerminalClass, VideoParams } from "@/lib/video/types";

export const RETRYABLE_HTTP_STATUSES = new Set([408, 409, 423, 425, 429, 500, 502, 503, 504]);

export function toPortraitLandscapeAspectRatio(
  orientation: VideoParams["orientation"],
): "9:16" | "16:9" {
  return orientation === "portrait" ? "9:16" : "16:9";
}

export function toGrokRatio(
  orientation: VideoParams["orientation"],
): "2:3" | "3:2" {
  return orientation === "portrait" ? "2:3" : "3:2";
}

export function classifyVideoProviderFailure(failReason: string): {
  retryable: boolean;
  terminalClass: TerminalClass;
} {
  const msg = failReason.toLowerCase();

  if (
    msg.includes("prominent_people") ||
    msg.includes("content policy") ||
    msg.includes("safety") ||
    msg.includes("sensitive") ||
    msg.includes("sensitive prompt") ||
    msg.includes("sensitive word") ||
    msg.includes("sensitive words") ||
    msg.includes("not allowed to generate") ||
    msg.includes("generation not allowed") ||
    msg.includes("not permitted to generate") ||
    msg.includes("prompt blocked") ||
    msg.includes("prompt rejected") ||
    msg.includes("内容敏感") ||
    msg.includes("提示词敏感") ||
    msg.includes("敏感词") ||
    msg.includes("不允许生成") ||
    msg.includes("禁止生成") ||
    msg.includes("违规") ||
    msg.includes("审核")
  ) {
    return { retryable: false, terminalClass: "content_policy" };
  }

  if (
    msg.includes("inpaint image must match") ||
    msg.includes("invalid_request_error") ||
    msg.includes("image dimensions") ||
    msg.includes("image size mismatch")
  ) {
    return { retryable: false, terminalClass: "provider_error" };
  }

  if (
    msg.includes("频率受限") ||
    msg.includes("账号频率受限") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("try again later") ||
    msg.includes("temporarily unavailable") ||
    msg.includes("负载已饱和")
  ) {
    return { retryable: true, terminalClass: "provider_error" };
  }

  if (
    msg.includes("quota") ||
    msg.includes("limit exceeded") ||
    msg.includes("余额不足") ||
    msg.includes("insufficient balance") ||
    msg.includes("insufficient quota")
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
    msg.includes("provider") ||
    msg.includes("upstream error")
  ) {
    return { retryable: true, terminalClass: "provider_error" };
  }

  return { retryable: true, terminalClass: "unknown" };
}

export function extractProviderErrorMessage(payload: unknown): string {
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

export function isRetryableOverload(status: number, message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    RETRYABLE_HTTP_STATUSES.has(status) ||
    normalized.includes("频率受限") ||
    normalized.includes("账号频率受限") ||
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("负载已饱和") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("try again later")
  );
}

export function extractVideoUrlFromPayload(result: Record<string, unknown>): string | undefined {
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
