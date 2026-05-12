import { and, asc, eq, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { models, tasks } from "@/lib/db/schema";
import { failTaskAndRefund } from "@/lib/tasks/reconciliation";
import { insertTaskItemsFromSubmission } from "@/lib/tasks/items";
import { createVideoTasksForModelId } from "@/lib/video/service";
import type { VideoDuration } from "@/lib/video/types";
import {
  GROK_DRAIN_BUDGET_PER_TICK,
  GROK_PER_USER_FAIRNESS_CAP,
  computeDrainBudget,
  getGrokPoolCapacity,
  getGrokPoolUsageRecent2h,
  pickQueueDrainCandidates,
} from "@/lib/video/providers/grok-pool";
import { delayStaggeredSubmission } from "@/lib/tasks/batch-queue";

const SCHEDULED_DEFAULT_DURATION: VideoDuration = 10;

function isVideoDuration(value: unknown): value is VideoDuration {
  return (
    value === 4 ||
    value === 5 ||
    value === 6 ||
    value === 8 ||
    value === 10 ||
    value === 15
  );
}

function normalizeScheduledDuration(value: unknown): VideoDuration {
  return isVideoDuration(value) ? value : SCHEDULED_DEFAULT_DURATION;
}

export const SCHEDULED_BATCH_LIMIT = 20;

/**
 * 推进所有"到点的"和"ASAP 排队的" scheduled 任务。
 *
 * 两种语义共享 status='scheduled':
 *   - scheduled_at IS NULL  → ASAP 队列，受 grok2api 池容量 + 公平规则约束
 *   - scheduled_at <= NOW() → 指定时间到点（admin/内部 fallback 路径）
 *
 * 池容量算法见 grok-pool.ts。
 * 并发 tick 安全：SELECT...FOR UPDATE SKIP LOCKED 让重叠 tick 看到不同行。
 */
export async function processDueScheduledTasks(options?: {
  userId?: string;
  limit?: number;
}) {
  // ─── 分支 A: 老语义"到点定时" — 不变 ────────────────────────────────
  const now = new Date();
  const fixedDueLimit = options?.limit ?? SCHEDULED_BATCH_LIMIT;
  const dueFilters = [
    eq(tasks.status, "scheduled"),
    lte(tasks.scheduledAt, now),
  ];
  if (options?.userId) dueFilters.push(eq(tasks.userId, options.userId));

  const dueScheduled = await db
    .select()
    .from(tasks)
    .where(and(...dueFilters))
    .orderBy(asc(tasks.scheduledAt), asc(tasks.createdAt))
    .limit(fixedDueLimit);

  // ─── 分支 B: 新语义"ASAP 队列" — grok2api 池容量驱动 ─────────────
  const capacity = await getGrokPoolCapacity();
  const poolUsed = await getGrokPoolUsageRecent2h();
  const budget = computeDrainBudget({
    poolUsed,
    capacity,
    maxPerTick: GROK_DRAIN_BUDGET_PER_TICK,
  });

  let asapPicked: typeof dueScheduled = [];
  if (budget > 0) {
    // 候选池：scheduled_at IS NULL 且 model.provider = grok2api
    const candidates = await db
      .select({
        id: tasks.id,
        userId: tasks.userId,
        createdAt: tasks.createdAt,
      })
      .from(tasks)
      .innerJoin(models, eq(models.id, tasks.modelId))
      .where(
        and(
          eq(tasks.status, "scheduled"),
          isNull(tasks.scheduledAt),
          eq(models.provider, "grok2api"),
          ...(options?.userId ? [eq(tasks.userId, options.userId)] : []),
        ),
      )
      .orderBy(asc(tasks.createdAt))
      .limit(budget * 5); // pull more than budget to allow fairness reordering

    const pickedIds = pickQueueDrainCandidates(candidates, {
      budget,
      fairnessCap: GROK_PER_USER_FAIRNESS_CAP,
    });

    if (pickedIds.length > 0) {
      // Atomic claim with SKIP LOCKED — wrap in a transaction so the row lock
      // held between SELECT-for-update and UPDATE survives. Concurrent ticks
      // pulling the same id slice see the locked rows as "skip" and pick
      // disjoint sets.
      asapPicked = await db.transaction(async (tx) => {
        const locked = await tx
          .select({ id: tasks.id })
          .from(tasks)
          .where(
            and(
              inArray(tasks.id, pickedIds),
              eq(tasks.status, "scheduled"),
              isNull(tasks.scheduledAt),
            ),
          )
          .for("update", { skipLocked: true });

        if (locked.length === 0) return [];

        // 队列任务在提交时已经跑过 Gemini analyze 阶段（见 /api/generate
        // 里的 Step 2/3），所以直接转 'generating'，跟老 scheduled 路径一致，
        // 不重新走 analyzing。
        return await tx
          .update(tasks)
          .set({
            status: "generating",
            errorMessage: null,
          })
          .where(
            inArray(
              tasks.id,
              locked.map((r) => r.id),
            ),
          )
          .returning();
      });
    }
  }

  // ─── 提交 (parallel fan-out, 复用 stagger) ─────────────────────────────
  const allClaimed = [...dueScheduled, ...asapPicked];
  if (allClaimed.length === 0) return { processed: 0, total: 0, errors: [] };

  let processed = 0;
  const errors: string[] = [];

  // dueScheduled 路径仍然要 atomic claim（老逻辑），ASAP 路径已经在事务里 claim 过。
  const results = await Promise.allSettled(
    allClaimed.map(async (task, index) => {
      // 老路径任务还没有 atomic claim，需要重新 claim 一遍
      let claimedTask = task;
      const needsClaim = task.scheduledAt !== null; // due-time 路径
      if (needsClaim) {
        const [c] = await db
          .update(tasks)
          .set({ status: "generating", scheduledAt: null, errorMessage: null })
          .where(and(eq(tasks.id, task.id), eq(tasks.status, "scheduled")))
          .returning();
        if (!c) return; // 已被并发 tick 抢走
        claimedTask = c;
      }

      await delayStaggeredSubmission(index);
      try {
        const p = claimedTask.paramsJson as {
          orientation: string;
          duration: number;
          count: number;
          model: string;
          imageUrls?: string[];
        };

        const submitted = await createVideoTasksForModelId({
          modelId: claimedTask.modelId,
          request: {
            prompt: claimedTask.soraPrompt ?? "",
            imageUrls: p?.imageUrls ?? [],
            orientation:
              (p?.orientation as "portrait" | "landscape") ?? "portrait",
            duration: normalizeScheduledDuration(p?.duration),
            count: p?.count ?? 1,
            model: p?.model ?? "",
          },
        });

        await insertTaskItemsFromSubmission({
          taskId: claimedTask.id,
          providerTaskIds: submitted.providerTaskIds,
          immediateResults: submitted.immediateResults,
        });
        processed += 1;
      } catch (e) {
        errors.push(`Task ${claimedTask.id}: ${String(e).slice(0, 200)}`);
        await failTaskAndRefund({
          taskId: claimedTask.id,
          userId: claimedTask.userId,
          refundAmount: claimedTask.creditsCost,
          errorMessage: String(e).slice(0, 500),
          refundReason: "队列任务提交失败自动退款",
          allowedStatuses: ["analyzing", "generating"],
        });
      }
    }),
  );

  for (const r of results) {
    if (r.status === "rejected") {
      errors.push(String(r.reason).slice(0, 200));
    }
  }

  return { processed, total: allClaimed.length, errors };
}
