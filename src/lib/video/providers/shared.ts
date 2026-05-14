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

/**
 * 上游错误模式表 —— **classifier 和 friendlyFailMessage 唯一的真相源**。
 *
 * 设计目标：把"什么算这类错误（matchers）"、"是否可重试（retryable）"、
 * "对内归类（terminalClass）"、"对用户说什么（friendly）"四件事捆在一起，
 * 避免两个函数维护两份关键字列表导致漂移（历史上添加新上游错误时漏一边的 bug）。
 *
 * 顺序敏感：从最具体到最通用，第一个匹配即胜出。新增条目时优先放到合适的
 * 具体层级里，**不要**直接追加到末尾。
 */
type ErrorPattern = {
  /** 唯一名（便于检索、日志、未来 metrics 分桶）*/
  id: string;
  /** 匹配器：小写子串 或 RegExp。任意一个命中算这条规则匹配。*/
  matchers: ReadonlyArray<string | RegExp>;
  retryable: boolean;
  terminalClass: TerminalClass;
  /** 给终端用户看的中文版（已脱敏的）*/
  friendly: string;
};

const UPSTREAM_GENERIC_FRIENDLY =
  "上游服务返回错误，已自动退款，请稍后重试。如多次失败请联系管理员。";

const UPSTREAM_ERROR_PATTERNS: ReadonlyArray<ErrorPattern> = [
  // ── 1. 真人 / 隐私图（最具体，先判 — Volcengine Seedance 这条最常见）──
  {
    id: "real_person",
    matchers: [
      "inputimagesensitivecontentdetected",
      "privacyinformation",
      "may contain real person",
      "real person",
      "contain person",
      "face detected",
      "人脸",
      "真人",
      "人像",
    ],
    retryable: false,
    terminalClass: "content_policy",
    friendly:
      "图片中检测到真人或隐私内容，无法生成。请使用纯产品图、卡通形象或不含真实人像的图片重试。",
  },

  // ── 2. 上游 B2B 配额不足（隔离用户的金额数字，导回管理员）──
  // 这一类**必须** non-retryable —— 重试 5 次也不会变出额度，只是浪费上游调用。
  {
    id: "b2b_quota_exhausted",
    matchers: [
      "insuficient_user_quota", // 上游 302.ai 的 typo
      "insufficient_user_quota",
      "insufficient_quota",
      "insufficient quota",
      "user_quota",
      "预扣费额度",
      "剩余额度",
    ],
    retryable: false,
    terminalClass: "quota_exceeded",
    friendly: "当前模型服务额度不足，请联系管理员处理后再试。",
  },

  // ── 3. 内容违规（不含真人那条，但 prompt 敏感词 / 审核失败等）──
  {
    id: "content_policy",
    matchers: [
      "prominent_people",
      "content policy",
      "content_unsafe",
      "video_unsafe",
      "safety",
      "unsafe",
      "sensitive",
      "sensitive prompt",
      "sensitive word",
      "sensitive words",
      "not allowed to generate",
      "generation not allowed",
      "not permitted to generate",
      "prompt blocked",
      "prompt rejected",
      "内容敏感",
      "提示词敏感",
      "敏感词",
      "不允许生成",
      "禁止生成",
      "违规",
      "审核",
    ],
    retryable: false,
    terminalClass: "content_policy",
    friendly: "提示词或图片涉敏感/违规内容，请调整描述或换张图片重试。",
  },

  // ── 4. invalid_request_error / 图片尺寸不匹配 等"参数级"上游错误 ──
  // 这一类重试无意义（参数本身错的，下次发还是错的）。
  {
    id: "invalid_request",
    matchers: [
      "inpaint image must match",
      "invalid_request_error",
      "image dimensions",
      "image size mismatch",
    ],
    retryable: false,
    terminalClass: "provider_error",
    friendly: UPSTREAM_GENERIC_FRIENDLY,
  },

  // ── 5. 用户层余额 / 配额 ──
  {
    id: "user_balance",
    matchers: [
      "余额不足",
      "insufficient balance",
      "quota",
      "limit exceeded",
    ],
    retryable: false,
    terminalClass: "quota_exceeded",
    friendly: "账户余额或配额不足，请充值或联系客服。",
  },

  // ── 6. 上游"任务存在但视频未生成"——nfvid 链路偶发故障 ──
  // 必须放在 generic upstream 前面，否则会被 invalid_request_error / upstream 吞掉
  {
    id: "video_not_found",
    matchers: [
      /video[^a-z]*not found/i,
      /video_id[^a-z]*not found/i,
      /'video_[a-z0-9]+'.*not found/i,
    ],
    retryable: true,
    terminalClass: "provider_error",
    friendly:
      "上游服务暂未交付视频（任务记录已建立但视频未生成），已自动退款。这是上游偶发故障，请稍后重试或换个模型。",
  },

  // ── 7. 上游低分辨率回退（Grok 偶发"缩水"输出 + nfvid 守门拒绝）──
  // 必须放在限流之前，因为低分辨率不算"繁忙"，是质量问题
  {
    id: "low_resolution",
    matchers: [
      "low resolution video",
      "blocked width",
      "blocked height",
      "video generation returned low",
    ],
    retryable: true,
    terminalClass: "provider_error",
    friendly:
      "上游生成的视频质量不达标（分辨率过低，已被自动过滤），已自动退款。这是上游偶发问题，请重新提交即可。",
  },

  // ── 8. 限流 / 频率受限 ──
  // 注意 "stream idle timeout" 字面含 "timeout" 但语义是 nfvid 60s 上游空闲断连，
  // 必须先于通用 timeout 匹配。
  {
    id: "rate_limit",
    matchers: [
      "频率受限",
      "账号频率受限",
      "rate limit",
      "too many requests",
      "try again later",
      "temporarily unavailable",
      "负载已饱和",
      /\b429\b/,
      "returned 429",
      "upstream 429",
      "stream idle timeout",
    ],
    retryable: true,
    terminalClass: "provider_error",
    friendly: "上游服务繁忙（限流或临时拥塞），已自动退款，请稍后重试。",
  },

  // ── 9. 超时 ──
  {
    id: "timeout",
    matchers: ["timeout", "timed out", "超时"],
    retryable: true,
    terminalClass: "timeout",
    friendly: "生成超时，已自动退款，请稍后重试。",
  },

  // ── 10. 通用上游错误兜底（服务器 5xx / 4xx / internal / upstream / provider）──
  {
    id: "upstream_generic",
    matchers: [
      "upstream",
      "server error",
      "internal",
      "500",
      "服务器",
      "provider",
      "upstream error",
      /\bhttp\s+[45]\d\d\b/i,
    ],
    retryable: true,
    terminalClass: "provider_error",
    friendly: UPSTREAM_GENERIC_FRIENDLY,
  },
];

/** 完全不认识时的最终兜底：保守可重试，让 retry-policy 用 attempts 上限收口。*/
const UNKNOWN_FALLBACK = {
  retryable: true,
  terminalClass: "unknown" as TerminalClass,
  friendly: "生成失败，已自动退款，请稍后重试或联系管理员。",
} as const;

function matchUpstreamErrorPattern(rawMessage: string): ErrorPattern | null {
  const msg = (rawMessage || "").toLowerCase();
  for (const pattern of UPSTREAM_ERROR_PATTERNS) {
    for (const m of pattern.matchers) {
      const hit = typeof m === "string" ? msg.includes(m) : m.test(msg);
      if (hit) return pattern;
    }
  }
  return null;
}

export function classifyVideoProviderFailure(failReason: string): {
  retryable: boolean;
  terminalClass: TerminalClass;
} {
  const matched = matchUpstreamErrorPattern(failReason);
  if (matched) {
    return { retryable: matched.retryable, terminalClass: matched.terminalClass };
  }
  return {
    retryable: UNKNOWN_FALLBACK.retryable,
    terminalClass: UNKNOWN_FALLBACK.terminalClass,
  };
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
 *
 * 实现注记：本函数与 {@link classifyVideoProviderFailure} 共用 `UPSTREAM_ERROR_PATTERNS`
 * 表 —— 新增上游错误形态时只需要往表里加一条，两个出口的行为自动一致。
 */
export function friendlyFailMessage(rawMessage: string): string {
  const matched = matchUpstreamErrorPattern(rawMessage);
  return matched ? matched.friendly : UNKNOWN_FALLBACK.friendly;
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
