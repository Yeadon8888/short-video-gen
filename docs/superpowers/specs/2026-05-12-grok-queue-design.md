# Grok2API 容量感知队列 — 设计文档

**日期**：2026-05-12
**作者**：Yeadon8888 + Claude
**状态**：Spec（待 review）→ implementation plan

---

## 背景与问题

VidClaw v2 的 grok2api provider 把用户上传的产品图通过自托管 Railway 代理（[chenyme/grok2api](https://github.com/chenyme/grok2api)）转发到 Grok Imagine。当前账号池：

- **7 个 Super 账号**，每个 50 视频 / **每 2 小时滑动窗口**（grok2api 源码 [`quota_defaults.py`](https://github.com/chenyme/grok2api/blob/main/app/control/account/quota_defaults.py) 定义）
- **2–3 个 Basic 账号**，每个 30 / 24h（基本是装饰）

**真实容量**：350 视频 / 2h ≈ **175 视频/小时**。

### 实测瓶颈（基于 14 天 `task_items` 数据，14 天）

| 维度 | 数据 |
|---|---|
| 14 天日峰值 | 370 条 / 天（恰好撞 365 daily ceiling） |
| 7 天 peak/分钟 | 9 创建 |
| 集中时段 | 北京 11:00 / 14:00 / 15:00 / 16:00 4 个小时合计占 50% |
| 死区 | 0:00–7:00 几乎为零 |
| 当前 scheduled 任务 | **0 条**（旧的"凌晨 2 点定时"功能已闲置） |
| Provider 创建失败率 | <0.2%（14 天 1597 成功 / 3 失败） |
| 任务级失败 | 171（30 天）—— 几乎全部源于 Vercel 300s 砍掉同步 grok 创建 |

### Railway 侧补充发现（独立但相关）

- `SERVER_WORKERS=1`（单 Granian worker），asyncio 并发 → CPU 不是瓶颈
- 单号并发 = 8、上传 Asset 全局并发 = 10（足够，无需调整）
- **Cloudflare 403 噪音**：~11 错/分钟稳态命中 `app.dataplane.reverse.transport.asset_upload`，独立 work item，**不在本次范围**

### 结论

瞬时爆发 + 2h 滑动窗口 350 的硬天花板 → **队列摊平是唯一解**。
升 `SERVER_WORKERS` 或 Railway 规格都帮不上忙。

---

## 设计原则

1. **Keep it simple** — 不引入新表、新 enum、新 module 文件
2. **只影响 grok2api 模型** — 其他 provider 完全不变
3. **复用现有 `scheduled` 状态 + `scheduled_at` 列**，靠 NULL/非 NULL 区分两种语义
4. **DB-as-queue**：postgres + `FOR UPDATE SKIP LOCKED` + 每分钟 pg_cron tick
5. **不做实时容量指示器、不做用户取消队列、不做容量自动同步**（5.5 列为未来 work item）

---

## § 1 — 数据流 & 状态机

| `scheduled_at` 值 | 语义 | 入口 | 出口 |
|---|---|---|---|
| `NULL` | ASAP 队列——有容量就跑 | grok2api 模型 + 提交时池子撞限 | drain tick 检测到容量后取出 |
| 非 NULL | 指定时间执行（老语义） | 仅 admin/内部 fallback | tick 检测到 `now >= scheduled_at` 后取出 |

```
[非 grok2api 模型]
  pending → analyzing → generating → polling → done   (不动)

[grok2api 模型]
  POST /api/generate
       │
       ├─ 池余量 ≥ count → 立即提交 → analyzing → ... done   (不动)
       │
       └─ 池余量 < count → status='scheduled', scheduled_at=NULL
                                                    │
                                  pg_cron 每分钟 → /api/internal/tasks/tick
                                                    │
                                                    ↓
                          processDueScheduledTasks (改造后)
                          ├─ capacity-aware claim SQL (FOR UPDATE SKIP LOCKED)
                          ├─ 池余量 = 350 - 最近 2h 已提交未结算
                          ├─ FIFO + 单用户≤10 取 min(余量, 5) 条
                          └─ Promise.allSettled 并行 drain → analyzing → ... done
```

**关键决策**：
- 不新增 enum 值、表、module
- 删 [vercel.json](../../../vercel.json) 里 `/api/cron/scheduled` daily cron 条目
- 删整个 [src/app/api/cron/scheduled/](../../../src/app/api/cron/scheduled/) route 目录

---

## § 2 — 写入侧（`/api/generate/route.ts`）

### 池余量算法

```sql
SELECT COUNT(*) FROM task_items ti
JOIN tasks t ON t.id = ti.task_id
JOIN models m ON m.id = t.model_id
WHERE m.provider = 'grok2api'
  AND ti.created_at > NOW() - INTERVAL '2 hours'
  AND ti.status != 'FAILED';
```

包装为 `getGrokPoolUsageRecent2h()`，新建 `src/lib/video/providers/grok-pool.ts`。

容量常量：`system_config` 表 row `grok.pool_capacity_per_2h`，默认 350。Admin 加减账号时改 row，不发版。

### 提交分支判断（替换 [api/generate/route.ts:302](../../../src/app/api/generate/route.ts) 整段旧 scheduled 逻辑）

```ts
const isGrok = modelRow?.provider === 'grok2api';
const needsQueue = isGrok &&
  (await getGrokPoolUsageRecent2h()) + count > GROK_POOL_CAPACITY;

if (needsQueue) {
  // 队列分支：扣分 + 写 scheduled / scheduledAt=NULL
  await db.transaction(async (tx) => {
    const [task] = await tx.insert(tasks).values({
      ...sharedTaskFields,
      status: "scheduled",
      scheduledAt: null,
    }).returning();
    // 扣分逻辑同今天的 scheduled 路径
  });

  send({ type: "queued", estimatedWaitMinutes, queueAhead });
  send({ type: "done" });
  return;
}
// else: 走老的立即提交路径，完全不变
```

### 关键决策

| 问题 | 选择 | 理由 |
|---|---|---|
| 全量 vs 部分入队 | **全量** | `taskSlots` 模型不支持"部分提交" |
| TOCTOU race | **不严格防** | 多提交 1 条由 proxy `单号并发=8` 兜底，最坏撞 429 退 1 条；下一 tick 自愈 |
| 单用户上限 N | **写入侧不限**，drain 侧加权 | 不阻止提交，只决定排队顺序 |
| ETA 算法 | `Math.ceil(queueAhead / 4)` 前端纯计算 | 不准也只是 ±1 分钟，不挨骂 |

### 顺便清理

- 删 [generate/page.tsx:41](../../../src/app/(dashboard)/generate/page.tsx) `scheduled` checkbox state
- 删 [api/generate/route.ts:87, 125, 302–385](../../../src/app/api/generate/route.ts) 旧 deferred 分支
- DB 中 `scheduled_at` 列保留，写入侧不再有非 NULL 写入路径

---

## § 3 — drain 侧（`processDueScheduledTasks` 改造）

**重要修订**：放弃之前讨论的 `pg_try_advisory_xact_lock`——postgres.js 连接池下 session-scoped lock 不安全；改用 `FOR UPDATE SKIP LOCKED` 标准模式。

### 核心 SQL（一次原子操作完成"算容量 + 选取 + claim"）

```sql
WITH
  pool_used AS (
    SELECT COUNT(*)::int AS n
    FROM task_items ti
    JOIN tasks t ON t.id = ti.task_id
    JOIN models m ON m.id = t.model_id
    WHERE m.provider = 'grok2api'
      AND ti.created_at > NOW() - INTERVAL '2 hours'
      AND ti.status != 'FAILED'
  ),
  budget AS (
    SELECT LEAST(
      GREATEST(0, $1::int - (SELECT n FROM pool_used)),  -- $1 = 350
      5                                                  -- 单 tick 上限
    ) AS n
  ),
  ranked AS (
    SELECT t.*,
      ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) AS user_pos
    FROM tasks t
    WHERE t.status = 'scheduled' AND t.scheduled_at IS NULL
      AND t.model_id = $2
  ),
  picked AS (
    SELECT id FROM ranked
    ORDER BY (CASE WHEN user_pos <= 10 THEN 0 ELSE 1 END), created_at ASC
    LIMIT (SELECT n FROM budget)
    FOR UPDATE SKIP LOCKED
  )
UPDATE tasks
SET status = 'analyzing', started_at = NOW(), error_message = NULL
WHERE id IN (SELECT id FROM picked)
RETURNING *;
```

### 为什么 `FOR UPDATE SKIP LOCKED` 够用

- 并发 tick 看到的"可选行"不重叠（A tick 锁住前 5 行后，B tick 自动跳过去看后面的行）
- 最坏情况：两 tick 都看到余量 330、各自 drain 5 条、且看到不重叠的 10 行 → **多 5 条 overshot**
- **下一分钟自愈**（next tick 重算余量后 drain 0）
- Overshot 不烧实际配额（grok 端 429 即拒，不扣 quota）

### Drain 后流程

```ts
const claimed = await runAtomicClaimSql();
if (!claimed.length) return { drained: 0 };

const results = await Promise.allSettled(
  claimed.map(async (task, index) => {
    await delayStaggeredSubmission(index);  // 复用 1s stagger
    return submitToGrokViaExistingPath(task);  // 复用 createVideoTasksForModelId + insertTaskItemsFromSubmission
  })
);
```

完全复用 [scheduled.ts:65–83](../../../src/lib/tasks/scheduled.ts) 现有逻辑，只换 SQL 查询。

### 参数边界

| 参数 | 值 | 调整方式 |
|---|---|---|
| `GROK_POOL_CAPACITY_PER_2H` | 350 | `system_config` row |
| Drain budget per tick | 5 | 代码常量 (单条 ~90s × 5 并行 ≈ 90s 墙钟 < 300s Vercel 上限) |
| Per-user fairness cap | 10 | 代码常量 |
| Stagger between drain submits | 1s | 复用现有 `BATCH_SUBMISSION_STAGGER_MS` |

### 边界 case

Admin 临时下调容量到 100，但已有 200 in-flight → drain SQL 算出 budget = `LEAST(GREATEST(0, 100-200), 5) = 0` → 暂停 drain，等池子自然滑出 100 条后恢复。**符合预期。**

### 已知近似：budget 计数 task 而非 slot

`pool_used` 计数 `task_items`（精确 = slot 数），但 `picked` 从 `tasks` 表选取——一个 task 可能有 `count > 1`，drain 后会提交多个 task_items。

实际影响：典型 single-task `count=1–3`，batch task per-product `count=2–3`。worst case drain 5 tasks × count=3 = 15 slots，相当于预期 5 slots 的 3 倍。

**为什么不修**：
- 15/350 = 4% 临时 over-capacity，下一 tick 重算后自愈
- 不烧实际配额（grok 端 429 即拒，不扣 quota）
- 修复方案（用 window-sum 累加 count 直到达到 budget）SQL 复杂度显著上升，违背 "keep it simple"
- 真出问题时把 budget 常量从 5 调到 3 就能立刻收紧

文档此处明示，避免半年后读代码的人误以为 budget=5 一定等于 5 slots。

---

## § 4 — UI 侧改动

### A. 生成页 [src/app/(dashboard)/generate/page.tsx](../../../src/app/(dashboard)/generate/page.tsx)

**删**：
- 第 41 行 `setScheduled` state
- 第 88/103/118 行 透传给 API 的 `scheduled` 字段
- 第 208–272 行 所有相关 conditional rendering

**不新增**："grok 池繁忙"实时指示器——提交那一刻 SSE 立即告诉用户结果，预测不值。

### B. SSE 事件类型

新增事件：
```ts
send({
  type: "queued",
  estimatedWaitMinutes: Math.ceil(queueAhead / 4),
  queueAhead,
});
```

前端渲染一行："任务已加入队列，前面还有 X 个，预计 Y 分钟后开始"。

### C. 任务列表 / 详情（[TaskList.tsx:267](../../../src/app/(dashboard)/tasks/TaskList.tsx), [tasks/[taskId]/page.tsx:224](../../../src/app/(dashboard)/tasks/[taskId]/page.tsx)）

```tsx
{task.status === "scheduled" && (
  task.scheduledAt
    ? <p>预计执行：北京时间 {formatScheduledAt(task.scheduledAt)}</p>
    : <p>排队中，前面还有 {task.queueAhead} 个，预计 {task.estimatedMinutes} 分钟</p>
)}
```

任务列表 API 加一个 count 子查询返回 `queue_ahead`。前端算 `estimatedMinutes`。

### D. 状态徽章

`scheduled` 状态在 UI 显示文案二态化：
- `scheduledAt` 非 NULL → "已预约"
- `scheduledAt` NULL → "排队中"

### 改动量估算

- 删除：~120 行
- 新增：~80 行
- **净改动：-40 行**（重构是减代码的）

---

## § 5 — Rollout, 兼容性 & 风险

### 5.1 部署顺序（一次 PR）

无需 feature flag。理由：DB 当前 0 条 scheduled 任务、新逻辑只影响 grok2api 池满场景、改坏直接 revert。

**Commit 顺序**：

1. `INSERT INTO system_config` row `grok.pool_capacity_per_2h = 350`
2. 加 `src/lib/video/providers/grok-pool.ts`
3. 改 [scheduled.ts](../../../src/lib/tasks/scheduled.ts) drain SQL
4. 改 [api/generate/route.ts](../../../src/app/api/generate/route.ts) 提交分支
5. 改 UI（删 checkbox + 状态徽章二态 + 任务列表 queue_ahead）
6. 删 [vercel.json](../../../vercel.json) 里 `/api/cron/scheduled` cron 条目 + 整个 route 目录
7. 加测试

### 5.2 兼容性：批量带货路径也要加池容量检查

`/api/generate/batch` → `processPendingBatchTasks` 是独立路径，不经过 `/api/generate`。grok2api 的 group 必须额外把 limit 钳一道：

```ts
// batch-processing.ts 内
if (model.provider === 'grok2api') {
  const poolAvailable = GROK_POOL_CAPACITY - await getGrokPoolUsageRecent2h();
  limit = Math.min(limit, Math.max(0, poolAvailable));
}
```

5 行代码，复用 `getGrokPoolUsageRecent2h()`。

### 5.3 测试

| 文件 | 测什么 |
|---|---|
| `tests/lib/video/providers/grok-pool.test.ts` | `getGrokPoolUsageRecent2h` 时间窗口正确；FAILED 不计 |
| `tests/lib/tasks/scheduled.test.ts` | Drain SQL：池满返回 0；池半满按 budget；单用户 >10 降权；SKIP LOCKED 不超量 |
| `tests/lib/tasks/batch-processing.test.ts` | grok2api group limit 被池余量进一步钳 |
| `tests/integration/grok-queue-flow.test.ts` | submit 11 → 10 立即 + 第 11 进 scheduled/null → drain tick 后被 claim |

**手测清单**（部署后 production 验证）：

1. grok 模型连续 10 个 single task → 全立即生成
2. 立即再 5 个 → 部分进"排队中"
3. 1 分钟后刷新 → 队列下降
4. yunwu/plato 提交 → 完全不受影响

### 5.4 风险清单

| 风险 | 概率 | 影响 | 应对 |
|---|---|---|---|
| 池容量配错（admin 删账号忘改 system_config）| 中 | drain 太凶 → 429 | admin runbook 写入 [src/lib/models/CLAUDE.md](../../../src/lib/models/CLAUDE.md) |
| TOCTOU 短暂 overshot 5 条 | 高 | 极小（自愈） | 已论证，无需处理 |
| Vercel 函数中途被砍 | 低 | 卡 `analyzing` | 现有 `resetStaleAnalyzingTasks`（5 分钟自动复活） |
| pg_cron 暂停 | 低 | 队列不流动 | 未来加 Slack 告警（非 MVP） |
| 用户排队后想取消 | 低 | UX 差 | MVP 不做 |
| 代运营 B 端大客户独占 | 中 | 散户排队过长 | §3 的"单用户 ≥10 降权"兜住 |

### 5.5 未来 work items（不在本次范围）

- `system_config.grok.pool_capacity_per_2h` 改成自动从 grok2api admin API 同步
- Admin dashboard widget 显示实时 `{pool_used, pool_capacity, queue_depth, last_drain_count}`
- 用户侧"取消排队任务"按钮
- 调查并修 Cloudflare 403 噪音（独立 work item）
- B 端大客户"优先池"：付费等级高用户走单独 capacity 预算

---

## 验收标准

1. grok2api 模型在池满时自动入队列，UI 显示"排队中"+ 大致 ETA
2. 非 grok2api 模型行为完全不变
3. 批量带货（`/api/generate/batch`）对 grok2api group 也走容量检查
4. 不再有任何"凌晨 2 点定时"用户入口（admin 内部 fallback 保留）
5. 14 天观察：池满期间队列正常 drain、无积压 >100 持续 >30 分钟、grok task_items 失败率仍 <1%

---

## 决策摘要

- **状态机**：复用 `scheduled` + `scheduled_at` NULL/非 NULL 二态，不引入新 enum
- **容量来源**：`system_config` row，默认 350，admin 手动维护
- **并发控制**：`FOR UPDATE SKIP LOCKED`（不用 advisory lock）
- **公平**：单用户 ≥10 条降权，保前 10 条 FIFO
- **Drain 节奏**：5 条/tick × 60 tick/h = 300/h（接近 175/h refill 的 1.7 倍，足够清积压）
- **UI**：只在提交瞬间 + 任务列表显示，不做实时池状态指示
