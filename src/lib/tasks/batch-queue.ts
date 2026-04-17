const MAX_BATCH_GROUP_SUBMISSIONS_PER_TICK = 2;
const MAX_BATCH_SLOT_SUBMISSIONS_PER_TICK = 2;
const BATCH_SUBMISSION_STAGGER_MS = 2_000;

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
