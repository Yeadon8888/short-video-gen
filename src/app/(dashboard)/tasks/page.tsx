export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { taskGroups, tasks } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { TaskList } from "./TaskList";

export default async function TasksPage() {
  const auth = await requireAuth();
  if (auth instanceof Response) return null; // 401
  const user = auth.user;

  const userTasks = await db
    .select({
      id: tasks.id,
      userId: tasks.userId,
      taskGroupId: tasks.taskGroupId,
      type: tasks.type,
      status: tasks.status,
      modelId: tasks.modelId,
      inputText: tasks.inputText,
      videoSourceUrl: tasks.videoSourceUrl,
      soraPrompt: tasks.soraPrompt,
      scriptJson: tasks.scriptJson,
      resultUrls: tasks.resultUrls,
      resultAssetKeys: tasks.resultAssetKeys,
      creditsCost: tasks.creditsCost,
      paramsJson: tasks.paramsJson,
      errorMessage: tasks.errorMessage,
      scheduledAt: tasks.scheduledAt,
      createdAt: tasks.createdAt,
      completedAt: tasks.completedAt,
      fulfillmentMode: tasks.fulfillmentMode,
      requestedCount: tasks.requestedCount,
      successfulCount: tasks.successfulCount,
      startedAt: tasks.startedAt,
      deliveryDeadlineAt: tasks.deliveryDeadlineAt,
      // Match /api/tasks/refresh: queue position for ASAP-queued scheduled tasks.
      queueAhead: sql<number>`
        CASE WHEN ${tasks.status} = 'scheduled' AND ${tasks.scheduledAt} IS NULL
          THEN (SELECT COUNT(*)::int FROM ${tasks} t2
                WHERE t2.status = 'scheduled' AND t2.scheduled_at IS NULL
                  AND t2.model_id = ${tasks.modelId}
                  AND t2.created_at < ${tasks.createdAt})
          ELSE 0
        END
      `.as("queue_ahead"),
    })
    .from(tasks)
    .where(and(eq(tasks.userId, user.id), isNull(tasks.taskGroupId)))
    .orderBy(desc(tasks.createdAt))
    .limit(50);

  const userTaskGroups = await db
    .select()
    .from(taskGroups)
    .where(eq(taskGroups.userId, user.id))
    .orderBy(desc(taskGroups.createdAt))
    .limit(30);

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
      <h1 className="text-lg font-bold text-white sm:text-xl">任务历史</h1>
      <TaskList initialTasks={userTasks} initialTaskGroups={userTaskGroups} />
    </div>
  );
}
