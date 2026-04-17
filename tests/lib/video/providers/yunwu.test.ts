import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeYunwuBaseUrl,
  yunwuProvider,
} from "../../../../src/lib/video/providers/yunwu";

const baseModel = {
  id: "model_1",
  name: "Yunwu Grok",
  slug: "grok-video-3",
  provider: "yunwu",
  creditsPerGen: 10,
  isActive: true,
  apiKey: "test-key",
  baseUrl: "https://yunwu.ai",
  defaultParams: null,
  sortOrder: 0,
  capability: "video_generation" as const,
};

test("normalizeYunwuBaseUrl keeps host-only values unchanged", () => {
  assert.equal(normalizeYunwuBaseUrl("https://yunwu.ai"), "https://yunwu.ai");
});

test("normalizeYunwuBaseUrl strips pasted create and query endpoints", () => {
  assert.equal(
    normalizeYunwuBaseUrl("https://yunwu.ai/v1/video/create"),
    "https://yunwu.ai",
  );
  assert.equal(
    normalizeYunwuBaseUrl("https://yunwu.ai/v1/video/query"),
    "https://yunwu.ai",
  );
});

test("yunwuProvider creates video tasks with yunwu payload", async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody: Record<string, unknown> | null = null;

  globalThis.fetch = (async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        id: "grok:299604b7-c5ea-47b5-bc64-c06f300f0d27",
        status: "processing",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }) as typeof fetch;

  try {
    const taskIds = await yunwuProvider.createTasks({
      model: baseModel,
      params: {
        prompt: "cat fish --mode=custom",
        imageUrls: ["https://cdn.example/ref.png"],
        orientation: "portrait",
        duration: 10,
        count: 1,
        model: "grok-video-3",
        providerOptions: {
          size: "720P",
        },
      },
    });

    assert.deepEqual(taskIds, ["grok:299604b7-c5ea-47b5-bc64-c06f300f0d27"]);
    assert.deepEqual(capturedBody, {
      model: "grok-video-3",
      prompt: "cat fish --mode=custom",
      aspect_ratio: "2:3",
      duration: 10,
      size: "720P",
      images: ["https://cdn.example/ref.png"],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("yunwuProvider honors admin-configured 8-second durations", () => {
  const capabilities = yunwuProvider.getCapabilities({
    ...baseModel,
    slug: "sora-2",
    defaultParams: {
      duration: 8,
      allowedDurations: [8],
    },
  });

  assert.deepEqual(capabilities.allowedDurations, [8]);
  assert.equal(capabilities.defaultDuration, 8);
});

test("yunwuProvider maps completed tasks with video_url to SUCCESS", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        id: "grok:task_1",
        status: "completed",
        progress: 100,
        video_url: "https://cdn.example/video.mp4",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )) as typeof fetch;

  try {
    const result = await yunwuProvider.queryTaskStatus({
      model: baseModel,
      taskId: "grok:task_1",
    });

    assert.deepEqual(result, {
      taskId: "grok:task_1",
      status: "SUCCESS",
      progress: "100%",
      url: "https://cdn.example/video.mp4",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("yunwuProvider classifies sensitive failures as non-retryable content policy", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        id: "grok:task_sensitive",
        status: "failed",
        error: "提示词敏感，不允许生成",
        progress: 100,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )) as typeof fetch;

  try {
    const result = await yunwuProvider.queryTaskStatus({
      model: baseModel,
      taskId: "grok:task_sensitive",
    });

    assert.equal(result.status, "FAILED");
    assert.equal(result.failReason, "提示词敏感，不允许生成");
    assert.equal(result.retryable, false);
    assert.equal(result.terminalClass, "content_policy");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
