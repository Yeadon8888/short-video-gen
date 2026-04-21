/**
 * task_items insertion helpers shared by all callers of createVideoTasks.
 *
 * Centralizes the "if the adapter handed us an immediate result, write the
 * task_item as already SUCCESS instead of pending poll" logic, so synchronous
 * providers (grok2api chat-completions) and async providers behave uniformly
 * from the perspective of the caller.
 */
import { db } from "@/lib/db";
import { taskItems } from "@/lib/db/schema";
import type { TaskStatusResult } from "@/lib/video/types";

export interface InsertItemsParams {
  taskId: string;
  providerTaskIds: string[];
  immediateResults?: (TaskStatusResult | null)[] | undefined;
  /** When set, populated on every inserted row (used by backfill slot mode). */
  slotId?: string;
  /** Attempt number within slot (1-based). null = standard mode. */
  attemptNo?: number | null;
}

export async function insertTaskItemsFromSubmission(params: InsertItemsParams) {
  for (let i = 0; i < params.providerTaskIds.length; i++) {
    const providerTaskId = params.providerTaskIds[i];
    const immediate = params.immediateResults?.[i] ?? null;
    const isTerminalSuccess = immediate?.status === "SUCCESS" && Boolean(immediate.url);

    await db.insert(taskItems).values({
      taskId: params.taskId,
      slotId: params.slotId ?? null,
      attemptNo: params.attemptNo ?? null,
      providerTaskId,
      status: isTerminalSuccess ? "SUCCESS" : "PENDING",
      progress: isTerminalSuccess ? "100%" : "0%",
      resultUrl: isTerminalSuccess ? immediate!.url : null,
      completedAt: isTerminalSuccess ? new Date() : null,
    });
  }
}
