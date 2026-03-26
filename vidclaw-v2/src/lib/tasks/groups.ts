import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { taskGroups, tasks } from "@/lib/db/schema";

const ACTIVE_STATUSES = new Set([
  "pending",
  "analyzing",
  "generating",
  "polling",
  "scheduled",
]);

export async function recomputeTaskGroupSummary(taskGroupId: string): Promise<void> {
  const [group] = await db
    .select()
    .from(taskGroups)
    .where(eq(taskGroups.id, taskGroupId))
    .limit(1);

  if (!group) return;

  const childTasks = await db
    .select({
      status: tasks.status,
      errorMessage: tasks.errorMessage,
    })
    .from(tasks)
    .where(eq(tasks.taskGroupId, taskGroupId));

  const successCount = childTasks.filter((task) => task.status === "done").length;
  const failedCount = childTasks.filter((task) => task.status === "failed").length;
  const activeCount = childTasks.filter((task) => ACTIVE_STATUSES.has(task.status)).length;

  let nextStatus: typeof group.status = "pending";
  let errorMessage: string | null = null;
  let completedAt: Date | null = null;

  if (childTasks.length === 0) {
    nextStatus = "pending";
  } else if (activeCount > 0) {
    nextStatus = "generating";
  } else if (successCount > 0) {
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
