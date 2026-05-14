import assert from "node:assert/strict";
import test from "node:test";
import {
  volc302Provider,
  normalizeVolc302BaseUrl,
} from "../../../../src/lib/video/providers/volc302";
import type { VideoModelRecord } from "../../../../src/lib/video/service";

const baseModel: VideoModelRecord = {
  id: "model_volc",
  name: "Seedance 2.0 Fast (302.ai)",
  slug: "doubao-seedance-2-0-fast-260128",
  provider: "volc302",
  creditsPerGen: 4,
  isActive: true,
  apiKey: "sk-test",
  baseUrl: "https://api.302.ai",
  defaultParams: {
    duration: 10,
    allowedDurations: [4, 8, 10, 12, 15],
  },
  sortOrder: 0,
  capability: "video_generation" as const,
};

test("normalizeVolc302BaseUrl keeps host-only values", () => {
  assert.equal(
    normalizeVolc302BaseUrl("https://api.302.ai"),
    "https://api.302.ai",
  );
});

test("normalizeVolc302BaseUrl strips pasted endpoint paths", () => {
  assert.equal(
    normalizeVolc302BaseUrl("https://api.302.ai/volcengine/api/v3/contents/generations/tasks"),
    "https://api.302.ai",
  );
  assert.equal(
    normalizeVolc302BaseUrl("https://api.302.ai/volcengine/api/v3/contents/generations/tasks/cgt-xxx"),
    "https://api.302.ai",
  );
});

test("volc302Provider.createTasks posts correct payload + extracts task_id", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedBody: Record<string, unknown> | null = null;

  globalThis.fetch = (async (input, init) => {
    capturedUrl = String(input);
    capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return new Response(JSON.stringify({ id: "cgt-20260514-test" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const result = await volc302Provider.createTasks({
      model: baseModel,
      params: {
        prompt: "Show this product from multiple angles",
        imageUrls: ["https://cdn.example/product.jpg"],
        orientation: "portrait",
        duration: 10,
        count: 1,
        model: "doubao-seedance-2-0-fast-260128",
      },
    });

    assert.equal(
      capturedUrl,
      "https://api.302.ai/volcengine/api/v3/contents/generations/tasks",
    );
    assert.deepEqual(result.providerTaskIds, ["cgt-20260514-test"]);
    assert.equal(capturedBody?.model, "doubao-seedance-2-0-fast-260128");
    assert.equal(capturedBody?.duration, 10);
    assert.equal(capturedBody?.ratio, "9:16");
    assert.equal(capturedBody?.generate_audio, true);
    assert.equal(capturedBody?.watermark, false);
    assert.ok(Array.isArray(capturedBody?.content), "content must be array");
    const content = capturedBody?.content as unknown[];
    assert.equal((content[0] as { type: string }).type, "text");
    assert.equal((content[1] as { type: string }).type, "image_url");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("volc302Provider.queryTaskStatus returns SUCCESS with video URL on succeeded", async () => {
  const originalFetch = globalThis.fetch;
  const UPSTREAM_URL = "https://tos.example/signed.mp4?sig=abc";

  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.includes("/volcengine/api/v3/contents/generations/tasks/cgt-")) {
      return new Response(
        JSON.stringify({
          id: "cgt-xxx",
          status: "succeeded",
          content: { video_url: UPSTREAM_URL },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    // Rehost path (only hit when upload gateway env is configured)
    if (url === UPSTREAM_URL) {
      return new Response(new Uint8Array([0, 0, 0, 1]), {
        status: 200,
        headers: { "Content-Type": "video/mp4" },
      });
    }
    return new Response("nf", { status: 404 });
  }) as typeof fetch;

  try {
    const result = await volc302Provider.queryTaskStatus({
      model: baseModel,
      taskId: "cgt-xxx",
    });
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.progress, "100%");
    // In test env without UPLOAD_API_URL configured, rehost falls back to the
    // upstream URL; in prod the URL would be a rehosted R2 URL. Both are valid.
    assert.ok(result.url, "url required on success");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("volc302Provider.createTasks remaps slug via default_params.upstream_model", async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody: Record<string, unknown> | null = null;

  globalThis.fetch = (async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return new Response(JSON.stringify({ id: "cgt-remap-test" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await volc302Provider.createTasks({
      // DB slug differs from upstream model — slug guarantees uniqueness in DB,
      // upstream_model in defaultParams maps it back to the real model id.
      model: {
        ...baseModel,
        slug: "doubao-seedance-2-0-fast-260128-302",
        defaultParams: {
          ...baseModel.defaultParams,
          upstream_model: "doubao-seedance-2-0-fast-260128",
        },
      },
      params: {
        prompt: "test",
        imageUrls: ["https://cdn.example/a.jpg"],
        orientation: "portrait",
        duration: 10,
        count: 1,
        model: "doubao-seedance-2-0-fast-260128-302",
        providerOptions: {
          upstream_model: "doubao-seedance-2-0-fast-260128",
        },
      },
    });

    // Payload's "model" should be the upstream id, NOT the DB slug.
    assert.equal(capturedBody?.model, "doubao-seedance-2-0-fast-260128");
    // upstream_model must NOT leak into the payload (internal mapping field).
    assert.equal(capturedBody?.upstream_model, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("volc302Provider.queryTaskStatus maps active status (running)", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ id: "cgt-x", status: "running" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  try {
    const result = await volc302Provider.queryTaskStatus({
      model: baseModel,
      taskId: "cgt-x",
    });
    assert.equal(result.status, "RUNNING");
    assert.equal(result.progress, "0%");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("volc302Provider.queryTaskStatus maps failed status to FAILED", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        id: "cgt-x",
        status: "failed",
        error: { code: "content_unsafe", message: "video flagged as unsafe" },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;

  try {
    const result = await volc302Provider.queryTaskStatus({
      model: baseModel,
      taskId: "cgt-x",
    });
    assert.equal(result.status, "FAILED");
    assert.equal(result.retryable, false);
    assert.equal(result.terminalClass, "content_policy");
    assert.match(result.failReason ?? "", /unsafe/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("volc302Provider.queryTaskStatus maps HTTP 404 task-not-found to terminal FAILED", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = (async () => {
    fetchCount += 1;
    return new Response(
      JSON.stringify({ error: { message: "task not found", code: "not_found" } }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const result = await volc302Provider.queryTaskStatus({
      model: baseModel,
      taskId: "cgt-gone",
    });
    assert.equal(result.status, "FAILED");
    assert.equal(result.retryable, false);
    assert.equal(result.terminalClass, "provider_error");
    assert.equal(fetchCount, 1, "should not retry definitive 404 not-found");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("inferVolc302Capabilities respects configured allowedDurations + duration", () => {
  // Indirect test via getCapabilities — we don't import the util directly to
  // keep the surface narrow and adapter-focused.
  const caps = volc302Provider.getCapabilities({
    ...baseModel,
    defaultParams: { duration: 10, allowedDurations: [4, 8, 10, 12, 15] },
  });
  assert.deepEqual(caps.allowedDurations, [4, 8, 10, 12, 15]);
  assert.equal(caps.defaultDuration, 10);
});

test("inferVolc302Capabilities falls back to [10] when defaultParams missing", () => {
  const caps = volc302Provider.getCapabilities({
    ...baseModel,
    defaultParams: {},
  });
  assert.deepEqual(caps.allowedDurations, [10]);
  assert.equal(caps.defaultDuration, 10);
});
