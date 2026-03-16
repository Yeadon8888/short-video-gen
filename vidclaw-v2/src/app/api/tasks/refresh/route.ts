import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { queryTaskStatus, type ApiOverrides } from "@/lib/video/plato";
import { db } from "@/lib/db";
import {
  tasks,
  taskItems,
  models,
  users,
  creditTxns,
} from "@/lib/db/schema";
import { eq, desc, and, inArray, sql } from "drizzle-orm";

const ACTIVE_STATUSES = ["pending", "analyzing", "generating", "polling"] as const;

/**
 * GET /api/tasks/refresh
 *
 * Returns user tasks. For any task in an active status, polls the provider
 * for the latest status and updates the DB before responding.
 * This ensures the tasks page shows accurate state even when the user
 * didn't stay on the generate page to finish polling.
 */
export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  // Fetch all user tasks
  let userTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, user.id))
    .orderBy(desc(tasks.createdAt))
    .limit(50);

  // Find tasks that are still active
  const activeTasks = userTasks.filter((t) =>
    (ACTIVE_STATUSES as readonly string[]).includes(t.status),
  );

  // For each active task, poll its sub-task items from the provider
  for (const task of activeTasks) {
    const items = await db
      .select()
      .from(taskItems)
      .where(eq(taskItems.taskId, task.id));

    // Skip tasks with no sub-items (e.g. still in analyzing stage)
    const pendingItems = items.filter(
      (i) => i.providerTaskId && i.status !== "SUCCESS" && i.status !== "FAILED",
    );
    if (pendingItems.length === 0 && items.length === 0) continue;

    // Resolve model API overrides
    let apiOverrides: ApiOverrides = {};
    if (task.modelId) {
      const [modelRow] = await db
        .select({ apiKey: models.apiKey, baseUrl: models.baseUrl })
        .from(models)
        .where(eq(models.id, task.modelId))
        .limit(1);
      if (modelRow) {
        apiOverrides = { apiKey: modelRow.apiKey, baseUrl: modelRow.baseUrl };
      }
    }

    // Poll each pending item
    for (const item of pendingItems) {
      try {
        const result = await queryTaskStatus(item.providerTaskId!, apiOverrides);
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
          .where(eq(taskItems.id, item.id));
      } catch {
        // Provider query failed — skip this item
      }
    }

    // Re-fetch items to check if all are done
    const updatedItems = await db
      .select()
      .from(taskItems)
      .where(eq(taskItems.taskId, task.id));

    const allItemsDone = updatedItems.length > 0 && updatedItems.every(
      (i) => i.status === "SUCCESS" || i.status === "FAILED",
    );

    if (allItemsDone) {
      const successCount = updatedItems.filter((i) => i.status === "SUCCESS").length;
      const failedCount = updatedItems.filter((i) => i.status === "FAILED").length;
      const totalCount = updatedItems.length;
      const successUrls = updatedItems
        .filter((i) => i.status === "SUCCESS" && i.resultUrl)
        .map((i) => i.resultUrl!);
      const hasAnySuccess = successCount > 0;

      // Calculate refund for failed items
      const perItemCost =
        totalCount > 0 ? Math.floor(task.creditsCost / totalCount) : 0;
      const refundAmount = failedCount * perItemCost;
      const actualCost = task.creditsCost - refundAmount;

      // Use atomic status update to prevent double-processing:
      // Only update if the task is still in an active state.
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
            eq(tasks.id, task.id),
            inArray(tasks.status, [...ACTIVE_STATUSES]),
          ),
        )
        .returning({ id: tasks.id });

      // Only refund if we actually updated the task (prevents double refund)
      if (updated && refundAmount > 0) {
        await db
          .update(users)
          .set({ credits: sql`${users.credits} + ${refundAmount}` })
          .where(eq(users.id, user.id));

        const [u] = await db
          .select({ credits: users.credits })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);

        await db.insert(creditTxns).values({
          userId: user.id,
          type: "refund",
          amount: refundAmount,
          reason: hasAnySuccess
            ? `部分失败退款 (${failedCount}/${totalCount} 失败)`
            : `生成失败自动退款`,
          taskId: task.id,
          balanceAfter: u?.credits ?? 0,
        });
      }

      // Full failure — refund entire cost
      if (updated && !hasAnySuccess && task.creditsCost > 0 && refundAmount === 0) {
        // Edge case: perItemCost rounds to 0 but creditsCost > 0
        await db
          .update(users)
          .set({ credits: sql`${users.credits} + ${task.creditsCost}` })
          .where(eq(users.id, user.id));

        const [u] = await db
          .select({ credits: users.credits })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);

        await db.insert(creditTxns).values({
          userId: user.id,
          type: "refund",
          amount: task.creditsCost,
          reason: `生成失败自动退款`,
          taskId: task.id,
          balanceAfter: u?.credits ?? 0,
        });
      }
    }
  }

  // Re-fetch the final task list
  if (activeTasks.length > 0) {
    userTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, user.id))
      .orderBy(desc(tasks.createdAt))
      .limit(50);
  }

  return NextResponse.json({ tasks: userTasks });
}
