# REVIEW_CONTEXT.md

_生成日期：2026-04-21_
_基于：分支 `codex/extracted-webapp`，HEAD `086cfde`_

本文档给下一位接手这个项目的工程师/Agent 用，回答四件事：
这里有哪些模块、最近动过什么、哪些地方容易踩坑、哪里在攒技术债。

---

## 1. 核心模块及其职责

按领域划分，每个领域在自己的 `CLAUDE.md` 里有更详细的约定，这里只列职责边界。

### 1.1 视频生成任务域 `src/lib/tasks/`

任务生命周期被**刻意拆成四条独立流水线**，避免结算/下载/清理/推进互相污染：

| 文件 | 职责 | 大小 |
|---|---|---|
| `runner.ts` | 分钟级维护入口；串联 scheduled / batch / 单任务轮询 / timeout 四件事 | 251 |
| `batch-processing.ts` | 批量（带货）任务的 pending → analyzing → generating 提交 | 253 |
| `batch-queue.ts` | 批量提交节流常量（per-tick group / slot 上限、stagger） | 40 |
| `fulfillment.ts` | slot 维度的目标补齐、重试、结算（`fulfillment_mode=backfill_until_target`） | 579 |
| `reconciliation.ts` | 标准任务的终态结算和退款 | 254 |
| `timeout.ts` | >60min 超时任务的退款 | 205 |
| `scheduled.ts` | 定时到期的 scheduled 任务推进到 pending | 87 |
| `downloads.ts` | 任务结果打 ZIP | - |
| `expiry.ts` / `expiry-meta.ts` | 3 天过期策略 | 90 |
| `result-assets.ts` | 成功视频镜像到自有存储，让 ZIP + 过期物理删除可控 | - |

**关键设计**：`runner.ts` 只处理视频域。图片编辑是独立 worker 路径（见 1.3）。

### 1.2 视频 provider 适配层 `src/lib/video/`

| 文件 | 职责 |
|---|---|
| `service.ts` | 从 DB `models` 表解析模型、分发到 provider 适配器、统一归一化参数 |
| `types.ts` | `VideoParams` / `TaskStatusResult` / `VideoDuration` 等 |
| `prompt.ts` | 最终 sora prompt 拼装 |
| `image-prep.ts` | 图片预处理（尺寸/比例/编码） |
| `providers/plato.ts` | Plato 适配器 |
| `providers/yunwu.ts` | 云雾适配器 |
| `providers/dashscope.ts` | 阿里百炼适配器 |
| `providers/grok2api.ts` | 自建 Railway 反代 Grok 适配器（**同步阻塞 60-90s** 是本项目当前性能瓶颈来源） |
| `providers/shared.ts` | `classifyVideoProviderFailure` / `extractProviderErrorMessage` / `isRetryableOverload` 失败归类 |

**硬约束**：任何 vendor 协议细节（URL、字段名、状态词）必须藏在 `providers/*.ts`，不得泄漏到 tasks 域或页面层。

### 1.3 图片编辑域 `src/lib/image-edit/`

独立于视频域的异步管道，**不走视频 tick**：

| 文件 | 职责 |
|---|---|
| `jobs.ts` | `assetTransformJobs` 仓储 + 处理器；含自耗尽 drain loop | 452 |
| `worker.ts` | 内部 worker 触发 + 鉴权边界 |
| `queue.ts` | 并发上限集中点（`MAX_CONCURRENT_ASSET_TRANSFORMS=3`） |
| `bltcy.ts` | BLTCY / Plato 兼容的图片编辑 API 适配 |
| `scene-generation.ts` | 场景图生成 |
| `payload.ts` | 请求体构造 |

触发有两条路径：用户点击 `POST /api/assets/[id]/transform`（后 fire-and-forget 调 worker），以及 pg_cron 每分钟 `vidclaw-asset-transform-drain` 兜底。

### 1.4 Task/TaskGroup/Slot 的 DB 模型

```
task_groups ──1:N── tasks ──1:N── task_slots ──1:N── task_items
                                                      ↑
                                  每个 item = 一次 provider 提交尝试
```

- `taskSlots` 只在 `fulfillment_mode=backfill_until_target` 时存在（批量带货默认开启）
- `taskItems.providerTaskId` 是外部系统 ID
- "slot 被填满" = 至少一个挂在它下面的 item 最终 SUCCESS

### 1.5 其他关键模块

- `src/lib/db/schema.ts`：**所有表和枚举的单一事实来源**。改表必须 `npm run db:generate` 生成迁移，禁手写迁移。
- `src/lib/payments/`：支付宝 + Stripe（Stripe 刚接）。订单流转：pending → paid → credits granted。
- `src/lib/models/`：DB 驱动的模型注册表，按 capability（`video_generation` / `image_edit` / `script_generation`）筛选。
- `src/lib/auth.ts`：Supabase Auth SSR 包装。Server Component 用 `createServerClient`；API Route 用 `createServiceClient`（绕 RLS）。
- `src/stores/generate.ts`：Zustand，生成表单状态。

### 1.6 运行时编排

- 每分钟 `pg_cron` → `POST /api/internal/tasks/tick` → `runTaskMaintenance`（视频域四件事并行）
- 每分钟 `pg_cron` → `POST /api/internal/assets/transforms/process` → 自耗尽图片 worker
- 每 5 分钟 `pg_cron` → `/api/internal/gallery/thumbnail-backfill`
- Vercel Cron：`/api/cron/scheduled` 每天 18:00，`/api/cron/timeout` 每天 00:00（兜底）

---

## 2. 最近 30 天关键改动

时间窗：2026-03-22 到 2026-04-21，共 **42 个 commit（非 merge）**。

### 2.1 改动频次 Top 10（提交次数计）

| 次数 | 文件 |
|---|---|
| 10 | `src/lib/video/service.ts` |
| 7 | `src/app/api/tasks/refresh/route.ts` |
| 6 | `src/lib/video/providers/plato.ts` |
| 6 | `src/app/api/generate/route.ts` |
| 6 | `src/app/(dashboard)/tasks/TaskList.tsx` |
| 5 | `src/lib/db/schema.ts` |
| 5 | `src/app/(dashboard)/tasks/[taskId]/page.tsx` |
| 5 | `src/app/(dashboard)/admin/models/page.tsx` |
| 5 | `package.json` |
| 4 | `src/lib/tasks/batch-processing.ts` |

`service.ts` 被改 10 次是显著信号——见 §4。

### 2.2 近 30 天重要节点

**2026-03-23 前后**：video provider service 大重构；允许每模型独立参数；修加速上传和 reconciliation；admin 模型编辑增强。

**2026-03-26 ~ 28**：
- `backfill_until_target` 补齐模式上线（`b3c79b4`）
- Scheduled 任务容错（`709aede` `f34b876`）
- Supabase pg_cron 驱动的 tick（`7577577` 7577577：新建 `/api/internal/tasks/tick`，把兜底 cron 从 Vercel Hobby 超限搬到 Supabase）
- 批量带货体验打磨；任务组 ZIP 下载

**2026-03-27**：引入 Grok 适配（通过 Plato 兼容路径，短暂失败后 revert，最终改走独立 `grok2api.ts`）

**2026-04-17**：大规模 SEO + 合规页（Stripe onboarding 准备）；大规模恢复丢失改动（`b8014bc`，恢复异步图片转换、Alipay、gallery、Scene、Face-Swap 等）

**2026-04-18**：`grok2api` 独立 provider 上线（`f299c74`）——直连自建 Railway 反代

**2026-04-20（今天一整天）**：tick 崩溃抢修日
- `1486c8a` 修 postgres.js Date 序列化 bug + 包 try/catch + git-clean guard
- `9180a2b` 放宽 grok2api 批量节流
- `b27466e` runner 内 task_group 间 `Promise.allSettled`
- `9e50f6c` / `f84e6d0` 资产页批量多选 + 修复 checkbox 被 hover 遮罩吞事件
- `b67f1af` image-edit 自耗尽 + 新 cron
- `086cfde` batch-processing 子任务内 `Promise.allSettled`

### 2.3 仍未提交的大量本地改动

工作区 **~30 个文件** 处于 modified 状态，既包括今天的修复周边，也有更早的未提交工作（pricing 页、sidebar、supabase middleware 加强、gemini 重构、各 provider 小修）。建议先把这些分批 commit 出去再动结构性改动——目前每次部署都带 `--allow-dirty`，意味着**生产运行的代码跟 Git SHA 对不上**，这本身是运维坑（今天 Date-bug 就是这么被部署进去的）。

---

## 3. 写代码时感觉不确定的地方

这一节只列"我一定会停下来查/问的地方"。不是"写不出来"，是"写之前一定要先确认"。

### 3.1 任务状态机与退款的原子性

`tasks.status` 流转：`pending → analyzing → generating → polling → done/failed`（加 `scheduled` 分支）。退款逻辑分散在三个地方：
- `reconciliation.ts` 的 `failTaskAndRefund` / `finalizeTaskIfTerminal`
- `timeout.ts` 的超时退款
- `batch-processing.ts` 的 catch 也会调 `failTaskAndRefund`

**不确定的事**：同一个 task 被两条路径同时走到退款分支时会不会重复扣（或反向——双重退款）。`failTaskAndRefund` 的 `allowedStatuses` 白名单是防护，但白名单得所有调用点都正确传递。`fulfillment.ts` 的 slot 级流转又加了一层。写新代码动 task 状态前必须先看 `CLAUDE.md`、`reconciliation.ts` 与 `AGENTS.md` 里的 "Treat billing, refunds, and task-state transitions as high risk"。

### 3.2 Slot 模式 vs 非 slot 模式

`fulfillment_mode` 有两个值：
- `backfill_until_target`：走 slot，`initializeSlots` + `submitPendingSlots` + `advanceSlotOnResult`
- 其他（默认）：直接 `createVideoTasksForModelId` + `insertTaskItemsFromSubmission`

两条路径在 `runner.ts` 和 `batch-processing.ts` 里各有 if/else 分支。写"任务 X 应该出几个视频"这类问题时要先确认是哪个模式，不然退款/计数都会错（`resolveBatchTaskVideoCount` vs slot target）。

### 3.3 provider 适配器的同步/异步协议差异

- `plato` / `yunwu` / `dashscope`：create 返回 taskId 很快，靠 `queryTaskStatus` 轮询
- `grok2api`：create 同步阻塞 60-90s（内部实现是代理等整段视频完成），返回时基本就是 SUCCESS

这两种语义**共用同一个 adapter 接口**，对 runner.ts 来说是黑盒。后果是 tick 预算被 grok2api 单次 create 撑满。写新 provider 前必须先决定"你是不是同步"，它影响上游 batch-queue 的选型（见 §4）。

### 3.4 Vercel `maxDuration=300s` 硬边界

多处代码里隐含这个 300s 预算：
- `/api/internal/tasks/tick`：`maxDuration = 300`
- `image-edit/jobs.ts` drain loop：`DRAIN_BUDGET_MS = 260_000`
- batch-queue 里 group×slot×stagger 乘积必须 < 300s

写"再多并行一点""再多拉一批"之类的改动时很容易把乘积推过 300s 导致函数被 Vercel 砍——今天就出过（我先把 slot per-tick 从 2 提到 3，然后又回退）。

### 3.5 postgres.js 参数序列化

**踩过的坑**：`sql\`... < ${cutoff}\`` 里 `cutoff` 如果是 `Date`，postgres.js v3.4.8 会抛 `ERR_INVALID_ARG_TYPE`。必须转成 `toISOString() + ::timestamptz` 或用 drizzle 的 `lt(col, date)` operator。schema 里还有多处 `timestamp({ withTimezone: true })` 字段；drizzle 默认 mode 是 date，插入时传 `new Date()` 没问题，但 raw SQL 模板里不能直接插 Date。

### 3.6 `createServerClient` vs `createServiceClient`

RLS 的边界。页面/API Route 拿用户态数据必须用 ServerClient，内部 cron / admin 通道用 ServiceClient。写新 API 路由时要先想清楚"这个路由是谁调用的、应不应该受 RLS 约束"。

### 3.7 `batch-queue.ts` 的三个常量到底谁管谁

```
MAX_BATCH_GROUP_SUBMISSIONS_PER_TICK = 3  // 每个 group 每 tick 新启动多少子任务
MAX_BATCH_SLOT_SUBMISSIONS_PER_TICK  = 2  // 每个子任务每 tick 提交多少 slot
BATCH_SUBMISSION_STAGGER_MS          = 1000 // 子任务间起跑错开
```

group × slot × provider-create-time 决定 tick 真实耗时。slot 常量通过 `fulfillment.submitPendingSlots` 生效，group 常量通过 `batch-processing.ts` 的 `resolveRemainingSubmissionCapacity` 生效。两处名字相似但语义不同的"capacity"容易混。

### 3.8 为什么 runner 里 task_group 排序是 `desc(createdAt)` 但 batch-processing 里是 `asc(createdAt)`

`runner.ts` 用 `desc`（最新的先处理），`batch-processing.ts` 内部 pending 子任务用 `asc`（最老的先处理）。**这是故意的还是历史遗留，没有注释说明**。如果要做公平性/FIFO 保证，这里必须先搞清楚。

### 3.9 image-edit 和 tasks 是平行但不共享抽象的两套

都是异步 job + 并发池 + 自耗尽 drain，但独立实现：
- `tasks/`：有 slot、有退款、有 timeout、有 scheduled
- `image-edit/`：只有 pending/processing/succeeded/failed

上游如果加第三种异步能力（比如 face-swap），很容易再写一遍同样的东西。

### 3.10 部署流

`scripts/vercel-release.ts`、`npm run deploy:vercel`、`--allow-dirty` 的用法，以及 Vercel CLI 直推 vs Git 集成自动部署——今天之前生产实际跑的代码和 HEAD 不一致。防线已加（git-clean guard）但行为层面"脏工作区 + `--allow-dirty` 绕过"还在持续。

---

## 4. 技术债可能堆积的地方

按"严重 → 一般"排序，给出**触发信号**和**建议方向**。

### 4.1 `src/lib/video/service.ts` 成为 God Object

- **信号**：30 天内被改 **10 次**，424 行，同时承担 "模型解析"、"参数归一化"、"provider 分发"、"capabilities 查询"、"admin 模型表单导出" 五件事
- **风险**：下次加 provider 或加 capability 时，service.ts 会更臃肿；改动面积会跨 admin UI + API route + provider adapter
- **建议**：把 "模型解析"（DB 查询 + 归一化）从 "provider 分发"（routing）里拆开，两个独立 entrypoint

### 4.2 限流常量是全局的，不是 per-provider

- **信号**：`batch-queue.ts` 三个常量所有 provider 共用。`grok2api`（自建反代，吞吐高）和 `plato`（三方 SaaS，硬限）被同一参数约束
- **当前做法**：为 grok2api 调优的数字对 plato/yunwu 可能冒险；反之为 plato 保守的数字浪费 grok2api 容量
- **建议**：把这三个常量下沉到 `models` 表的列上（`maxConcurrentSubmissions` / `submissionStaggerMs` / `maxInflightTasks`），`batch-queue` 改成读 model row。Admin UI 可调
- **备注**：今天的 commit `9180a2b` 已经在注释里留了 TODO

### 4.3 tick 是"扫全表"，不是"事件驱动"

- **信号**：`runner.ts` 每分钟扫最近 30 个 task_groups + 200 个 tasks；同步阻塞的 grok2api 占满 300s 预算；多用户挤一条通道
- **当前做法**：已经做到 `Promise.allSettled` 双层并行（group 间、group 内），但本质还是"分钟 poll + 扫描"
- **建议**：中期改造独立 spec，预计迁移到 pgmq（Supabase Postgres 原生 queue，已 available），每个子任务一条消息、每个 provider 独立 consumer 并发池。今天 §2.2 里提到的事件驱动 queue + worker 就是这个
- **备注**：`pgmq` 已在 Supabase 实例 "可用但未安装" 列表，不用再换 vendor

### 4.4 tick 是单一大函数，子模块失败会拖累彼此

- **信号**：`runTaskMaintenance` 串跑 scheduled → batch → polling → timeout。今天之前任何一步抛错整条 cron 就 500，image-edit 虽然拆出去了，但视频域内部还是 all-or-nothing
- **当前做法**：今天已经给 tick 路由包了 try/catch，至少不会 500；但内部 4 件事之间还是"一件抛全链停"
- **建议**：把 4 件事也用 `Promise.allSettled` 彻底隔离，这样 scheduled 出错不影响 polling

### 4.5 脏工作区 + `--allow-dirty` 文化

- **信号**：今天踩 Date-bug 的根因是生产部署了未提交的本地改动。`vercel-release.ts` 已加 git-clean guard，但 `--allow-dirty` 这条逃生门每次都在用（我今天也用了，因为工作区里还有 30 个未提交文件）
- **风险**：下次再出线上 bug 看 SHA 对不上真相，排错效率又会被吃掉
- **建议**：把工作区里那批未提交改动分批 commit 清零；之后 `--allow-dirty` 仅限真·紧急热修时使用（并在 commit message 明确标注）

### 4.6 监控/告警盲区

- **信号**：`pg_cron` 的 `succeeded` 状态其实只是 `pg_net.http_post` 入队成功，不反映 HTTP 真实状态。今天 tick 连挂 1 小时才被人肉发现
- **建议**：建一个每 15min 的监控脚本扫 `net._http_response`，若最近窗口内 `status_code != 2xx` 比例超过阈值推 Webhook（钉钉/Slack/邮件）。已在中期改造里列为独立子项目

### 4.7 slot 逻辑的复杂度黑洞

- **信号**：`fulfillment.ts` **579 行**，是全项目最大的非 generated 文件；混合了 "submit slots"、"advance on result"、"expire deadline"、"refill capacity" 四种逻辑
- **风险**：再加 slot 相关需求（比如"用户可指定 slot 视频时长不同"）会非常危险
- **建议**：按 "slot lifecycle state machine" 视角拆成 4 个小文件：`slot-init.ts` / `slot-submit.ts` / `slot-advance.ts` / `slot-expire.ts`；共享读写放 `slot-repo.ts`

### 4.8 未提交的图片 / 调试脚本散落仓库根目录

- **信号**：仓库根一堆 `baidu-*.png`、`bing-*.png`、`yandex-*.png`、`.playwright-mcp/` 等 SEO 验证遗留
- **风险**：没进 `.gitignore`，下次 `git add .` 会被误提交；`.env.vercel.production` 已在根目录但被放进工作区了
- **建议**：给 SEO 验证产物一个 `tmp/` 目录 + gitignore

### 4.9 image-edit 和 tasks 的"两份异步调度"

- **信号**：两套独立的 pending/processing/failed 状态机、两个 cron、两个并发池常量
- **当前风险**：低（都工作正常）；但加第三种异步能力（face-swap 已经在目录里，还没接异步）时会出现第三份
- **建议**：等 4.3 做完，pgmq 就是天然的共享抽象；face-swap 新接的时候直接走 queue

### 4.10 `tests/` 覆盖不均匀

- **信号**：video providers / image-edit / generate 有测试；tasks/ 里 runner / fulfillment / reconciliation 这三个最复杂的没有直接单测（只有 batch-processing 和 batch-queue 有）
- **风险**：最容易出回归的地方没有测试兜底
- **建议**：至少给 `runner.ts` 补 integration 风格的测试（mock provider，跑一轮 tick 验证 task_items 状态流转）

---

## 附：当前生产部署

- URL: `https://video.yeadon.top`
- 部署 SHA: `086cfde`（perf(batch): parallelize sub-task processing within a group）
- Vercel 项目: `vidclaw-v2`，区域 `hkg1`
- pg_cron jobs 活跃 4 个：tick（每分钟）/ timeout-fallback（每小时第 15 分）/ thumbnail-backfill（每 5 分）/ asset-transform-drain（每分钟）

## 附：新人最快看懂的路径

1. 读 `CLAUDE.md`（顶层）
2. 读 `AGENTS.md`（你正在用的工作规范）
3. 读四个子域 `CLAUDE.md`：`src/lib/tasks/`、`src/lib/video/`、`src/lib/image-edit/`、`src/lib/payments/`
4. 从 `src/app/api/internal/tasks/tick/route.ts` 反查 `runTaskMaintenance` 的四件事
5. 从 `src/lib/video/service.ts` 看 provider 分发
6. 从 `src/lib/db/schema.ts` 对一遍表关系
