import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { fetchProductImages, invalidateProductImagesCache } from "../../../src/lib/assets/product-images-client";

afterEach(() => {
  invalidateProductImagesCache();
});

test("fetchProductImages bypasses browser cache for user assets", async () => {
  const calls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input, init });
    return new Response(JSON.stringify({ assets: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await fetchProductImages();
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.init?.cache, "no-store");
});
