import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { taskGroups, taskItems, taskSlots, tasks } from "@/lib/db/schema";
import {
  ACTIVE_TASK_STATUSES,
  failTaskAndRefund,
  finalizeTaskIfTerminal,
} from "@/lib/tasks/reconciliation";
import { processPendingBatchTasks } from "@/lib/tasks/batch-processing";
import { getMaxBatchGroupSubmissionsPerTick } from "@/lib/tasks/batch-queue";
import { processDueScheduledTasks } from "@/lib/tasks/scheduled";
import { queryVideoTaskStatus } from "@/lib/video/service";
import {
  advanceSlotOnResult,
  expireDeadlineSlots,
  getActiveProviderTaskIds,
  refillPendingSlotsIfCapacityAvailable,
} from "@/lib/tasks/fulfillment";
import { processTimedOutTasks } from "@/lib/tasks/timeout";

export async function runTaskMaintenance(options?: {
  userId?: string;
  scheduledLimit?: number;
  taskGroupLimit?: number;
  groupProcessLimit?: number;
  activeTaskLimit?: number;
  timeoutLimit?: number;
}) {
  const scheduledResult = await processDueScheduledTasks({
    userId: options?.userId,
    limit: options?.scheduledLimit ?? 3,
  });

  const taskGroupConditions = options?.userId
    ? [eq(taskGroups.userId, options.userId)]
    : [];
  const activeTaskGroups = await db
    .select({
      id: taskGroups.id,
      status: taskGroups.status,
    })
    .from(taskGroups)
    .where(taskGroupConditions.length > 0 ? and(...taskGroupConditions) : undefined)
    .orderBy(desc(taskGroups.createdAt))
    .limit(options?.taskGroupLimit ?? 30);

  let processedGroups = 0;
  for (const group of activeTaskGroups) {
    if (group.status !== "pending" && group.status !== "generating") continue;
    await processPendingBatchTasks({
      taskGroupId: group.id,
      limit: Math.min(
        options?.groupProcessLimit ?? getMaxBatchGroupSubmissionsPerTick(),
        getMaxBatchGroupSubmissionsPerTick(),
      ),
    });
    processedGroups++;
  }

  const taskConditions = options?.userId
    ? [eq(tasks.userId, options.userId)]
    : [];
  const allTasks = await db
    .select()
    .from(tasks)
    .where(taskConditions.length > 0 ? and(...taskConditions) : undefined)
    .orderBy(desc(tasks.createdAt))
    .limit(options?.activeTaskLimit ?? 200);

  const activeTasks = allTasks.filter((task) =>
    (ACTIVE_TASK_STATUSES as readonly string[]).includes(task.status),
  );

  let polledTasks = 0;

  for (const task of activeTasks) {
    if (task.fulfillmentMode === "backfill_until_target") {
      if (task.deliveryDeadlineAt) {
        await expireDeadlineSlots(task.id, task.deliveryDeadlineAt);
      }

      const activeItems = await getActiveProviderTaskIds(task.id);
      for (const { providerTaskId, slotId, itemId } of activeItems) {
        try {
          const result = await queryVideoTaskStatus({
            modelId: task.modelId,
            taskId: providerTaskId,
          });

          await db
            .update(taskItems)
            .set({
              status: result.status,
              progress: result.progress,
              resultUrl: result.url,
              failReason: result.failReason,
              retryable: result.retryable,
              terminalClass: result.terminalClass,
              ...(result.status === "SUCCESS" || result.status === "FAILED"
                ? { completedAt: new Date() }
                : {}),
            })
            .where(eq(taskItems.id, itemId));

          if (result.status === "SUCCESS" || result.status === "FAILED") {
            const [slot] = await db
              .select()
              .from(taskSlots)
              .where(eq(taskSlots.id, slotId))
              .limit(1);

            if (slot) {
              await advanceSlotOnResult({
                task,
                slot,
                itemStatus: result.status as "SUCCESS" | "FAILED",
                resultUrl: result.url,
                failReason: result.failReason,
                retryable: result.retryable,
                terminalClass: result.terminalClass,
              });
            }
          }
        } catch {
          // Provider query failed — skip.
        }
      }

      if (activeItems.length === 0) {
        await refillPendingSlotsIfCapacityAvailable(task.id);
      }

      polledTasks++;
      continue;
    }

    const items = await db
      .select()
      .from(taskItems)
      .where(eq(taskItems.taskId, task.id));

    const pendingItems = items.filter(
      (item) => item.providerTaskId && item.status !== "SUCCESS" && item.status !== "FAILED",
    );
    if (items.length === 0) {
      // Grace period: don't fail tasks created within the last 2 minutes.
      // This prevents a race condition where the runner fires before
      // task_items are fully inserted after provider submission.
      const taskAge = Date.now() - new Date(task.createdAt).getTime();
      if (taskAge < 2 * 60 * 1000) {
        continue;
      }

      const refunded = await failTaskAndRefund({
        taskId: task.id,
        userId: task.userId,
        refundAmount: task.creditsCost,
        errorMessage: "任务未成功提交到视频供应商，积分已自动退还",
        refundReason: "任务提交缺失自动退款",
        allowedStatuses: ACTIVE_TASK_STATUSES,
      });

      if (refunded) {
        polledTasks++;
      }
      continue;
    }

    for (const item of pendingItems) {
      try {
        const result = await queryVideoTaskStatus({
          modelId: task.modelId,
          taskId: item.providerTaskId!,
        });

        await db
          .update(taskItems)
          .set({
            status: result.status,
            progress: result.progress,
            resultUrl: result.url,
            failReason: result.failReason,
            retryable: result.retryable,
            terminalClass: result.terminalClass,
            ...(result.status === "SUCCESS" || result.status === "FAILED"
              ? { completedAt: new Date() }
              : {}),
          })
          .where(eq(taskItems.id, item.id));
      } catch {
        // Provider query failed — skip.
      }
    }

    const updatedItems = await db
      .select()
      .from(taskItems)
      .where(eq(taskItems.taskId, task.id));

    const allItemsDone = updatedItems.length > 0 && updatedItems.every(
      (item) => item.status === "SUCCESS" || item.status === "FAILED",
    );

    if (allItemsDone) {
      await finalizeTaskIfTerminal({
        taskId: task.id,
        userId: task.userId,
        creditsCost: task.creditsCost,
        items: updatedItems,
      });
    }

    polledTasks++;
  }

  const timeoutResult = await processTimedOutTasks({
    userId: options?.userId,
    limit: options?.timeoutLimit ?? 50,
  });

  return {
    scheduledProcessed: scheduledResult.processed,
    batchGroupsProcessed: processedGroups,
    activeTasksPolled: polledTasks,
    timedOutResolved: timeoutResult.resolved,
    timedOutRefunded: timeoutResult.refunded,
  };
}
