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

test("nfvidProvider treats HTTP 400 task_not_exist as terminal non-retryable failure", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;

  globalThis.fetch = (async () => {
    fetchCount += 1;
    return new Response(
      JSON.stringify({ code: "task_not_exist", message: "task_not_exist", data: null }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const result = await nfvidProvider.queryTaskStatus({
      model: baseModel,
      taskId: "task_gone",
    });

    // Upstream lost the task — runner should mark failed + refund.
    assert.equal(result.status, "FAILED");
    assert.equal(result.retryable, false);
    assert.equal(result.terminalClass, "provider_error");
    assert.match(result.failReason ?? "", /task_not_exist|丢失/);
    // Must NOT retry — HTTP 400 with task_not_exist is definitively terminal.
    // (Bug: previous code retried 3 times with 3+6=9s wait before bailing.)
    assert.equal(fetchCount, 1, "should not retry non-retryable 400 responses");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("nfvidProvider grok-form dispatch: grok-imagine-video-frames uses multipart /v1/videos with file upload + string seconds", async () => {
  const originalFetch = globalThis.fetch;
  let videosHits = 0;
  let imageFetched = false;
  let capturedFormFields: Record<string, string> = {};
  let capturedHasFile = false;

  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    if (url === "https://cdn.example/product.png") {
      imageFetched = true;
      return new Response(new Uint8Array([255, 216, 255, 224]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      });
    }
    if (url.endsWith("/v1/videos")) {
      videosHits += 1;
      // Capture form fields from FormData body
      const body = init?.body;
      if (body instanceof FormData) {
        for (const [k, v] of body.entries()) {
          if (typeof v === "string") capturedFormFields[k] = v;
          else capturedHasFile = true;   // Blob / File entry
        }
      }
      return new Response(
        JSON.stringify({
          id: "task_grokfrm_abc",
          task_id: "task_grokfrm_abc",
          status: "queued",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  try {
    const result = await nfvidProvider.createTasks({
      model: {
        ...baseModel,
        slug: "grok-imagine-video-frames",
        name: "Grok Imagine Video Frames",
        defaultParams: { duration: 16, allowedDurations: [6, 10, 12, 16, 20] },
      },
      params: {
        prompt: "animate this product",
        imageUrls: ["https://cdn.example/product.png"],
        orientation: "portrait",
        duration: 16,
        count: 1,
        model: "grok-imagine-video-frames",
      },
    });

    assert.equal(imageFetched, true, "must fetch the reference image bytes for multipart upload");
    assert.equal(videosHits, 1, "must hit /v1/videos exactly once");
    assert.equal(capturedHasFile, true, "must include input_reference[] file part");
    assert.equal(capturedFormFields["model"], "grok-imagine-video-frames");
    assert.equal(capturedFormFields["seconds"], "16", "seconds must be string per upstream spec");
    assert.equal(capturedFormFields["size"], "720x1280", "portrait → 720x1280 default size");
    assert.equal(capturedFormFields["resolution_name"], "720p");
    assert.equal(capturedFormFields["preset"], "normal");
    assert.equal(capturedFormFields["prompt"], "animate this product");
    assert.deepEqual(result.providerTaskIds, ["task_grokfrm_abc"]);
    // Async path — NO immediateResults, runner polls
    assert.equal(result.immediateResults, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("nfvidProvider grok-form: landscape orientation picks 1280x720 size by default", async () => {
  const originalFetch = globalThis.fetch;
  let capturedSize = "";

  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    if (url === "https://cdn.example/wide.png") {
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }
    if (url.endsWith("/v1/videos")) {
      const body = init?.body;
      if (body instanceof FormData) {
        capturedSize = String(body.get("size") ?? "");
      }
      return new Response(JSON.stringify({ task_id: "t_x" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("nf", { status: 404 });
  }) as typeof fetch;

  try {
    await nfvidProvider.createTasks({
      model: { ...baseModel, slug: "grok-imagine-video-frames" },
      params: {
        prompt: "x",
        imageUrls: ["https://cdn.example/wide.png"],
        orientation: "landscape",
        duration: 10,
        count: 1,
        model: "grok-imagine-video-frames",
      },
    });
    assert.equal(capturedSize, "1280x720");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("nfvidProvider grok-form: provider_options.size overrides orientation-based default", async () => {
  const originalFetch = globalThis.fetch;
  let capturedSize = "";

  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    if (url === "https://cdn.example/p.jpg") {
      return new Response(new Uint8Array([1]), { status: 200, headers: { "Content-Type": "image/jpeg" } });
    }
    if (url.endsWith("/v1/videos")) {
      const body = init?.body;
      if (body instanceof FormData) capturedSize = String(body.get("size") ?? "");
      return new Response(JSON.stringify({ task_id: "t_y" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("nf", { status: 404 });
  }) as typeof fetch;

  try {
    await nfvidProvider.createTasks({
      model: { ...baseModel, slug: "grok-imagine-video-frames" },
      params: {
        prompt: "x",
        imageUrls: ["https://cdn.example/p.jpg"],
        orientation: "portrait",
        duration: 20,
        count: 1,
        model: "grok-imagine-video-frames",
        providerOptions: { size: "1024x1792" },   // override
      },
    });
    assert.equal(capturedSize, "1024x1792", "explicit size in providerOptions wins");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("nfvidProvider grok-form: missing image throws clear error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("nf", { status: 404 })) as typeof fetch;

  try {
    await assert.rejects(
      nfvidProvider.createTasks({
        model: { ...baseModel, slug: "grok-imagine-video-frames" },
        params: {
          prompt: "test",
          imageUrls: [],   // no images
          orientation: "portrait",
          duration: 10,
          count: 1,
          model: "grok-imagine-video-frames",
        },
      }),
      /requires at least one reference image/,
    );
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
