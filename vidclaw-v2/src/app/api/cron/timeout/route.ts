import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, taskItems, users, creditTxns, models } from "@/lib/db/schema";
import { eq, and, inArray, lte, sql } from "drizzle-orm";
import { queryTaskStatus, type ApiOverrides } from "@/lib/video/plato";

const TIMEOUT_MINUTES = 60;

/**
 * GET /api/cron/timeout — Check stuck tasks and auto-refund.
 * Protected by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000);

  // Find tasks stuck in generating/polling/analyzing for > 60 minutes
  const stuckTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        inArray(tasks.status, ["generating", "polling", "analyzing"]),
        lte(tasks.createdAt, cutoff),
      ),
    )
    .limit(50);

  if (stuckTasks.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let refunded = 0;
  let resolved = 0;

  for (const task of stuckTasks) {
    // Check provider status for each task item
    const items = await db
      .select()
      .from(taskItems)
      .where(eq(taskItems.taskId, task.id));

    let apiOverrides: ApiOverrides = {};
    if (task.modelId) {
      const [modelRow] = await db
        .select({ apiKey: models.apiKey, baseUrl: models.baseUrl })
        .from(models)
        .where(eq(models.id, task.modelId))
        .limit(1);
      if (modelRow) apiOverrides = { apiKey: modelRow.apiKey, baseUrl: modelRow.baseUrl };
    }

    let hasSuccess = false;
    const successUrls: string[] = [];

    for (const item of items) {
      if (!item.providerTaskId) continue;
      try {
        const result = await queryTaskStatus(item.providerTaskId, apiOverrides);
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

        if (result.status === "SUCCESS" && result.url) {
          hasSuccess = true;
          successUrls.push(result.url);
        }
      } catch {
        // If provider query fails, treat as failed
      }
    }

    if (hasSuccess) {
      // Some videos succeeded — mark done, no refund.
      // Atomic: only update if still in active state (prevents double-processing).
      await db
        .update(tasks)
        .set({ status: "done", resultUrls: successUrls, completedAt: new Date() })
        .where(
          and(
            eq(tasks.id, task.id),
            inArray(tasks.status, ["generating", "polling", "analyzing"]),
          ),
        );
      resolved++;
    } else {
      // All failed or still stuck — mark failed and refund credits.
      // Atomic: only update if still active (prevents double refund).
      const [updated] = await db
        .update(tasks)
        .set({
          status: "failed",
          errorMessage: `超时未完成（>${TIMEOUT_MINUTES}分钟），积分已自动退还`,
          completedAt: new Date(),
        })
        .where(
          and(
            eq(tasks.id, task.id),
            inArray(tasks.status, ["generating", "polling", "analyzing"]),
          ),
        )
        .returning({ id: tasks.id });

      // Only refund if we actually transitioned the task
      if (updated && task.creditsCost > 0) {
        await db
          .update(users)
          .set({ credits: sql`${users.credits} + ${task.creditsCost}` })
          .where(eq(users.id, task.userId));

        // Get current balance for txn record
        const [u] = await db
          .select({ credits: users.credits })
          .from(users)
          .where(eq(users.id, task.userId))
          .limit(1);

        await db.insert(creditTxns).values({
          userId: task.userId,
          type: "refund",
          amount: task.creditsCost,
          reason: `生成超时自动退款 (任务 ${task.id.slice(0, 8)}...)`,
          taskId: task.id,
          balanceAfter: u?.credits ?? 0,
        });

        refunded++;
      }
    }
  }

  return NextResponse.json({
    total: stuckTasks.length,
    resolved,
    refunded,
  });
}
