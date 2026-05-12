import { and, eq, gt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { models, taskItems, tasks, systemConfig } from "@/lib/db/schema";

export {
  estimateQueueWaitMinutes,
  type WaitEstimateInput,
} from "./grok-pool-shared";

/** Grok Super 账号 7 × 50 quota / 2h = 350. Admin 改账号数时改 system_config. */
export const GROK_POOL_CAPACITY_DEFAULT = 350;
/** 单 tick drain 上限. 5 tasks × ~90s parallel ≈ 90s wall clock < 300s Vercel. */
export const GROK_DRAIN_BUDGET_PER_TICK = 5;
/** 单用户队列里前 N 条 FIFO 优先；第 N+1 起降权让位散户. */
export const GROK_PER_USER_FAIRNESS_CAP = 10;

export const GROK_POOL_CAPACITY_CONFIG_KEY = "grok.pool_capacity_per_2h";

export interface DrainBudgetInput {
  poolUsed: number;
  capacity: number;
  maxPerTick: number;
}

export function computeDrainBudget(input: DrainBudgetInput): number {
  const remaining = Math.max(0, input.capacity - input.poolUsed);
  return Math.min(remaining, input.maxPerTick);
}

export interface QueuedTaskRef {
  id: string;
  userId: string;
  createdAt: Date;
}

export interface PickerOptions {
  budget: number;
  fairnessCap: number;
}

export function pickQueueDrainCandidates(
  candidates: QueuedTaskRef[],
  opts: PickerOptions,
): string[] {
  const userCounters = new Map<string, number>();
  // 标注每条任务"在自己用户队列中的位次" (FIFO)
  const sortedByFifo = [...candidates].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const annotated = sortedByFifo.map((t) => {
    const pos = (userCounters.get(t.userId) ?? 0) + 1;
    userCounters.set(t.userId, pos);
    return { task: t, userPos: pos };
  });
  // 两段：前 N 条用户内 = tier 0，第 N+1 起 = tier 1；同 tier 内仍 FIFO
  annotated.sort((a, b) => {
    const tierA = a.userPos <= opts.fairnessCap ? 0 : 1;
    const tierB = b.userPos <= opts.fairnessCap ? 0 : 1;
    if (tierA !== tierB) return tierA - tierB;
    return a.task.createdAt.getTime() - b.task.createdAt.getTime();
  });
  return annotated.slice(0, opts.budget).map((a) => a.task.id);
}

/**
 * 读取 system_config 里 admin 配置的池容量。缺失则用 default 350。
 */
export async function getGrokPoolCapacity(): Promise<number> {
  const [row] = await db
    .select({ value: systemConfig.value })
    .from(systemConfig)
    .where(eq(systemConfig.key, GROK_POOL_CAPACITY_CONFIG_KEY))
    .limit(1);
  if (!row) return GROK_POOL_CAPACITY_DEFAULT;
  const v = row.value;
  if (typeof v === "number" && v > 0) return Math.floor(v);
  if (typeof v === "object" && v && typeof (v as { value?: unknown }).value === "number") {
    const n = (v as { value: number }).value;
    if (n > 0) return Math.floor(n);
  }
  return GROK_POOL_CAPACITY_DEFAULT;
}

/**
 * 算最近 2 小时 grok2api 已占用的 quota slot 数 = 非 FAILED 的 task_items 计数。
 * 这是 grok 滑动 2h 窗口下池子"已用"的真实测度。
 */
export async function getGrokPoolUsageRecent2h(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(taskItems)
    .innerJoin(tasks, eq(tasks.id, taskItems.taskId))
    .innerJoin(models, eq(models.id, tasks.modelId))
    .where(
      and(
        eq(models.provider, "grok2api"),
        gt(taskItems.createdAt, sql`NOW() - INTERVAL '2 hours'`),
        ne(taskItems.status, "FAILED"),
      ),
    );
  return Number(row?.n ?? 0);
}
