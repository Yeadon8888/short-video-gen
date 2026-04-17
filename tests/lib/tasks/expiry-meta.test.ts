import assert from "node:assert/strict";
import test from "node:test";
import {
  computeVideoExpiryDate,
  getDaysUntilVideoExpiry,
  shouldShowVideoExpiryCountdown,
  VIDEO_EXPIRY_DAYS,
} from "../../../src/lib/tasks/expiry-meta";

test("computeVideoExpiryDate adds the configured expiry window", () => {
  const createdAt = new Date("2026-03-31T00:00:00.000Z");
  const expiry = computeVideoExpiryDate(createdAt);

  assert.equal(
    expiry.toISOString(),
    new Date(
      createdAt.getTime() + VIDEO_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString(),
  );
});

test("getDaysUntilVideoExpiry rounds up remaining partial days", () => {
  const createdAt = "2026-03-31T00:00:00.000Z";
  const now = new Date("2026-04-01T12:00:00.000Z");

  assert.equal(getDaysUntilVideoExpiry(createdAt, now), 2);
});

test("shouldShowVideoExpiryCountdown only shows for terminal tasks with successful videos", () => {
  assert.equal(shouldShowVideoExpiryCountdown({ status: "done", successCount: 1 }), true);
  assert.equal(shouldShowVideoExpiryCountdown({ status: "failed", successCount: 1 }), true);
  assert.equal(shouldShowVideoExpiryCountdown({ status: "generating", successCount: 1 }), false);
  assert.equal(shouldShowVideoExpiryCountdown({ status: "done", successCount: 0 }), false);
});
