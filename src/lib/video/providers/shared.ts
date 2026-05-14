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
    msg.includes("unsafe") ||
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
    msg.includes("负载已饱和") ||
    // 上游 429 各种文案：grok2api / nfvid 都会把 Grok 的 429 包成 "returned 429" 之类
    /\b429\b/.test(msg) ||
    msg.includes("returned 429") ||
    msg.includes("upstream 429") ||
    msg.includes("stream idle timeout") ||  // nfvid 的 60s stream timeout 也是瞬态拥塞
    // nfvid 的输出质量守门：Grok 上游偶尔会"缩水"返回 400x736 等低分辨率视频，
    // nfvid 检测到后会拒绝。这是瞬态质量问题，重试可能就好。
    msg.includes("low resolution video") ||
    msg.includes("blocked width") ||
    msg.includes("blocked height") ||
    msg.includes("video generation returned low")
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

/**
 * 把原始上游错误翻译成 **用户能看懂、不泄露技术细节** 的中文提示。
 *
 * 原则：
 * - 关键的"业务原因"必须传达（如：图片含真人、内容违规、配额不足）
 * - 技术细节（HTTP 状态码、JSON 结构、内部账号余额数字、上游错误码）一律剥掉
 * - 退款/重试的承诺要明确，让用户知道下一步怎么办
 *
 * 原始错误请同时 `console.error` 写入日志，方便我们排查；这里返回的只是给
 * 终端用户看的版本。
 */
export function friendlyFailMessage(rawMessage: string): string {
  const msg = (rawMessage || "").toLowerCase();

  // ── 隐私 / 真人图（最具体，先判 — Volcengine Seedance 这条最常见）──
  if (
    msg.includes("inputimagesensitivecontentdetected") ||
    msg.includes("privacyinformation") ||
    msg.includes("may contain real person") ||
    msg.includes("real person") ||
    msg.includes("contain person") ||
    msg.includes("face detected") ||
    msg.includes("人脸") ||
    msg.includes("真人") ||
    msg.includes("人像")
  ) {
    return "图片中检测到真人或隐私内容，无法生成。请使用纯产品图、卡通形象或不含真实人像的图片重试。";
  }

  // ── 上游 / 服务商配额不足（隔离用户的金额数字，导回管理员） ──
  if (
    msg.includes("insuficient_user_quota") ||
    msg.includes("insufficient_user_quota") ||
    msg.includes("insufficient_quota") ||
    msg.includes("预扣费额度") ||
    msg.includes("剩余额度") ||
    msg.includes("user_quota")
  ) {
    return "当前模型服务额度不足，请联系管理员处理后再试。";
  }

  // ── 内容违规（不含真人那条，但 prompt 敏感词等）──
  if (
    msg.includes("prominent_people") ||
    msg.includes("content policy") ||
    msg.includes("content_unsafe") ||
    msg.includes("safety") ||
    msg.includes("unsafe") ||
    msg.includes("sensitive") ||
    msg.includes("内容敏感") ||
    msg.includes("提示词敏感") ||
    msg.includes("敏感词") ||
    msg.includes("违规") ||
    msg.includes("审核") ||
    msg.includes("not allowed to generate") ||
    msg.includes("prompt blocked")
  ) {
    return "提示词或图片涉敏感/违规内容，请调整描述或换张图片重试。";
  }

  // ── 余额 / 限额（用户层面的余额不足）──
  if (
    msg.includes("余额不足") ||
    msg.includes("insufficient balance") ||
    msg.includes("quota") ||
    msg.includes("limit exceeded")
  ) {
    return "账户余额或配额不足，请充值或联系客服。";
  }

  // ── 上游低分辨率回退 (Grok 偶发"缩水"输出 + nfvid 守门拒绝) ──
  // 必须放在限流之前，因为低分辨率不算"繁忙"，是质量问题
  if (
    msg.includes("low resolution video") ||
    msg.includes("blocked width") ||
    msg.includes("blocked height") ||
    msg.includes("video generation returned low")
  ) {
    return "上游生成的视频质量不达标（分辨率过低，已被自动过滤），已自动退款。这是上游偶发问题，请重新提交即可。";
  }

  // ── 限流 / 频率受限 ──
  if (
    msg.includes("频率受限") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("负载已饱和") ||
    msg.includes("temporarily unavailable") ||
    /\b429\b/.test(msg) ||
    msg.includes("returned 429") ||
    msg.includes("upstream 429") ||
    msg.includes("stream idle timeout")
  ) {
    return "上游服务繁忙（限流或临时拥塞），已自动退款，请稍后重试。";
  }

  // ── 超时 ──
  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("超时")) {
    return "生成超时，已自动退款，请稍后重试。";
  }

  // ── 上游通用错误兜底 ──
  if (
    msg.includes("upstream") ||
    msg.includes("server error") ||
    msg.includes("internal") ||
    msg.includes("provider") ||
    /\bhttp\s+[45]\d\d\b/i.test(msg) ||
    msg.includes("invalid_request_error")
  ) {
    return "上游服务返回错误，已自动退款，请稍后重试。如多次失败请联系管理员。";
  }

  // ── 最终兜底：完全不认识的错误 ──
  return "生成失败，已自动退款，请稍后重试或联系管理员。";
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
