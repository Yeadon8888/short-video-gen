// Provider throughput assumptions, 2026-04-20:
//   grok2api — self-hosted Railway proxy w/ its own account pool; bottleneck
//     is proxy CPU and upstream Grok 429, not our client-side cadence. Proxy
//     observed handling 3-4 creates/min without visible degradation.
//   plato/yunwu — third-party SaaS w/ hard per-account QPS limits; keep
//     conservative.
// Since all three share this global knob today, the numbers here are tuned
// to grok2api (the model currently driving batch volume) while still
// staying under plato/yunwu's documented ceilings. If a different model
// becomes the primary, move this knob onto the `models` row (per-model
// throttle — listed in the architecture follow-ups).
const MAX_BATCH_GROUP_SUBMISSIONS_PER_TICK = 3;
const MAX_BATCH_SLOT_SUBMISSIONS_PER_TICK = 3;
const BATCH_SUBMISSION_STAGGER_MS = 1_000;

export function getMaxBatchGroupSubmissionsPerTick() {
  return MAX_BATCH_GROUP_SUBMISSIONS_PER_TICK;
}

export function getMaxBatchSlotSubmissionsPerTick() {
  return MAX_BATCH_SLOT_SUBMISSIONS_PER_TICK;
}

export function getBatchSubmissionStaggerMs() {
  return BATCH_SUBMISSION_STAGGER_MS;
}

export async function delayStaggeredSubmission(index: number) {
  if (index <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, BATCH_SUBMISSION_STAGGER_MS));
}

export async function delayBatchSubmission(index: number) {
  await delayStaggeredSubmission(index);
}

export function resolveRemainingSubmissionCapacity(params: {
  activeCount: number;
  maxConcurrent: number;
  requestedCount?: number;
}) {
  const activeCount = Math.max(0, Math.trunc(params.activeCount));
  const maxConcurrent = Math.max(1, Math.trunc(params.maxConcurrent));
  const requestedCount = Math.max(
    1,
    Math.trunc(params.requestedCount ?? maxConcurrent),
  );

  return Math.max(0, Math.min(maxConcurrent - activeCount, requestedCount));
}
