import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveModelSelectionPatch,
  type GenerateModelOption,
} from "../../../src/components/generate/model-selection";

const MODELS: GenerateModelOption[] = [
  {
    slug: "sora",
    name: "Sora",
    provider: "plato",
    creditsPerGen: 10,
    allowedDurations: [10, 15],
    defaultDuration: 10,
  },
  {
    slug: "veo3.1-fast",
    name: "VEO 3.1 Fast",
    provider: "plato",
    creditsPerGen: 5,
    allowedDurations: [8],
    defaultDuration: 8,
  },
];

test("resolveModelSelectionPatch selects the first backend model when no model is chosen yet", () => {
  const patch = resolveModelSelectionPatch(MODELS, {
    model: "",
    duration: 8,
  });

  assert.deepEqual(patch, {
    model: "sora",
    duration: 10,
  });
});

test("resolveModelSelectionPatch corrects invalid durations using backend capabilities", () => {
  const patch = resolveModelSelectionPatch(MODELS, {
    model: "sora",
    duration: 8,
  });

  assert.deepEqual(patch, {
    duration: 10,
  });
});

test("resolveModelSelectionPatch leaves valid backend-driven selections untouched", () => {
  const patch = resolveModelSelectionPatch(MODELS, {
    model: "sora",
    duration: 15,
  });

  assert.equal(patch, null);
});

test("resolveModelSelectionPatch returns null when no models are available", () => {
  const patch = resolveModelSelectionPatch([], {
    model: "",
    duration: 10,
  });

  assert.equal(patch, null);
});
