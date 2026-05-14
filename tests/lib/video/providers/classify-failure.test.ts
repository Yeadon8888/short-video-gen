import assert from "node:assert/strict";
import test from "node:test";
import { classifyVideoProviderFailure } from "../../../../src/lib/video/providers/shared";

// classifyVideoProviderFailure 和 friendlyFailMessage 共用同一份上游错误模式表
// （src/lib/video/providers/shared.ts 里的 UPSTREAM_ERROR_PATTERNS）。
// 这里覆盖 classifier 的 retryable + terminalClass 输出，friendlyFailMessage 的
// 文案断言在 friendly-fail-message.test.ts。

test("real-person privacy image → content_policy, non-retryable", () => {
  const raw = `Volc302NonRetryableError: HTTP 400: {"error":{"code":"InputImageSensitiveContentDetected.PrivacyInformation","message":"The request failed because the input image may contain real person","type":"BadRequest"}}`;
  assert.deepEqual(classifyVideoProviderFailure(raw), {
    retryable: false,
    terminalClass: "content_policy",
  });
});

test("content_unsafe → content_policy, non-retryable", () => {
  assert.deepEqual(classifyVideoProviderFailure(`video poll failed: 451 {"error_code":"video_unsafe"}`), {
    retryable: false,
    terminalClass: "content_policy",
  });
});

test("B2B 预扣费额度 → quota_exceeded, non-retryable (don't waste 5 retries)", () => {
  const raw = `Error: HTTP 403: 预扣费额度失败,用户[101432]剩余额度:(8.827680,需要预扣费额度: 14.000000`;
  assert.deepEqual(classifyVideoProviderFailure(raw), {
    retryable: false,
    terminalClass: "quota_exceeded",
  });
});

test("user 余额不足 → quota_exceeded, non-retryable", () => {
  assert.deepEqual(classifyVideoProviderFailure("余额不足，请充值"), {
    retryable: false,
    terminalClass: "quota_exceeded",
  });
});

test("timeout → timeout, retryable", () => {
  assert.deepEqual(classifyVideoProviderFailure("Error: operation timeout after 240s"), {
    retryable: true,
    terminalClass: "timeout",
  });
});

test("upstream 429 → provider_error, retryable", () => {
  assert.deepEqual(classifyVideoProviderFailure("Video upstream returned 429"), {
    retryable: true,
    terminalClass: "provider_error",
  });
});

test("stream idle timeout → provider_error, retryable (rate-limit-shaped, not timeout)", () => {
  // 注意：消息里含 "timeout"，但语义是 nfvid 的 60s 上游空闲断连，等价于上游拥塞。
  // 必须先于通用 timeout 分支匹配。
  assert.deepEqual(classifyVideoProviderFailure("Stream idle timeout after 60.0s"), {
    retryable: true,
    terminalClass: "provider_error",
  });
});

test("low resolution video → provider_error, retryable", () => {
  assert.deepEqual(
    classifyVideoProviderFailure("Video generation returned low resolution video: 400x736 (blocked width 400)"),
    { retryable: true, terminalClass: "provider_error" },
  );
});

test("video not found → provider_error, retryable", () => {
  // nfvid HTTP 200 + body.error 形态，原本会落到 unknown，应识别为可重试的上游 provider_error。
  assert.deepEqual(
    classifyVideoProviderFailure("Video 'video_d748d63786d1421b90f9fdca6488a240' not found"),
    { retryable: true, terminalClass: "provider_error" },
  );
});

test("invalid_request_error → provider_error, non-retryable", () => {
  assert.deepEqual(classifyVideoProviderFailure("invalid_request_error: image size mismatch"), {
    retryable: false,
    terminalClass: "provider_error",
  });
});

test("HTTP 500 / generic upstream → provider_error, retryable", () => {
  assert.deepEqual(classifyVideoProviderFailure("upstream server error: HTTP 500"), {
    retryable: true,
    terminalClass: "provider_error",
  });
});

test("totally unknown error → unknown, retryable (default safety)", () => {
  assert.deepEqual(classifyVideoProviderFailure("completely unknown gibberish xyz"), {
    retryable: true,
    terminalClass: "unknown",
  });
});
