import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { taskGroups, tasks } from "@/lib/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

/**
 * GET /api/tasks/refresh
 *
 * 纯读接口：返回当前用户的任务和任务组。
 *
 * 历史上这里会同步调用 runTaskMaintenance()，把"用户刷新页面"当成
 * 调度器的一部分——这条路径会让浏览器访问频率 = 维护调度频率，
 * 多开标签 / 爬虫 / SEO 抓取都能放大 provider 调用和 DB 压力。
 *
 * 实际的任务推进靠 Supabase pg_cron 每分钟触发
 * /api/internal/tasks/tick（见 scripts/deploy-supabase-cron.ts）。
 * 这个路由只负责读当前 DB 状态。
 *
 * 如果将来真需要"用户主动戳一下"的能力，单独加 POST /api/tasks/:id/poll
 * 一类的写接口并加节流，不要把副作用塞回读路径。
 */
export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

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
      // NEW: queue position (only meaningful for ASAP-queued scheduled tasks
      // where scheduledAt IS NULL). Counts earlier-queued tasks targeting the
      // same model — each provider queue is independent.
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

  return NextResponse.json(
    { tasks: userTasks, taskGroups: userTaskGroups },
    { headers: { "Cache-Control": "no-store" } },
  );
}
