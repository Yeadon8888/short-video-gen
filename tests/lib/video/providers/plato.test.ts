import assert from "node:assert/strict";
import test from "node:test";
import { normalizePlatoBaseUrl, platoProvider } from "../../../../src/lib/video/providers/plato";

test("normalizePlatoBaseUrl keeps host-only values unchanged", () => {
  assert.equal(
    normalizePlatoBaseUrl("https://api.bltcy.ai"),
    "https://api.bltcy.ai",
  );
});

test("normalizePlatoBaseUrl strips a pasted generations endpoint", () => {
  assert.equal(
    normalizePlatoBaseUrl("https://api.bltcy.ai/v2/videos/generations"),
    "https://api.bltcy.ai",
  );
});

test("normalizePlatoBaseUrl strips a pasted generations status url", () => {
  assert.equal(
    normalizePlatoBaseUrl("https://api.bltcy.ai/v2/videos/generations/task_123"),
    "https://api.bltcy.ai",
  );
});

test("platoProvider forwards provider-specific params like watermark", async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody: Record<string, unknown> | null = null;

  globalThis.fetch = (async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return new Response(JSON.stringify({ task_id: "task_123" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const taskIds = await platoProvider.createTasks({
      model: {
        id: "model_1",
        name: "Sora",
        slug: "sora",
        provider: "plato",
        creditsPerGen: 10,
        isActive: true,
        apiKey: "test-key",
        baseUrl: "https://api.bltcy.ai",
        defaultParams: null,
        sortOrder: 0,
      },
      params: {
        prompt: "A product ad",
        imageUrls: [],
        orientation: "portrait",
        duration: 10,
        count: 1,
        model: "sora",
        providerOptions: {
          watermark: false,
          negative_prompt: "blurry",
        },
      },
    });

    assert.deepEqual(taskIds, ["task_123"]);
    assert.ok(capturedBody);
    const body = capturedBody as Record<string, unknown>;
    assert.equal(body.watermark, false);
    assert.equal(body.negative_prompt, "blurry");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
