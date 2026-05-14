import assert from "node:assert/strict";
import test from "node:test";
import {
  decideSubmissionFailureOutcome,
  SUBMISSION_RETRY_BUDGET_MS,
} from "../../../src/lib/tasks/retry-policy";

// 时间常量：让测试用例的意图更明显
const T_NOW = new Date("2026-05-14T19:46:00Z");
const T_SLOT_FRESH = new Date(T_NOW.getTime() - 30_000); // 30 秒前创建
const T_SLOT_OLD = new Date(T_NOW.getTime() - (SUBMISSION_RETRY_BUDGET_MS + 60_000)); // 11 分钟前
const T_DEADLINE_FUTURE = new Date(T_NOW.getTime() + 2 * 60 * 60_000); // +2h
const T_DEADLINE_PAST = new Date(T_NOW.getTime() - 60_000); // 1 分钟前

test("non-retryable error (e.g., privacy/real-person) → terminate immediately, regardless of budget", () => {
  const outcome = decideSubmissionFailureOutcome({
    rawMessage:
      "Volc302NonRetryableError: InputImageSensitiveContentDetected.PrivacyInformation",
    slotCreatedAt: T_SLOT_FRESH, // 还很新
    deliveryDeadlineAt: T_DEADLINE_FUTURE,
    now: T_NOW,
  });
  assert.equal(outcome.kind, "terminate_failed");
  if (outcome.kind === "terminate_failed") {
    assert.equal(outcome.terminationReason, "non_retryable");
    assert.equal(outcome.retryable, false);
    assert.equal(outcome.terminalClass, "content_policy");
    assert.match(outcome.lastFailReason, /真人|隐私|人像/);
    assert.doesNotMatch(outcome.lastFailReason, /InputImage|PrivacyInformation/);
  }
});

test("retryable error + delivery deadline already past → terminate (deadline outranks budget)", () => {
  const outcome = decideSubmissionFailureOutcome({
    rawMessage: "Stream idle timeout after 60.0s",
    slotCreatedAt: T_SLOT_FRESH,
    deliveryDeadlineAt: T_DEADLINE_PAST,
    now: T_NOW,
  });
  assert.equal(outcome.kind, "terminate_failed");
  if (outcome.kind === "terminate_failed") {
    assert.equal(outcome.terminationReason, "deadline_expired");
    assert.equal(outcome.retryable, true);
    assert.equal(outcome.terminalClass, "provider_error");
  }
});

test("retryable error + slot already 11 min old → terminate (budget_expired)", () => {
  const outcome = decideSubmissionFailureOutcome({
    rawMessage: "Video upstream returned 429",
    slotCreatedAt: T_SLOT_OLD,
    deliveryDeadlineAt: T_DEADLINE_FUTURE,
    now: T_NOW,
  });
  assert.equal(outcome.kind, "terminate_failed");
  if (outcome.kind === "terminate_failed") {
    assert.equal(outcome.terminationReason, "budget_expired");
    assert.equal(outcome.retryable, true);
    assert.match(outcome.lastFailReason, /繁忙|限流|稍后重试/);
    assert.doesNotMatch(outcome.lastFailReason, /429|upstream/);
  }
});

test("retryable error + slot fresh + deadline future → retry_pending", () => {
  const outcome = decideSubmissionFailureOutcome({
    rawMessage: "Error: HTTP 502 Bad Gateway",
    slotCreatedAt: T_SLOT_FRESH,
    deliveryDeadlineAt: T_DEADLINE_FUTURE,
    now: T_NOW,
  });
  assert.equal(outcome.kind, "retry_pending");
  if (outcome.kind === "retry_pending") {
    assert.equal(outcome.retryable, true);
    assert.equal(outcome.terminalClass, "provider_error");
    assert.match(outcome.lastFailReason, /提交失败.*重试/);
    // 用户层文案脱敏，不能泄露 HTTP / 502
    assert.doesNotMatch(outcome.lastFailReason, /HTTP|502|Bad Gateway/);
  }
});

test("unknown error (default-retryable) on fresh slot → retry_pending", () => {
  const outcome = decideSubmissionFailureOutcome({
    rawMessage: "totally unknown gibberish xyz",
    slotCreatedAt: T_SLOT_FRESH,
    deliveryDeadlineAt: T_DEADLINE_FUTURE,
    now: T_NOW,
  });
  assert.equal(outcome.kind, "retry_pending");
  if (outcome.kind === "retry_pending") {
    assert.equal(outcome.terminalClass, "unknown");
  }
});

test("budget boundary: exactly 10 min still retryable (must be > 10 min to terminate)", () => {
  const slotCreatedAt = new Date(T_NOW.getTime() - SUBMISSION_RETRY_BUDGET_MS);
  const outcome = decideSubmissionFailureOutcome({
    rawMessage: "Video upstream returned 429",
    slotCreatedAt,
    deliveryDeadlineAt: T_DEADLINE_FUTURE,
    now: T_NOW,
  });
  assert.equal(outcome.kind, "retry_pending");
});

test("budget boundary: 10 min + 1 ms → terminate (budget_expired)", () => {
  const slotCreatedAt = new Date(T_NOW.getTime() - SUBMISSION_RETRY_BUDGET_MS - 1);
  const outcome = decideSubmissionFailureOutcome({
    rawMessage: "Video upstream returned 429",
    slotCreatedAt,
    deliveryDeadlineAt: T_DEADLINE_FUTURE,
    now: T_NOW,
  });
  assert.equal(outcome.kind, "terminate_failed");
  if (outcome.kind === "terminate_failed") {
    assert.equal(outcome.terminationReason, "budget_expired");
  }
});

test("priority: non-retryable beats budget_expired (don't waste even 1 retry on hopeless case)", () => {
  const outcome = decideSubmissionFailureOutcome({
    // 11 分钟前的 slot + non-retryable error → 应该报 non_retryable 而不是 budget_expired
    rawMessage: "InputImageSensitiveContentDetected",
    slotCreatedAt: T_SLOT_OLD,
    deliveryDeadlineAt: T_DEADLINE_FUTURE,
    now: T_NOW,
  });
  assert.equal(outcome.kind, "terminate_failed");
  if (outcome.kind === "terminate_failed") {
    assert.equal(outcome.terminationReason, "non_retryable");
  }
});

test("priority: deadline_expired beats budget_expired when both apply", () => {
  const outcome = decideSubmissionFailureOutcome({
    rawMessage: "Video upstream returned 429",
    slotCreatedAt: T_SLOT_OLD,
    deliveryDeadlineAt: T_DEADLINE_PAST,
    now: T_NOW,
  });
  assert.equal(outcome.kind, "terminate_failed");
  if (outcome.kind === "terminate_failed") {
    assert.equal(outcome.terminationReason, "deadline_expired");
  }
});

// 防御性测试：避免未来重构把 elapsed 改成 Math.abs 之类，导致时钟漂移
// 反而触发 budget_expired 误终止
test("clock drift: now < slotCreatedAt (elapsedMs negative) → retry, not budget_expired", () => {
  const slotInFuture = new Date(T_NOW.getTime() + 60_000); // 服务器/Worker 间时钟偏差 1 分钟
  const outcome = decideSubmissionFailureOutcome({
    rawMessage: "Video upstream returned 429",
    slotCreatedAt: slotInFuture,
    deliveryDeadlineAt: T_DEADLINE_FUTURE,
    now: T_NOW,
  });
  assert.equal(outcome.kind, "retry_pending");
});
