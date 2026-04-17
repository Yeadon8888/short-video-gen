import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { taskGroups, taskSlots, tasks } from "@/lib/db/schema";
import { summarizeBatchTaskVideos } from "@/lib/tasks/batch-math";

export function countGroupSuccessVideos(
  childTasks: Array<{
    status: string;
    requestedCount?: number | null;
    resultUrls: string[] | null;
    paramsJson?: {
      count?: number;
      batchUnitsPerProduct?: number;
    } | null;
  }>,
): number {
  return childTasks.reduce((sum, task) => {
    return sum + summarizeBatchTaskVideos(task).successCount;
  }, 0);
}

export function mergeGroupTaskSummaryWithSlotProgress(
  task: {
    status: string;
    requestedCount?: number | null;
    resultUrls: string[] | null;
    paramsJson?: {
      count?: number;
      batchUnitsPerProduct?: number;
    } | null;
  },
  slotSuccessCount: number,
) {
  const summary = summarizeBatchTaskVideos(task);

  if (slotSuccessCount <= summary.successCount) {
    return summary;
  }

  const plannedCount = summary.plannedCount;
  const successCount = Math.min(slotSuccessCount, plannedCount);
  const failedCount = summary.isActive ? 0 : Math.max(0, plannedCount - successCount);

  return {
    ...summary,
    successCount,
    failedCount,
  };
}

export async function recomputeTaskGroupSummary(taskGroupId: string): Promise<void> {
  const [group] = await db
    .select()
    .from(taskGroups)
    .where(eq(taskGroups.id, taskGroupId))
    .limit(1);

  if (!group) return;

  const childTasks = await db
    .select({
      id: tasks.id,
      status: tasks.status,
      requestedCount: tasks.requestedCount,
      errorMessage: tasks.errorMessage,
      resultUrls: tasks.resultUrls,
      paramsJson: tasks.paramsJson,
    })
    .from(tasks)
    .where(eq(tasks.taskGroupId, taskGroupId));

  const slotRows = await db
    .select({
      taskId: taskSlots.taskId,
      status: taskSlots.status,
    })
    .from(taskSlots)
    .innerJoin(tasks, eq(taskSlots.taskId, tasks.id))
    .where(eq(tasks.taskGroupId, taskGroupId));

  const slotSuccessCountByTask = new Map<string, number>();
  for (const row of slotRows) {
    if (row.status !== "success") continue;
    slotSuccessCountByTask.set(
      row.taskId,
      (slotSuccessCountByTask.get(row.taskId) ?? 0) + 1,
    );
  }

  const summaries = childTasks.map((task) =>
    mergeGroupTaskSummaryWithSlotProgress(
      task,
      slotSuccessCountByTask.get(task.id) ?? 0,
    ),
  );
  const successCount = summaries.reduce((sum, summary) => sum + summary.successCount, 0);
  const failedCount = summaries.reduce((sum, summary) => sum + summary.failedCount, 0);
  const activeCount = summaries.filter((summary) => summary.isActive).length;
  const hasAnySuccess = successCount > 0;

  let nextStatus: typeof group.status = "pending";
  let errorMessage: string | null = null;
  let completedAt: Date | null = null;

  if (childTasks.length === 0) {
    nextStatus = "pending";
  } else if (activeCount > 0) {
    nextStatus = "generating";
  } else if (hasAnySuccess) {
    nextStatus = "done";
    completedAt = new Date();
    if (failedCount > 0) {
      errorMessage = `批量任务部分失败：成功 ${successCount} 条，失败 ${failedCount} 条。`;
    }
  } else {
    nextStatus = "failed";
    completedAt = new Date();
    errorMessage =
      childTasks.find((task) => task.errorMessage)?.errorMessage ??
      "批量任务全部失败。";
  }

  await db
    .update(taskGroups)
    .set({
      status: nextStatus,
      successCount,
      failedCount,
      errorMessage,
      completedAt,
    })
    .where(eq(taskGroups.id, taskGroupId));
}
