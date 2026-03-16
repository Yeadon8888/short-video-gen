import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { queryTaskStatus, type ApiOverrides } from "@/lib/video/plato";
import { db } from "@/lib/db";
import { tasks, taskItems, models, users, creditTxns } from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

/**
 * GET /api/generate/status?taskIds=id1,id2
 * Poll Sora/VEO task status. Also updates DB task items.
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const taskIdsParam = req.nextUrl.searchParams.get("taskIds") ?? "";
  const providerTaskIds = taskIdsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (providerTaskIds.length === 0) {
    return NextResponse.json({ error: "Missing taskIds" }, { status: 400 });
  }

  // Look up model API overrides from the task's associated model
  let apiOverrides: ApiOverrides = {};
  const [firstItem] = await db
    .select()
    .from(taskItems)
    .where(inArray(taskItems.providerTaskId, providerTaskIds))
    .limit(1);
  if (firstItem) {
    const [parentTask] = await db
      .select({ modelId: tasks.modelId })
      .from(tasks)
      .where(eq(tasks.id, firstItem.taskId))
      .limit(1);
    if (parentTask?.modelId) {
      const [modelRow] = await db
        .select({ apiKey: models.apiKey, baseUrl: models.baseUrl })
        .from(models)
        .where(eq(models.id, parentTask.modelId))
        .limit(1);
      if (modelRow) {
        apiOverrides = { apiKey: modelRow.apiKey, baseUrl: modelRow.baseUrl };
      }
    }
  }

  const results = await Promise.all(
    providerTaskIds.map(async (taskId) => {
      try {
        const result = await queryTaskStatus(taskId, apiOverrides);

        // Update task item in DB
        await db
          .update(taskItems)
          .set({
            status: result.status,
            progress: result.progress,
            resultUrl: result.url,
            failReason: result.failReason,
            ...(result.status === "SUCCESS" || result.status === "FAILED"
              ? { completedAt: new Date() }
              : {}),
          })
          .where(eq(taskItems.providerTaskId, taskId));

        return result;
      } catch {
        return { taskId, status: "UNKNOWN", progress: "0%" };
      }
    }),
  );

  const allDone = results.every(
    (r) => r.status === "SUCCESS" || r.status === "FAILED",
  );

  // If all tasks are done, update the parent task status
  if (allDone) {
    const [firstItem] = await db
      .select()
      .from(taskItems)
      .where(inArray(taskItems.providerTaskId, providerTaskIds))
      .limit(1);

    if (firstItem) {
      const allItems = await db
        .select()
        .from(taskItems)
        .where(eq(taskItems.taskId, firstItem.taskId));

      const successCount = allItems.filter((i) => i.status === "SUCCESS").length;
      const failedCount = allItems.filter((i) => i.status === "FAILED").length;
      const totalCount = allItems.length;
      const hasAnySuccess = successCount > 0;
      const successUrls = allItems
        .filter((i) => i.status === "SUCCESS" && i.resultUrl)
        .map((i) => i.resultUrl!);

      // Get parent task for credit calculation
      const [parentTask] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, firstItem.taskId))
        .limit(1);

      // Calculate per-item cost and refund for failed items
      const perItemCost = parentTask && totalCount > 0
        ? Math.floor(parentTask.creditsCost / totalCount)
        : 0;
      const refundAmount = failedCount * perItemCost;
      const actualCost = parentTask ? parentTask.creditsCost - refundAmount : 0;

      // Atomically update task status — only if still in an active state.
      // This prevents double-processing by concurrent status polls or cron.
      const [updated] = await db
        .update(tasks)
        .set({
          status: hasAnySuccess ? "done" : "failed",
          resultUrls: successUrls,
          creditsCost: hasAnySuccess ? actualCost : 0,
          completedAt: new Date(),
          ...(!hasAnySuccess
            ? { errorMessage: "视频生成失败，积分已自动退还" }
            : failedCount > 0
              ? { errorMessage: `${successCount}/${totalCount} 成功，失败部分积分已退还` }
              : {}),
        })
        .where(
          and(
            eq(tasks.id, firstItem.taskId),
            inArray(tasks.status, ["pending", "analyzing", "generating", "polling"]),
          ),
        )
        .returning({ id: tasks.id });

      // Only refund if we actually transitioned the task (prevents double refund)
      if (updated && refundAmount > 0 && parentTask) {
        await db
          .update(users)
          .set({ credits: sql`${users.credits} + ${refundAmount}` })
          .where(eq(users.id, parentTask.userId));

        const [u] = await db
          .select({ credits: users.credits })
          .from(users)
          .where(eq(users.id, parentTask.userId))
          .limit(1);

        await db.insert(creditTxns).values({
          userId: parentTask.userId,
          type: "refund",
          amount: refundAmount,
          reason: hasAnySuccess
            ? `部分失败退款 (${failedCount}/${totalCount} 失败)`
            : `生成失败自动退款`,
          taskId: parentTask.id,
          balanceAfter: u?.credits ?? 0,
        });
      }
    }
  }

  return NextResponse.json({ results, allDone });
}
