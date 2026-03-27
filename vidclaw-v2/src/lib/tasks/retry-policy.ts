import type { TerminalClass } from "@/lib/video/types";

export const FULFILLMENT_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours
export const MAX_ATTEMPTS_PER_SLOT = 5;

export interface RetryDecision {
  shouldRetry: boolean;
  reason: string;
}

/**
 * Decide whether a failed slot should be retried.
 *
 * Rules (in priority order):
 * 1. Non-retryable terminal class → never retry
 * 2. Exceeded max attempts → stop
 * 3. Past delivery deadline → stop
 * 4. Otherwise → retry
 */
export function shouldRetrySlot(params: {
  retryable: boolean;
  terminalClass: TerminalClass;
  attemptCount: number;
  deliveryDeadlineAt: Date;
  now?: Date;
}): RetryDecision {
  const { retryable, terminalClass, attemptCount, deliveryDeadlineAt } = params;
  const now = params.now ?? new Date();

  if (!retryable) {
    return {
      shouldRetry: false,
      reason: `terminal class "${terminalClass}" is not retryable`,
    };
  }

  if (attemptCount >= MAX_ATTEMPTS_PER_SLOT) {
    return {
      shouldRetry: false,
      reason: `max attempts (${MAX_ATTEMPTS_PER_SLOT}) reached`,
    };
  }

  if (now >= deliveryDeadlineAt) {
    return {
      shouldRetry: false,
      reason: "delivery deadline expired",
    };
  }

  return { shouldRetry: true, reason: "eligible for retry" };
}

/**
 * Compute the delivery deadline given a task start time.
 */
export function computeDeliveryDeadline(startedAt: Date): Date {
  return new Date(startedAt.getTime() + FULFILLMENT_WINDOW_MS);
}
