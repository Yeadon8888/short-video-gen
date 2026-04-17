import assert from "node:assert/strict";
import test from "node:test";
import {
  countGroupSuccessVideos,
  mergeGroupTaskSummaryWithSlotProgress,
} from "../../../src/lib/tasks/groups";
import { summarizeBatchTaskVideos } from "../../../src/lib/tasks/batch-math";

test("countGroupSuccessVideos sums result videos instead of completed task rows", () => {
  const successCount = countGroupSuccessVideos([
    { status: "done", resultUrls: ["https://cdn.example/1.mp4", "https://cdn.example/2.mp4", "https://cdn.example/3.mp4"] },
    { status: "done", resultUrls: ["https://cdn.example/4.mp4", "https://cdn.example/5.mp4", "https://cdn.example/6.mp4"] },
    { status: "done", resultUrls: ["https://cdn.example/7.mp4", "https://cdn.example/8.mp4", "https://cdn.example/9.mp4"] },
  ]);

  assert.equal(successCount, 9);
});

test("countGroupSuccessVideos ignores empty task result arrays", () => {
  const successCount = countGroupSuccessVideos([
    { status: "done", resultUrls: ["https://cdn.example/1.mp4"] },
    { status: "done", resultUrls: [] },
    { status: "failed", resultUrls: null },
  ]);

  assert.equal(successCount, 1);
});

test("summarizeBatchTaskVideos keeps failed video counts on completed tasks", () => {
  const summary = summarizeBatchTaskVideos({
    status: "done",
    requestedCount: 3,
    resultUrls: ["https://cdn.example/1.mp4"],
    paramsJson: { count: 3, batchUnitsPerProduct: 3 },
  });

  assert.deepEqual(summary, {
    plannedCount: 3,
    successCount: 1,
    failedCount: 2,
    isActive: false,
  });
});

test("mergeGroupTaskSummaryWithSlotProgress prefers slot success count while fulfillment is still active", () => {
  const summary = mergeGroupTaskSummaryWithSlotProgress(
    {
      status: "generating",
      requestedCount: 5,
      resultUrls: [],
      paramsJson: { count: 5, batchUnitsPerProduct: 5 },
    },
    3,
  );

  assert.deepEqual(summary, {
    plannedCount: 5,
    successCount: 3,
    failedCount: 0,
    isActive: true,
  });
});
