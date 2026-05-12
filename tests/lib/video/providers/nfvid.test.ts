import assert from "node:assert/strict";
import test from "node:test";
import {
  nfvidProvider,
  normalizeNfvidBaseUrl,
} from "../../../../src/lib/video/providers/nfvid";
import type { VideoModelRecord } from "../../../../src/lib/video/service";

const baseModel: VideoModelRecord = {
  id: "model_1",
  name: "Sora 2 Pro 12s 9:16",
  slug: "sora2-pro-12s-9x16",
  provider: "nfvid",
  creditsPerGen: 10,
  isActive: true,
  apiKey: "test-key",
  baseUrl: "https://api.nfvid.vip",
  defaultParams: {
    duration: 12,
    allowedDurations: [12],
    group: "vip",
  },
  sortOrder: 0,
  capability: "video_generation" as const,
};

test("normalizeNfvidBaseUrl keeps host-only values unchanged", () => {
  assert.equal(
    normalizeNfvidBaseUrl("https://api.nfvid.vip"),
    "https://api.nfvid.vip",
  );
});

test("normalizeNfvidBaseUrl strips pasted videos endpoints", () => {
  assert.equal(
    normalizeNfvidBaseUrl("https://api.nfvid.vip/v1/videos"),
    "https://api.nfvid.vip",
  );
  assert.equal(
    normalizeNfvidBaseUrl("https://api.nfvid.vip/v1/videos/task_123/content"),
    "https://api.nfvid.vip",
  );
});

test("nfvidProvider creates video tasks with multimodal payload", async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody: Record<string, unknown> | null = null;

  globalThis.fetch = (async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return new Response(JSON.stringify({ id: "task_123" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const result = await nfvidProvider.createTasks({
      model: baseModel,
      params: {
        prompt: "animate this character walking forward",
        imageUrls: ["https://cdn.example/character.png"],
        orientation: "portrait",
        duration: 12,
        count: 1,
        model: "sora2-pro-12s-9x16",
        providerOptions: {
          group: "vip",
          stream: false,
        },
      },
    });

    assert.deepEqual(result.providerTaskIds, ["task_123"]);
    assert.deepEqual(capturedBody, {
      model: "sora2-pro-12s-9x16",
      group: "vip",
      stream: false,
      prompt: "animate this character walking forward",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "animate this character walking forward" },
            {
              type: "image_url",
              image_url: { url: "https://cdn.example/character.png" },
            },
          ],
        },
      ],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("nfvidProvider maps active status response", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ id: "task_123", status: "processing", progress: 42 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  try {
    const result = await nfvidProvider.queryTaskStatus({
      model: baseModel,
      taskId: "task_123",
    });

    assert.deepEqual(result, {
      taskId: "task_123",
      status: "PROCESSING",
      progress: "42%",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("nfvidProvider returns content endpoint fallback for successful tasks", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.endsWith("/content")) {
      return new Response("video-bytes", {
        status: 200,
        headers: { "Content-Type": "video/mp4" },
      });
    }
    return new Response(JSON.stringify({ id: "task_123", status: "completed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const result = await nfvidProvider.queryTaskStatus({
      model: baseModel,
      taskId: "task_123",
    });

    assert.equal(result.status, "SUCCESS");
    assert.equal(result.progress, "100%");
    assert.equal(result.url, "https://api.nfvid.vip/v1/videos/task_123/content");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("nfvidProvider classifies failed status response", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(JSON.stringify({
      id: "task_123",
      status: "failed",
      error: {
        code: "task_failed",
        message: "video poll failed: 451 {\"error_code\":\"video_unsafe\"}",
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  try {
    const result = await nfvidProvider.queryTaskStatus({
      model: baseModel,
      taskId: "task_123",
    });

    assert.equal(result.status, "FAILED");
    assert.equal(result.retryable, false);
    assert.equal(result.terminalClass, "content_policy");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
