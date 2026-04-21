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
// Keep slot-per-tick at 2 because grok2api's POST /v1/videos is synchronous
// (60-90s per video, observed). A tick that submits 3 groups × 3 slots ×
// 90s = 810s would blow past Vercel's 300s maxDuration. 2 slots cap the
// synchronous tail at ~180s and still clear steady-state demand within a
// handful of ticks.
const MAX_BATCH_SLOT_SUBMISSIONS_PER_TICK = 2;
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

/**
 * 按 `index * BATCH_SUBMISSION_STAGGER_MS` 错开子任务起跑时间。
 *
 * 这个函数在 batch-processing.ts 的 Promise.allSettled 并行 map 里被调用，
 * 每个 sub-task 按自己的 index 等待不同时长后才真正开始。第 0 个立即开始，
 * 第 1 个等 1s，第 2 个等 2s，以此类推。这样 N 个并发 task 不会在同一个
 * 毫秒内同时往 provider 创建 N 条请求，从 provider 视角看仍然是有节奏的
 * 提交流。
 *
 * 旧实现是"不管 index 多少都等固定 BATCH_SUBMISSION_STAGGER_MS"，在并行
 * 调用下所有 sub-task 会同一时刻一起跳过 sleep 一起开始，等于没做错峰。
 * 名字和注释也因此骗过 audit 评审。
 */
export async function delayStaggeredSubmission(index: number) {
  if (index <= 0) return;
  await new Promise((resolve) =>
    setTimeout(resolve, index * BATCH_SUBMISSION_STAGGER_MS),
  );
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
