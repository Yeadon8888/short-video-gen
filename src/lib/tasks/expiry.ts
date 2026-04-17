import { and, eq, isNotNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { taskGroups, tasks } from "@/lib/db/schema";
import { deleteAsset } from "@/lib/storage/gateway";
import { VIDEO_EXPIRY_DAYS } from "@/lib/tasks/expiry-meta";
import { recomputeTaskGroupSummary } from "@/lib/tasks/groups";

function computeExpiryCutoff(now = new Date()) {
  return new Date(now.getTime() - VIDEO_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

export async function expireGeneratedVideos(options?: {
  limit?: number;
}) {
  const limit = options?.limit ?? 100;
  const cutoff = computeExpiryCutoff();

  const expirableTasks = await db
    .select({
      id: tasks.id,
      userId: tasks.userId,
      taskGroupId: tasks.taskGroupId,
      resultAssetKeys: tasks.resultAssetKeys,
    })
    .from(tasks)
    .where(
      and(
        or(eq(tasks.status, "done"), eq(tasks.status, "failed")),
        lt(tasks.createdAt, cutoff),
        isNotNull(tasks.completedAt),
        sql`jsonb_array_length(coalesce(${tasks.resultUrls}, '[]'::jsonb)) > 0`,
      ),
    )
    .limit(limit);

  if (expirableTasks.length === 0) {
    return {
      total: 0,
      expired: 0,
      groupIds: [] as string[],
    };
  }

  const touchedGroupIds = new Set<string>();

  for (const task of expirableTasks) {
    for (const key of task.resultAssetKeys ?? []) {
      if (!key) continue;
      await deleteAsset(task.userId, key).catch(() => undefined);
    }

    await db
      .update(tasks)
      .set({
        resultUrls: [],
        resultAssetKeys: [],
        errorMessage: "视频文件已过期清理，请在 3 天内及时下载保存。",
      })
      .where(eq(tasks.id, task.id));

    if (task.taskGroupId) {
      touchedGroupIds.add(task.taskGroupId);
    }
  }

  for (const groupId of touchedGroupIds) {
    await recomputeTaskGroupSummary(groupId);
  }

  const staleGroups = await db
    .select({ id: taskGroups.id })
    .from(taskGroups)
    .where(lt(taskGroups.createdAt, cutoff))
    .limit(limit);

  for (const group of staleGroups) {
    await db
      .update(taskGroups)
      .set({
        errorMessage: "本任务组的视频文件已过期清理，请在 3 天内及时下载保存。",
      })
      .where(eq(taskGroups.id, group.id));
  }

  return {
    total: expirableTasks.length,
    expired: expirableTasks.length,
    groupIds: [...touchedGroupIds],
  };
}
