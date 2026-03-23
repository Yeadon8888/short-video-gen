import assert from "node:assert/strict";
import test from "node:test";
import {
  getProviderCapabilities,
  mergeVideoParamsWithModelDefaults,
  normalizeModelDefaultParams,
  resolveVideoProvider,
} from "../../../src/lib/video/service";

test("mergeVideoParamsWithModelDefaults applies admin-configured defaults before request values", () => {
  const merged = mergeVideoParamsWithModelDefaults(
    {
      defaultParams: {
        orientation: "landscape",
        duration: 15,
        count: 3,
      },
    },
    {
      prompt: "A product ad",
      imageUrls: ["https://cdn.example/ref.png"],
      orientation: "portrait",
      duration: 10,
      count: 1,
      model: "veo3.1-fast",
    },
  );

  assert.deepEqual(merged, {
    prompt: "A product ad",
    imageUrls: ["https://cdn.example/ref.png"],
    orientation: "portrait",
    duration: 10,
    count: 1,
    model: "veo3.1-fast",
  });
});

test("mergeVideoParamsWithModelDefaults fills missing request values from admin defaults", () => {
  const merged = mergeVideoParamsWithModelDefaults(
    {
      defaultParams: {
        orientation: "landscape",
        duration: 15,
        count: 5,
      },
    },
    {
      prompt: "A product ad",
      imageUrls: [],
      model: "custom-model",
    },
  );

  assert.deepEqual(merged, {
    prompt: "A product ad",
    imageUrls: [],
    orientation: "landscape",
    duration: 15,
    count: 5,
    model: "custom-model",
  });
});

test("normalizeModelDefaultParams preserves provider-specific params", () => {
  const normalized = normalizeModelDefaultParams({
    duration: 10,
    allowedDurations: [10, 15],
    watermark: false,
    negative_prompt: "blurry",
  });

  assert.deepEqual(normalized, {
    duration: 10,
    allowedDurations: [10, 15],
    watermark: false,
    negative_prompt: "blurry",
  });
});

test("mergeVideoParamsWithModelDefaults keeps provider-specific params for downstream adapters", () => {
  const merged = mergeVideoParamsWithModelDefaults(
    {
      defaultParams: {
        orientation: "portrait",
        duration: 10,
        count: 1,
        watermark: false,
        negative_prompt: "blurry",
      },
    },
    {
      prompt: "A product ad",
      imageUrls: [],
      model: "sora",
    },
  );

  assert.deepEqual(merged, {
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
  });
});

test("resolveVideoProvider selects adapters by model provider", () => {
  assert.equal(resolveVideoProvider("plato").id, "plato");
});

test("resolveVideoProvider rejects unsupported providers", () => {
  assert.throws(
    () => resolveVideoProvider("unknown-provider"),
    /Unsupported video provider/i,
  );
});

test("getProviderCapabilities falls back to configurable defaults when model does not define durations", () => {
  const capabilities = getProviderCapabilities({
    provider: "plato",
    defaultParams: {},
  });

  assert.deepEqual(capabilities.allowedDurations, [8, 10, 15]);
  assert.equal(capabilities.defaultDuration, 10);
});

test("getProviderCapabilities honors admin-configured durations and default duration", () => {
  const capabilities = getProviderCapabilities({
    provider: "plato",
    defaultParams: {
      allowedDurations: [10, 15],
      duration: 15,
    },
  });

  assert.deepEqual(capabilities.allowedDurations, [10, 15]);
  assert.equal(capabilities.defaultDuration, 15);
});
