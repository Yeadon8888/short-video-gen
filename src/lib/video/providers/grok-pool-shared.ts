/**
 * Pure (DB-free) helpers from the grok-pool domain.
 *
 * Lives separately from `grok-pool.ts` so client components (which cannot
 * import `db`) can reuse the queue-wait estimate without pulling `postgres`
 * into the browser bundle.
 *
 * `grok-pool.ts` re-exports these symbols so server-side callers keep their
 * existing import path.
 */

export interface WaitEstimateInput {
  queueAhead: number;
  drainRatePerMin: number;
}

export function estimateQueueWaitMinutes(input: WaitEstimateInput): number {
  if (input.queueAhead <= 0) return 0;
  return Math.ceil(input.queueAhead / input.drainRatePerMin);
}
