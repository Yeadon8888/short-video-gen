import assert from "node:assert/strict";
import test from "node:test";
import { friendlyFailMessage } from "../../../../src/lib/video/providers/shared";

test("friendlyFailMessage maps Volcengine real-person error to 真人/隐私 message", () => {
  const raw = `Volc302NonRetryableError: HTTP 400: {"error":{"code":"InputImageSensitiveContentDetected.PrivacyInformation","message":"The request failed because the input image may contain real person. Request id: xxx","type":"BadRequest"}}`;
  const friendly = friendlyFailMessage(raw);
  assert.match(friendly, /真人|隐私|人像/);
  assert.doesNotMatch(friendly, /HTTP|Request id|BadRequest|InputImage/);
});

test("friendlyFailMessage hides 302 upstream quota numbers, redirects to admin", () => {
  const raw = `Error: HTTP 403: 预扣费额度失败,用户[101432]剩余额度:(8.827680,需要预扣费额度: 14.000000`;
  const friendly = friendlyFailMessage(raw);
  assert.match(friendly, /联系管理员/);
  assert.doesNotMatch(friendly, /101432|8\.82|14\.00|预扣费|剩余额度/);
});

test("friendlyFailMessage maps content_unsafe to sensitive-content message", () => {
  const raw = `video poll failed: 451 {"error_code":"video_unsafe"}`;
  const friendly = friendlyFailMessage(raw);
  assert.match(friendly, /敏感|违规/);
});

test("friendlyFailMessage maps timeout to retry hint", () => {
  assert.match(friendlyFailMessage("Error: operation timeout after 240s"), /超时/);
});

test("friendlyFailMessage maps user balance to charging hint", () => {
  assert.match(friendlyFailMessage("余额不足，请充值"), /余额|配额/);
});

test("friendlyFailMessage falls back gracefully on unknown errors", () => {
  const friendly = friendlyFailMessage("completely unknown gibberish xyz");
  assert.match(friendly, /生成失败|联系管理员|退款/);
});

test("friendlyFailMessage never leaks raw HTTP status codes or stack frames", () => {
  const raw = "TypeError: Cannot read property 'foo' of undefined\n    at /app/whatever.js:42:13";
  const friendly = friendlyFailMessage(raw);
  assert.doesNotMatch(friendly, /TypeError|\/app\/|:\d+:\d+/);
});
