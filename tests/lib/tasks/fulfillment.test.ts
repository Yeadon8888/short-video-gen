import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveSlotSubmissionClaim,
  resolveSubmittedSlotSuccessReconciliation,
} from "../../../src/lib/tasks/fulfillment";

test("submitted slot adopts linked successful task item", () => {
  const update = resolveSubmittedSlotSuccessReconciliation(
    { id: "slot-1", status: "submitted" },
    {
      id: "item-1",
      slotId: "slot-1",
      status: "SUCCESS",
      resultUrl: "https://example.com/video.mp4",
    },
  );

  assert.deepEqual(update, {
    status: "success",
    resultUrl: "https://example.com/video.mp4",
    winnerItemId: "item-1",
  });
});

test("pending slot also adopts an already persisted successful task item", () => {
  const update = resolveSubmittedSlotSuccessReconciliation(
    { id: "slot-1", status: "pending" },
    {
      id: "item-1",
      slotId: "slot-1",
      status: "SUCCESS",
      resultUrl: "https://example.com/video.mp4",
    },
  );

  assert.deepEqual(update, {
    status: "success",
    resultUrl: "https://example.com/video.mp4",
    winnerItemId: "item-1",
  });
});

test("submitted slot ignores non-success item for resubmission safety", () => {
  const update = resolveSubmittedSlotSuccessReconciliation(
    { id: "slot-1", status: "submitted" },
    {
      id: "item-1",
      slotId: "slot-1",
      status: "FAILED",
      resultUrl: "https://example.com/video.mp4",
    },
  );

  assert.equal(update, null);
});

test("slot submission claim advances attempts only from claimable states", () => {
  assert.deepEqual(
    resolveSlotSubmissionClaim({ status: "pending", attemptCount: 0 }),
    { previousAttemptCount: 0, nextAttemptNo: 1 },
  );
  assert.deepEqual(
    resolveSlotSubmissionClaim({ status: "submitted", attemptCount: 1 }),
    { previousAttemptCount: 1, nextAttemptNo: 2 },
  );
  assert.equal(resolveSlotSubmissionClaim({ status: "success", attemptCount: 1 }), null);
  assert.equal(resolveSlotSubmissionClaim({ status: "failed", attemptCount: 3 }), null);
});
