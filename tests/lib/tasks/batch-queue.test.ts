import assert from "node:assert/strict";
import test from "node:test";
import {
  getMaxBatchGroupSubmissionsPerTick,
  getMaxBatchSlotSubmissionsPerTick,
  resolveRemainingSubmissionCapacity,
} from "../../../src/lib/tasks/batch-queue";

test("resolveRemainingSubmissionCapacity fills only remaining batch group capacity", () => {
  assert.equal(
    resolveRemainingSubmissionCapacity({
      activeCount: 1,
      maxConcurrent: getMaxBatchGroupSubmissionsPerTick(),
      requestedCount: 5,
    }),
    1,
  );
});

test("resolveRemainingSubmissionCapacity returns zero when batch window is full", () => {
  assert.equal(
    resolveRemainingSubmissionCapacity({
      activeCount: getMaxBatchSlotSubmissionsPerTick(),
      maxConcurrent: getMaxBatchSlotSubmissionsPerTick(),
      requestedCount: 3,
    }),
    0,
  );
});
