import type { TerminalClass } from "@/lib/video/types";
import {
  classifyVideoProviderFailure,
  friendlyFailMessage,
} from "@/lib/video/providers/shared";

export const FULFILLMENT_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours
export const MAX_ATTEMPTS_PER_SLOT = 5;

/**
 * 上限：一条 slot 在"提交阶段"反复失败可以最多撑多久。
 *
 * 提交阶段 = `createVideoTasks` 还没成功（slot 上没有任何 task_items 行）。
 * polling 阶段失败走 {@link shouldRetrySlot} + MAX_ATTEMPTS_PER_SLOT，那是
 * 另一条预算线 —— 因为 polling 失败通常是上游明确拒绝（违规、人脸等），多
 * 试无益；而提交失败大多是基建抖动（429、网络 blip），值得给更宽裕的窗口。
 *
 * 计时基准是 `task_slots.createdAt`（slot 被初始化的时刻），不是首次提交时刻。
 * stagger 误差仅 1-2 秒，对 10 分钟预算可忽略。
 */
export const SUBMISSION_RETRY_BUDGET_MS = 10 * 60 * 1000; // 10 minutes

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

// ─── Submission-stage failure ──────────────────────────────────────────────
//
// 当 `submitSlotAttempt` 的上游调用抛错（或返回 0 个 providerTaskIds）时，
// 我们需要决定：是回到 pending 让下个 tick 重试，还是直接把 slot 标失败。
//
// 历史 bug：旧实现把错误吞了 + 把 attemptCount 回滚到 claim 之前 → 提交
// 阶段失败完全没有上限，只能等 3h deliveryDeadline 兜底。本函数是新出口，
// 把这个决策抽成纯函数方便测试 + 避免再叠补丁。

export type SubmissionFailureOutcome =
  | {
      kind: "retry_pending";
      retryable: true;
      terminalClass: TerminalClass;
      /** 写入 lastFailReason，让前端能看到"上次为什么失败、还在重试" */
      lastFailReason: string;
    }
  | {
      kind: "terminate_failed";
      retryable: boolean;
      terminalClass: TerminalClass;
      /** 写入 lastFailReason，已脱敏 */
      lastFailReason: string;
      /** 终止原因（仅供日志/分析）：non_retryable / deadline_expired / budget_expired */
      terminationReason: "non_retryable" | "deadline_expired" | "budget_expired";
    };

/**
 * Decide what to do when a slot's submission attempt (createVideoTasks) fails.
 *
 * 优先级（从高到低）：
 * 1. 上游分类为 non-retryable（违规、坏图、配额耗尽）→ 立即终止，不浪费预算
 * 2. 任务的 3h delivery deadline 已过 → 终止
 * 3. slot 的 10 分钟提交预算已过 → 终止
 * 4. 否则 → 让下个 tick 重试
 */
export function decideSubmissionFailureOutcome(params: {
  rawMessage: string;
  slotCreatedAt: Date;
  deliveryDeadlineAt: Date;
  now?: Date;
}): SubmissionFailureOutcome {
  const now = params.now ?? new Date();
  const { retryable, terminalClass } = classifyVideoProviderFailure(
    params.rawMessage,
  );
  const friendlyMessage = friendlyFailMessage(params.rawMessage);

  // 1. Non-retryable → terminate immediately (don't burn 10 min on a hopeless case)
  if (!retryable) {
    return {
      kind: "terminate_failed",
      retryable: false,
      terminalClass,
      lastFailReason: friendlyMessage,
      terminationReason: "non_retryable",
    };
  }

  // 2. Delivery deadline already past → terminate
  if (now >= params.deliveryDeadlineAt) {
    return {
      kind: "terminate_failed",
      retryable: true,
      terminalClass,
      lastFailReason: friendlyMessage,
      terminationReason: "deadline_expired",
    };
  }

  // 3. 10-minute submission-stage budget exhausted → terminate
  const elapsedMs = now.getTime() - params.slotCreatedAt.getTime();
  if (elapsedMs > SUBMISSION_RETRY_BUDGET_MS) {
    return {
      kind: "terminate_failed",
      retryable: true,
      terminalClass,
      lastFailReason: friendlyMessage,
      terminationReason: "budget_expired",
    };
  }

  // 4. Keep retrying — let the next tick pick this slot up again
  return {
    kind: "retry_pending",
    retryable: true,
    terminalClass,
    lastFailReason: `提交失败，将自动重试：${friendlyMessage}`,
  };
}
