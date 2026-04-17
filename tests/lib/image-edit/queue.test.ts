import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_CONCURRENT_ASSET_TRANSFORMS,
  resolveAssetTransformAvailableSlots,
} from "../../../src/lib/image-edit/queue";

test("resolveAssetTransformAvailableSlots fills remaining capacity up to max concurrency", () => {
  const slots = resolveAssetTransformAvailableSlots({
    processingCount: 1,
    requestedCount: 5,
  });

  assert.equal(slots, MAX_CONCURRENT_ASSET_TRANSFORMS - 1);
});

test("resolveAssetTransformAvailableSlots returns zero when queue is already full", () => {
  const slots = resolveAssetTransformAvailableSlots({
    processingCount: MAX_CONCURRENT_ASSET_TRANSFORMS,
    requestedCount: 2,
  });

  assert.equal(slots, 0);
});

test("resolveAssetTransformAvailableSlots never returns less than one for a valid idle request", () => {
  const slots = resolveAssetTransformAvailableSlots({
    processingCount: 0,
    requestedCount: 1,
  });

  assert.equal(slots, 1);
});
