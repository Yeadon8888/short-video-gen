import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveOpenAiImagesEditTimeoutMs,
  resolveOpenAiImagesEditRetryConfig,
  shouldRetryOpenAiImagesEditError,
} from "../../../src/lib/image-edit/openai-images-edit";

test("gpt-image-2 waits near the fluid function budget instead of aborting at 90 seconds", () => {
  assert.equal(resolveOpenAiImagesEditTimeoutMs({ slug: "gpt-image-2" }), 780_000);
});

test("aborted gpt-image requests are not retried because the provider may keep running", () => {
  const timeoutError = new DOMException("The operation was aborted.", "TimeoutError");

  assert.equal(shouldRetryOpenAiImagesEditError(timeoutError), false);
});

test("gpt-image requests disable HTTP retry to avoid duplicate provider submissions", () => {
  assert.deepEqual(resolveOpenAiImagesEditRetryConfig(), { maxAttempts: 1 });
});
