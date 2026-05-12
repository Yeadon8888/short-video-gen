# Grok2API 容量感知队列 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把闲置的"凌晨 2 点定时"功能改造成 grok2api 池容量感知的自动排队，让瞬时爆发被摊到滑动 2h 窗口内消化，杜绝"账号不够 / 卡住"用户投诉。

**Architecture:** 复用现有 `tasks.status = 'scheduled'` 状态 + `scheduledAt` 列；`scheduledAt=NULL` 表"ASAP 队列"语义，`scheduledAt` 非 NULL 保留老的"指定时间执行"语义（admin fallback）。Drain 走 Postgres `FOR UPDATE SKIP LOCKED` 标准模式，由现有每分钟 pg_cron tick 自动触发。

**Tech Stack:** TypeScript / Next.js 16 App Router / Drizzle ORM / Postgres (Supabase) / `node:test`。

**Spec reference:** [docs/superpowers/specs/2026-05-12-grok-queue-design.md](../specs/2026-05-12-grok-queue-design.md)

---

## File Structure

### 新增文件

| 路径 | 责任 |
|---|---|
| `src/lib/video/providers/grok-pool.ts` | 池容量读取 + 纯函数（drain budget / candidate picking / wait estimate） |
| `tests/lib/video/providers/grok-pool.test.ts` | 上面纯函数的单元测试 |
| `tests/lib/tasks/scheduled-drain.test.ts` | drain candidate 选择规则的单元测试（不打 DB） |

### 修改文件

| 路径 | 改动概要 |
|---|---|
| `src/lib/tasks/scheduled.ts` | drain SQL 加容量过滤 + fairness + SKIP LOCKED |
| `src/app/api/generate/route.ts` | 替换旧 `if (scheduled)` 分支为新池满判断 |
| `src/lib/tasks/batch-processing.ts` | grok2api group 的 `limit` 加池容量上钳 |
| `src/app/(dashboard)/generate/page.tsx` | 删除"凌晨 2 点" checkbox 及相关 conditional |
| `src/app/(dashboard)/tasks/TaskList.tsx` | scheduledAt NULL 时显示"排队中" |
| `src/app/(dashboard)/tasks/[taskId]/page.tsx` | 同上 |
| `src/app/api/tasks/refresh/route.ts` | 在响应里加 `queueAhead` 字段 |
| `src/lib/tasks/CLAUDE.md` | 文档：新队列机制 + admin runbook |
| `vercel.json` | 删除 `/api/cron/scheduled` cron 条目 |

### 删除文件

- `src/app/api/cron/scheduled/route.ts` 及整个 `src/app/api/cron/scheduled/` 目录

---

## Task 1: 池容量读取 + 纯函数模块

**Files:**
- Create: `src/lib/video/providers/grok-pool.ts`
- Test: `tests/lib/video/providers/grok-pool.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/lib/video/providers/grok-pool.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  computeDrainBudget,
  pickQueueDrainCandidates,
  estimateQueueWaitMinutes,
  GROK_POOL_CAPACITY_DEFAULT,
  GROK_DRAIN_BUDGET_PER_TICK,
  GROK_PER_USER_FAIRNESS_CAP,
} from "../../../../src/lib/video/providers/grok-pool";

test("computeDrainBudget returns 0 when pool fully used", () => {
  assert.equal(computeDrainBudget({ poolUsed: 350, capacity: 350, maxPerTick: 5 }), 0);
});

test("computeDrainBudget caps at maxPerTick when capacity is large", () => {
  assert.equal(computeDrainBudget({ poolUsed: 0, capacity: 350, maxPerTick: 5 }), 5);
});

test("computeDrainBudget never returns negative", () => {
  assert.equal(computeDrainBudget({ poolUsed: 400, capacity: 350, maxPerTick: 5 }), 0);
});

test("computeDrainBudget returns remaining when capacity tighter than maxPerTick", () => {
  assert.equal(computeDrainBudget({ poolUsed: 348, capacity: 350, maxPerTick: 5 }), 2);
});

test("pickQueueDrainCandidates returns tasks in FIFO order under fairness cap", () => {
  const tasks = [
    { id: "t1", userId: "u1", createdAt: new Date(1000) },
    { id: "t2", userId: "u2", createdAt: new Date(2000) },
    { id: "t3", userId: "u1", createdAt: new Date(3000) },
  ];
  const picked = pickQueueDrainCandidates(tasks, { budget: 10, fairnessCap: 10 });
  assert.deepEqual(picked, ["t1", "t2", "t3"]);
});

test("pickQueueDrainCandidates demotes tasks beyond per-user cap", () => {
  // u1 has 12 tasks, u2 has 1 task. cap=10 means u1's 11th and 12th are demoted.
  const tasks = [
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `u1-t${i + 1}`,
      userId: "u1",
      createdAt: new Date(1000 + i),
    })),
    { id: "u2-t1", userId: "u2", createdAt: new Date(2000) },
  ];
  const picked = pickQueueDrainCandidates(tasks, { budget: 13, fairnessCap: 10 });
  // First 10 of u1 + u2's 1 task should come before u1's overflow
  assert.equal(picked[10], "u2-t1", "u2 should jump in before u1 overflow");
  assert.deepEqual(picked.slice(11), ["u1-t11", "u1-t12"]);
});

test("pickQueueDrainCandidates respects budget", () => {
  const tasks = [
    { id: "t1", userId: "u1", createdAt: new Date(1000) },
    { id: "t2", userId: "u2", createdAt: new Date(2000) },
  ];
  assert.deepEqual(pickQueueDrainCandidates(tasks, { budget: 1, fairnessCap: 10 }), ["t1"]);
});

test("estimateQueueWaitMinutes rounds up using drain rate", () => {
  assert.equal(estimateQueueWaitMinutes({ queueAhead: 0, drainRatePerMin: 4 }), 0);
  assert.equal(estimateQueueWaitMinutes({ queueAhead: 1, drainRatePerMin: 4 }), 1);
  assert.equal(estimateQueueWaitMinutes({ queueAhead: 4, drainRatePerMin: 4 }), 1);
  assert.equal(estimateQueueWaitMinutes({ queueAhead: 5, drainRatePerMin: 4 }), 2);
});

test("constants have expected defaults", () => {
  assert.equal(GROK_POOL_CAPACITY_DEFAULT, 350);
  assert.equal(GROK_DRAIN_BUDGET_PER_TICK, 5);
  assert.equal(GROK_PER_USER_FAIRNESS_CAP, 10);
});
```

- [ ] **Step 2: 跑测试验证失败**

Run: `npm run test -- tests/lib/video/providers/grok-pool.test.ts`
Expected: FAIL with `Cannot find module '.../grok-pool'`.

- [ ] **Step 3: 实现 `grok-pool.ts`**

Create `src/lib/video/providers/grok-pool.ts`:

```ts
import { and, eq, gt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { models, taskItems, tasks, systemConfig } from "@/lib/db/schema";

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
  tasks: QueuedTaskRef[],
  opts: PickerOptions,
): string[] {
  const userCounters = new Map<string, number>();
  // 标注每条任务"在自己用户队列中的位次" (FIFO)
  const sortedByFifo = [...tasks].sort(
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

export interface WaitEstimateInput {
  queueAhead: number;
  drainRatePerMin: number;
}

export function estimateQueueWaitMinutes(input: WaitEstimateInput): number {
  if (input.queueAhead <= 0) return 0;
  return Math.ceil(input.queueAhead / input.drainRatePerMin);
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
```

- [ ] **Step 4: 跑测试验证通过**

Run: `npm run test -- tests/lib/video/providers/grok-pool.test.ts`
Expected: 所有 8 个 test 通过。

- [ ] **Step 5: TypeCheck**

Run: `npm run lint`
Expected: 无错误（注意 import 路径用 `@/` 别名）。

- [ ] **Step 6: Commit**

```bash
git add src/lib/video/providers/grok-pool.ts tests/lib/video/providers/grok-pool.test.ts
git commit -m "feat(grok-pool): add capacity reader + pure helpers for queue drain"
```

---

## Task 2: 改造 scheduled.ts 的 drain SQL

**Files:**
- Modify: `src/lib/tasks/scheduled.ts` (整文件替换)
- Test: `tests/lib/tasks/scheduled-drain.test.ts` (新增，测纯逻辑而非 SQL)

- [ ] **Step 1: 写 drain candidate 单元测试**（pure function 已在 Task 1 测过，这里只补一个组合测试）

Create `tests/lib/tasks/scheduled-drain.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  computeDrainBudget,
  pickQueueDrainCandidates,
  GROK_POOL_CAPACITY_DEFAULT,
  GROK_DRAIN_BUDGET_PER_TICK,
  GROK_PER_USER_FAIRNESS_CAP,
} from "../../../src/lib/video/providers/grok-pool";

test("drain pipeline: full pipeline with realistic queue", () => {
  // Pool 320 used out of 350 → 30 capacity, but maxPerTick caps it at 5
  const budget = computeDrainBudget({
    poolUsed: 320,
    capacity: GROK_POOL_CAPACITY_DEFAULT,
    maxPerTick: GROK_DRAIN_BUDGET_PER_TICK,
  });
  assert.equal(budget, 5);

  // 3 users, mixed queue depth
  const queue = [
    ...Array.from({ length: 15 }, (_, i) => ({
      id: `u1-${i}`,
      userId: "u1",
      createdAt: new Date(1000 + i),
    })),
    { id: "u2-0", userId: "u2", createdAt: new Date(1005) },
    { id: "u3-0", userId: "u3", createdAt: new Date(1006) },
  ];

  const picked = pickQueueDrainCandidates(queue, {
    budget,
    fairnessCap: GROK_PER_USER_FAIRNESS_CAP,
  });

  // budget=5, so 5 ids back
  assert.equal(picked.length, 5);
  // u2-0 and u3-0 should be in top 5 since u1's 11+ are demoted
  assert.ok(picked.includes("u2-0"));
  assert.ok(picked.includes("u3-0"));
  // u1 should get 3 slots (positions 1-10 are tier 0; budget 5 minus u2+u3 = 3)
  assert.equal(picked.filter((id) => id.startsWith("u1-")).length, 3);
});

test("drain pipeline: empty queue returns empty picks", () => {
  assert.deepEqual(
    pickQueueDrainCandidates([], { budget: 5, fairnessCap: 10 }),
    [],
  );
});
```

- [ ] **Step 2: 跑测试验证通过**（这里测试应该已经过——它只用 Task 1 已实现的纯函数）

Run: `npm run test -- tests/lib/tasks/scheduled-drain.test.ts`
Expected: PASS（这是 Task 1 函数的组合验证，不是新代码）

- [ ] **Step 3: 修改 `src/lib/tasks/scheduled.ts`**

Replace the entire file with:

```ts
import { and, asc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
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
    value === 4 || value === 5 || value === 6 || value === 8 || value === 10 || value === 15
  );
}

function normalizeScheduledDuration(value: unknown): VideoDuration {
  return isVideoDuration(value) ? value : SCHEDULED_DEFAULT_DURATION;
}

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
  const fixedDueLimit = options?.limit ?? 20;
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
      .limit(budget * 5);   // pull more than budget to allow fairness reordering

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
          .where(inArray(tasks.id, locked.map((r) => r.id)))
          .returning();
      });
    }
  }

  // ─── 提交 (parallel fan-out, 复用 stagger) ─────────────────────────────
  const allClaimed = [...dueScheduled, ...asapPicked];
  if (allClaimed.length === 0) return { processed: 0, total: 0, errors: [] };

  let processed = 0;
  const errors: string[] = [];

  // dueScheduled 路径仍然要 atomic claim（老逻辑），未 claim 已用 SKIP LOCKED 模式的不需要重复 claim
  const results = await Promise.allSettled(
    allClaimed.map(async (task, index) => {
      // 老路径任务还没有 atomic claim，需要重新 claim 一遍
      let claimedTask = task;
      const needsClaim = task.scheduledAt !== null;   // due-time 路径
      if (needsClaim) {
        const [c] = await db
          .update(tasks)
          .set({ status: "generating", scheduledAt: null, errorMessage: null })
          .where(and(eq(tasks.id, task.id), eq(tasks.status, "scheduled")))
          .returning();
        if (!c) return;   // 已被并发 tick 抢走
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
            orientation: (p?.orientation as "portrait" | "landscape") ?? "portrait",
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

export const SCHEDULED_BATCH_LIMIT = 20;
```

- [ ] **Step 4: 跑测试 + lint**

Run: `npm run test 2>&1 | tail -20`
Expected: 全部测试通过（包括 scheduled-drain.test.ts 和 grok-pool.test.ts）。

Run: `npm run lint`
Expected: 无错误。

- [ ] **Step 5: Commit**

```bash
git add src/lib/tasks/scheduled.ts tests/lib/tasks/scheduled-drain.test.ts
git commit -m "feat(tasks/scheduled): capacity-aware drain for grok2api ASAP queue"
```

---

## Task 3: 改 `/api/generate/route.ts` 加队列分支

**Files:**
- Modify: `src/app/api/generate/route.ts`

- [ ] **Step 1: 读旧 scheduled 分支的精确位置**

Run:
```bash
grep -n "if (scheduled)" /Users/yeadon_1/Desktop/MyProject/vidclaw-v2/.claude/worktrees/pensive-banach-e58638/src/app/api/generate/route.ts
```
预期: 输出 `302:` 行号。

Run:
```bash
grep -n "scheduled," /Users/yeadon_1/Desktop/MyProject/vidclaw-v2/.claude/worktrees/pensive-banach-e58638/src/app/api/generate/route.ts
```
预期: 输出多个行号包括 ~87 (body parse), ~125 (Boolean(scheduled)).

- [ ] **Step 2: 删除旧 scheduled 分支 + 加新池满判断**

操作分两步：

**(a)** 删 request body 解析里的 `scheduled` 字段（line 87）和 `scheduled: Boolean(scheduled)` log 行（line 125）。Body 里这个字段从此忽略，不报错（前端会自动停止发送，旧客户端兼容）。

**(b)** 把 line 302 开始那段 `if (scheduled) { ... 凌晨2点 ... return; }` 整段替换为下面的新分支：

```ts
// ── Step 4: Check if grok2api pool is saturated → queue ──

if (modelRow?.provider === "grok2api") {
  const { getGrokPoolUsageRecent2h, getGrokPoolCapacity, estimateQueueWaitMinutes } =
    await import("@/lib/video/providers/grok-pool");
  const poolUsed = await getGrokPoolUsageRecent2h();
  const capacity = await getGrokPoolCapacity();

  if (poolUsed + count > capacity) {
    // Queue this task: write status='scheduled' with scheduledAt=NULL
    const taskType = type === "theme" ? "theme" : type === "url" ? "url" : "remix";
    const queuedResult = await db.transaction(async (tx) => {
      const [task] = await tx
        .insert(tasks)
        .values({
          userId: user.id,
          type: taskType as "theme" | "remix" | "url",
          status: "scheduled",
          modelId: modelRow?.id,
          inputText:
            taskType === "remix"
              ? (effectiveCreativeBrief || "视频二创")
              : input,
          videoSourceUrl: type === "url" || type === "video_key" ? input : null,
          soraPrompt,
          scriptJson: scriptResult,
          creditsCost: totalCost,
          scheduledAt: null,   // ASAP queue semantics
          paramsJson: {
            orientation: params.orientation,
            duration: params.duration,
            count,
            platform: params.platform ?? "tiktok",
            outputLanguage: resolvedOutputLanguage,
            model: modelSlug,
            imageUrls: referenceImageUrls,
            sourceMode: effectiveSourceMode,
            creativeBrief: effectiveCreativeBrief,
            selectedImageIds: selectedAssets.map((asset) => asset.id),
            selectedAssets,
          },
        })
        .returning();

      const [deducted] = await tx
        .update(users)
        .set({ credits: sql`${users.credits} - ${totalCost}` })
        .where(and(eq(users.id, user.id), sql`${users.credits} >= ${totalCost}`))
        .returning({ credits: users.credits });

      if (!deducted) {
        await tx
          .update(tasks)
          .set({ status: "failed", errorMessage: "积分不足（并发扣费）" })
          .where(eq(tasks.id, task.id));
        return { task, deducted: null };
      }

      await tx.insert(creditTxns).values({
        userId: user.id,
        type: "consume",
        amount: -totalCost,
        reason: `自动排队 (${modelSlug} × ${count})`,
        modelId: modelRow?.id,
        taskId: task.id,
        balanceAfter: deducted.credits,
      });

      return { task, deducted };
    });

    if (!queuedResult.deducted) {
      send({
        type: "error",
        code: "INSUFFICIENT_CREDITS",
        message: "积分不足，请充值后重试。",
      });
      send({ type: "done" });
      controller.close();
      return;
    }

    // 估算队列位置（粗略，仅用于 UI 提示）
    const [{ count: queueAhead }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(tasks)
      .where(
        and(
          eq(tasks.status, "scheduled"),
          isNull(tasks.scheduledAt),
          sql`${tasks.createdAt} < ${queuedResult.task.createdAt}`,
        ),
      );
    const estimatedMinutes = estimateQueueWaitMinutes({
      queueAhead: Number(queueAhead ?? 0),
      drainRatePerMin: 4,
    });

    log(`grok 池暂时已满，任务已自动加入队列`);
    log(`队列位置：前面还有 ${queueAhead} 个，预计 ${estimatedMinutes} 分钟开始`);
    send({
      type: "queued",
      queueAhead: Number(queueAhead ?? 0),
      estimatedWaitMinutes: estimatedMinutes,
    });
    send({ type: "stage", stage: "DONE" });
    send({ type: "done" });
    controller.close();
    return;
  }
}

// ── Step 4b (rest unchanged): Deduct credits + submit Sora task ──
// ... rest of file unchanged
```

确保保留 `isNull` 在 imports（`drizzle-orm`）。

- [ ] **Step 3: TypeCheck**

Run: `npm run lint`
Expected: 无错误。如果报 `isNull` 未导入，加到 drizzle-orm 的 import 行。

- [ ] **Step 4: 手测（dev server）**

Run: `npm run dev`，浏览器打开 generate 页面：
- 用一个非 grok 模型（plato）提交 → 应立即生成（行为不变）
- 用 grok 模型提交 → 应立即生成（容量充足时）

完整池满测试留到 Task 8 整合手测。

- [ ] **Step 5: Commit**

```bash
git add src/app/api/generate/route.ts
git commit -m "feat(generate): queue grok2api tasks when pool saturated"
```

---

## Task 4: 批量带货路径加池容量上钳

**Files:**
- Modify: `src/lib/tasks/batch-processing.ts:72-78`（`limit` 计算处）

- [ ] **Step 1: 读现有 limit 计算位置**

Run:
```bash
sed -n '70,82p' /Users/yeadon_1/Desktop/MyProject/vidclaw-v2/.claude/worktrees/pensive-banach-e58638/src/lib/tasks/batch-processing.ts
```

预期输出大概是：
```ts
  const limit = resolveRemainingSubmissionCapacity({
    activeCount: activeChildTasks.length,
    maxConcurrent: getMaxBatchGroupSubmissionsPerTick(),
    requestedCount: requestedLimit,
  });
  if (limit <= 0) {
    return { processed: 0, failed: 0 };
  }
```

- [ ] **Step 2: 在 `if (limit <= 0)` 之前插入 grok 池容量上钳**

Modify `src/lib/tasks/batch-processing.ts` — 在 `const limit = resolveRemainingSubmissionCapacity({...});` 后、`if (limit <= 0)` 前，插入：

```ts
  // 如果整个 group 是 grok2api 模型，进一步把 limit 钳到池剩余容量内。
  // 解决批量带货绕过 /api/generate 队列直接撞 grok 350/2h 上限的问题。
  let effectiveLimit = limit;
  const groupModel = activeChildTasks.length > 0
    ? await db.select({ provider: models.provider }).from(models)
        .innerJoin(tasks, eq(tasks.modelId, models.id))
        .where(eq(tasks.id, activeChildTasks[0].id))
        .limit(1)
        .then((rows) => rows[0]?.provider ?? null)
    : null;

  if (groupModel === "grok2api") {
    const { getGrokPoolCapacity, getGrokPoolUsageRecent2h } = await import(
      "@/lib/video/providers/grok-pool"
    );
    const capacity = await getGrokPoolCapacity();
    const poolUsed = await getGrokPoolUsageRecent2h();
    const poolAvailable = Math.max(0, capacity - poolUsed);
    effectiveLimit = Math.min(effectiveLimit, poolAvailable);
  }
```

然后把后续 `if (limit <= 0)` 和 `.limit(limit)` 全部改为 `effectiveLimit`：

```ts
  if (effectiveLimit <= 0) {
    return { processed: 0, failed: 0 };
  }

  const queuedTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.taskGroupId, group.id), eq(tasks.status, "pending")))
    .orderBy(asc(tasks.createdAt))
    .limit(effectiveLimit);
```

⚠️ 确保文件顶部已 import `models`（应该已经有了，如果没有就加）。

- [ ] **Step 3: TypeCheck**

Run: `npm run lint && npm run test 2>&1 | tail -10`
Expected: 无错误，测试通过。

- [ ] **Step 4: Commit**

```bash
git add src/lib/tasks/batch-processing.ts
git commit -m "feat(tasks/batch): clamp grok2api group limit by pool capacity"
```

---

## Task 5: Generate 页面删除 "凌晨 2 点" UI

**Files:**
- Modify: `src/app/(dashboard)/generate/page.tsx`

- [ ] **Step 1: 定位所有 `scheduled` 引用**

Run:
```bash
grep -n "scheduled" /Users/yeadon_1/Desktop/MyProject/vidclaw-v2/.claude/worktrees/pensive-banach-e58638/src/app/\(dashboard\)/generate/page.tsx
```
预期输出 ~13 行：41 (state)、88/103/118 (透传)、208/231/242/249/272 (UI conditionals)。

- [ ] **Step 2: 删除所有 scheduled 相关行**

按行号操作（用 Edit tool 精确删除每处）：

- 删 line 41: `const [scheduled, setScheduled] = useState(false);`
- 删 lines 88/103/118 中各处 `scheduled,` 字段透传给 API
- 删 line 88/103/118 中 `fulfillmentMode: scheduled ? "standard" : fulfillmentMode,` → 改为 `fulfillmentMode,`
- 删 line 208-272 区间所有依赖 `scheduled` 的 conditional rendering（包括 `{!scheduled && (...)}` 和 `{... && scheduled && (...)}` 包装）

详细：完成后 generate page 不再含任何 `scheduled` 标识符。Run `grep -c "scheduled" page.tsx` 应该返回 `0`。

- [ ] **Step 3: 视觉验证 + 自动验证**

Run: `npm run lint`
Expected: 无错误。

Run: `npm run dev`，打开 `/generate` 页面：
- 表单底部不再有"凌晨 2 点"checkbox
- 其他选项（mode / model / count）行为正常

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/generate/page.tsx
git commit -m "ui(generate): remove deferred 2am scheduled checkbox"
```

---

## Task 6: 任务列表 / 详情显示"排队中"+ 队列位置

**Files:**
- Modify: `src/app/api/tasks/refresh/route.ts`
- Modify: `src/app/(dashboard)/tasks/TaskList.tsx:267-269` 周围
- Modify: `src/app/(dashboard)/tasks/[taskId]/page.tsx:224-226` 周围

- [ ] **Step 1: 改 tasks API 响应里加 `queueAhead` 字段**

Modify `src/app/api/tasks/refresh/route.ts`，把 `userTasks` 的 select 改成 raw SQL 子查询：

```ts
import { isNull, sql } from "drizzle-orm";   // 已有的 imports 基础上加

// ... inside GET()
const userTasks = await db
  .select({
    // 把 tasks.* 全部投影 + 一个 queueAhead 子查询
    id: tasks.id,
    userId: tasks.userId,
    status: tasks.status,
    scheduledAt: tasks.scheduledAt,
    modelId: tasks.modelId,
    createdAt: tasks.createdAt,
    soraPrompt: tasks.soraPrompt,
    scriptJson: tasks.scriptJson,
    creditsCost: tasks.creditsCost,
    paramsJson: tasks.paramsJson,
    inputText: tasks.inputText,
    videoSourceUrl: tasks.videoSourceUrl,
    type: tasks.type,
    errorMessage: tasks.errorMessage,
    startedAt: tasks.startedAt,
    completedAt: tasks.completedAt,
    fulfillmentMode: tasks.fulfillmentMode,
    requestedCount: tasks.requestedCount,
    fulfilledCount: tasks.fulfilledCount,
    deliveryDeadlineAt: tasks.deliveryDeadlineAt,
    taskGroupId: tasks.taskGroupId,
    updatedAt: tasks.updatedAt,
    // ↓ NEW: 队列位置（仅对 scheduled+null 任务有意义）
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
```

⚠️ 把所有 `tasks.*` 列都显式列出，因为有了 sql 子句就不能用 `.select()` 简写。

- [ ] **Step 2: 改 TaskList 渲染分支**

Modify `src/app/(dashboard)/tasks/TaskList.tsx` 第 267-269 行那段：

```tsx
// 老：
{task.status === "scheduled" && task.scheduledAt && (
  <p className="...">预计执行：北京时间 {formatScheduledAt(task.scheduledAt)}</p>
)}

// 新：
{task.status === "scheduled" && (
  task.scheduledAt ? (
    <p className="...">预计执行：北京时间 {formatScheduledAt(task.scheduledAt)}</p>
  ) : (
    <p className="...">
      排队中，前面还有 {task.queueAhead ?? 0} 个，预计 {Math.max(1, Math.ceil((task.queueAhead ?? 0) / 4))} 分钟
    </p>
  )
)}
```

如果 `Task` TypeScript 类型不含 `queueAhead`，加一行 optional：
```ts
type TaskWithQueue = Task & { queueAhead?: number };
```

- [ ] **Step 3: 改任务详情页**

Modify `src/app/(dashboard)/tasks/[taskId]/page.tsx` 第 224-226 行同样的分支改造，复制 Step 2 的模式。

- [ ] **Step 4: Lint + 视觉验证**

Run: `npm run lint`
Run: `npm run dev`，打开 `/tasks` 页面，确认现有任务还能正常列出。

- [ ] **Step 5: Commit**

```bash
git add src/app/api/tasks/refresh/route.ts src/app/\(dashboard\)/tasks/TaskList.tsx src/app/\(dashboard\)/tasks/\[taskId\]/page.tsx
git commit -m "ui(tasks): show queue position for ASAP-queued scheduled tasks"
```

---

## Task 7: 清理老 `/api/cron/scheduled` 入口

**Files:**
- Delete: `src/app/api/cron/scheduled/` 整个目录
- Modify: `vercel.json`

- [ ] **Step 1: 删除老 route 文件**

Run:
```bash
rm -rf /Users/yeadon_1/Desktop/MyProject/vidclaw-v2/.claude/worktrees/pensive-banach-e58638/src/app/api/cron/scheduled
```

- [ ] **Step 2: 修改 `vercel.json` 删除对应 cron**

Edit `vercel.json`，删除 crons 数组中：

```json
{
  "path": "/api/cron/scheduled",
  "schedule": "0 18 * * *"
}
```

也删除 `functions` 块里 `src/app/api/cron/scheduled/route.ts` 的 maxDuration 配置。

最终 `vercel.json` 的 `crons` 只剩 `/api/cron/timeout`，`functions` 只剩 `/api/generate/route.ts` 和 `/api/cron/timeout/route.ts`。

- [ ] **Step 3: 验证 build 不报缺文件**

Run: `npm run build 2>&1 | tail -20`
Expected: build 成功，无 "Cannot find route" 错误。

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git rm -r src/app/api/cron/scheduled
git commit -m "chore(cron): remove deprecated daily scheduled cron route"
```

---

## Task 8: 文档更新 + 整合手测

**Files:**
- Modify: `src/lib/tasks/CLAUDE.md`
- Modify: `src/lib/models/CLAUDE.md`（admin runbook）

- [ ] **Step 1: 更新 `src/lib/tasks/CLAUDE.md`**

在文件末尾"变更日志"前加一节：

```markdown
## grok2api 池容量感知队列

`scheduled` 状态承担两种语义：

- `scheduled_at IS NULL` — ASAP 队列。grok2api 模型在提交时如果池子最近 2h 已用容量超阈值，自动进队列；drain 由现有 per-minute pg_cron tick 触发，按 `min(余量, GROK_DRAIN_BUDGET_PER_TICK)` 节奏放出。
- `scheduled_at` 非 NULL — 老的"指定时间执行"语义，仅 admin/内部 fallback 用。

并发安全靠 `FOR UPDATE SKIP LOCKED`，不是 advisory lock（postgres.js 连接池会让 session-scoped lock 在不同连接上释放，不安全）。

公平规则：单用户在队列中前 10 条 FIFO 优先；第 11 条起降权，让位给其他用户的新提交。常量见 `src/lib/video/providers/grok-pool.ts`。
```

- [ ] **Step 2: 更新 `src/lib/models/CLAUDE.md` 加 admin runbook**

在末尾或合适位置加：

```markdown
## Admin Runbook — grok2api 账号池容量

容量常量存在 `system_config` 表，key = `grok.pool_capacity_per_2h`，默认 350（= 7 Super × 50 / 2h）。

**何时改这个值**：
- 增加 grok2api Super 账号 → 容量 +50，每个 Super 周期 2 小时
- 删除/封禁 grok2api Super 账号 → 容量 -50
- 全删了 Super 只留 Basic → 容量 ≈ 3 × 1.25（30/24h ≈ 2.5/2h，几乎不可用）

**怎么改**：通过 `/admin/system-prompts` 后台或直接 SQL：

```sql
INSERT INTO system_config (key, value, updated_at) VALUES
  ('grok.pool_capacity_per_2h', '{"value": 400}'::jsonb, NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
```

**忘了改的后果**：drain 会按旧容量放任务出去，超出真实账号数量后撞 grok 端 429，不烧实际配额但浪费墙钟，用户看到失败/重试。
```

- [ ] **Step 3: 整合手测清单**

Run `npm run dev`，跑这些场景验证：

1. **非 grok 模型不受影响**：plato/yunwu 提交 1 个任务 → 立即生成 ✅
2. **grok 池有容量**：连续提交 5 个 grok 任务 → 全部立即生成 ✅
3. **grok 池接近满**：人工 SQL 把池容量临时改到 5（`UPDATE system_config SET value = '{"value":5}'::jsonb WHERE key='grok.pool_capacity_per_2h'`），然后提交第 6 个 grok 任务 → 应进入"排队中"状态 ✅
4. **队列 drain 触发**：等下一分钟 pg_cron tick → 排队任务被 drain，状态从 `scheduled` → `analyzing` → `generating` ✅
5. **批量带货 grok 路径**：提交一个 grok 批量任务组，确认 task_group 的 limit 被池容量钳到 ✅
6. **测试完恢复**：`UPDATE system_config SET value = '{"value":350}'::jsonb WHERE key='grok.pool_capacity_per_2h'`

- [ ] **Step 4: Commit**

```bash
git add src/lib/tasks/CLAUDE.md src/lib/models/CLAUDE.md
git commit -m "docs(grok-queue): update tasks/models CLAUDE.md with new queue mechanics"
```

---

## 完成后的验证

- [ ] **跑全套测试**：`npm run test 2>&1 | tail -5` — 应该全绿
- [ ] **lint 一遍**：`npm run lint`
- [ ] **生产构建**：`npm run build` — 应该过
- [ ] **手测清单全部 ✅**（Task 8 Step 3 的 6 项）
- [ ] **观察 48 小时**：production 部署后看 `tasks` 表里 `status='scheduled' AND scheduled_at IS NULL` 的最大队列深度，应在 50 内
- [ ] **观察 14 天**：grok task_items 失败率 <1%，无积压 >100 持续 >30 分钟（详见 spec § 验收标准）

---

## Rollback 预案

如果上线后发现严重问题：

```bash
# 找到上线前的 commit（spec doc 的那条）
git log --oneline | grep "grok"
# 直接 revert 最后 8 个 commit
git revert <task8>..<task1>
git push
```

由于 spec § 5.1 说明：DB 当前 0 条 scheduled 任务，无数据迁移，revert 后状态机回到改造前完全等价。Stripe 计费、退款逻辑都不动。安全 rollback。
