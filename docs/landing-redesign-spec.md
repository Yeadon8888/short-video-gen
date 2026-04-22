# VidClaw 落地页重设计 · Spec

> Phase 1 Brainstorm 产出。遵循 `docs/claude-code-workflow.md` 的 7 阶段流程。
> 日期：2026-04-22

---

## 1. 目标与成功指标

**唯一 North Star**：落地页 PV → 30 天内首次付费转化率（b）。
**辅助观察**：合格访客停留时长（看完 Hero + 8 模型墙 ≥ 60s）。
**非目标**：注册数、PV、SEO 流量——这些是输入不是结果。

**取舍结论**：选"付费转化"而非"注册数"意味着——
- 定价信号要**部分前置**（不是 Stripe 档位表，是 ROI 对比）
- 客户质量 > 数量，落地页可以"劝退"价值观不匹配的访客（例如个人用户）
- FAQ 必须解决付费阻力（退款、积分有效期、企业方案）

## 2. 目标访客画像

选 E（全都要）+ i18n。这决定：
- **主落地页讲通用价值**（跨境电商、国内达人、DTC、MCN 都 resonate）
- 后续可加垂直子页（`/for-ecommerce`、`/for-agency`），本次不做
- 语言支持：**zh 简体 + en 两种**

## 3. 访客主任务

**① 30-90 秒内判断"这工具能不能干我的活"**
- 主任务：看到真实产出，判断质量
- 支撑任务：算清价格值不值、看到退款条款、信任能建立

## 4. 落地页骨架（10 个板块）

基于对标 6 家（Arcads / Creatify / Topview / HeyGen / Runway / InVideo）合成 + VidClaw 独家武器。

| # | 板块 | 来源组件 | 核心决策 |
|---|---|---|---|
| 1 | Navbar | `sections/navbar/floating` | 浮动式；右上角 zh/en 切换（不是 footer） |
| 2 | Hero | `sections/hero/illustration` | 左：6 词标题 + ≤18 词副标 + 单一 CTA；右：自动播放 9:16 最强样片 loop |
| 3 | **8 模型样片墙** | `sections/bento-grid/3-rows-top` | **护城河**。8 卡片各播该模型的 loop，标签清晰 |
| 4 | 3 步流程 | `sections/feature/illustration-bottom` | 上传图 → 选模型 → 出片 |
| 5 | Showcase 品类墙 | 复用现有 `ShowcaseGrid` | 服装/3C/美妆/家居分类 |
| 6 | **价值锚点（新）** | `sections/stats/grid-boxed` 改造 | "$9.9 = 100 条视频 · 比外包省 95% · 失败自动退款"——不是定价表，是替代方案对比 |
| 7 | 数字案例 | `sections/testimonials/grid` | 卖家 ROAS 数据（前期可占位，上线后替换） |
| 8 | FAQ | `sections/faq/static` | 5 条：退款 / 积分有效期 / 模型差异 / 企业方案 / 付款方式 |
| 9 | CTA box | `sections/cta/box` | 双按钮：「免费生成第一条视频」+「查看定价 → `/pricing`」 |
| 10 | Footer | `sections/footer/5-columns` | 产品 / 资源 / 公司 / 法务 / 语言 |

**关键设计决策**：
- CTA 主文案：**"免费生成第一条视频"**（动词具体 > 通用 "Start free"）
- Hero 样片必须 **autoplay + muted + loop**，不放 play 按钮
- 8 模型墙每个模型独立样片 loop——这是 VidClaw 独家，对标 6 家没有
- 定价档位**不**在首页——降低认知负担，首页只做"值"的铺垫，`/pricing` 做"买哪档"的决策

## 5. 视觉语言

- **主色**：保留 `--vc-accent` 青绿色（已有品牌识别度，Arcads 也是 teal/charcoal）
- **主题**：dark（对标 Arcads/Runway/Topview，premium 默认深色）
- **字体**：沿用现有（launch-ui 用 Geist，vidclaw 可对齐）
- **留白 & 动画**：克制。Runway 和 Arcads 的"高端感"来自：(a) 单一强调色 (b) 大留白 (c) 动画只用于样片，文字不动
- **落地**：把 launch-ui 的 `--brand` 映射到 `--vc-accent`，实现主题复用不失品牌

## 6. 技术决策

### 6.1 i18n
**推荐**：`next-intl` v3（App Router 原生支持，约 50KB gz）
- 路由结构：`/zh/*` 和 `/en/*`，默认 `/` 重定向到浏览器语言
- 文案集中在 `src/locales/zh.json` 和 `en.json`，类型安全
- 格式化（数字、日期、货币）开箱即用

**不推荐**：自研路由分组 + 字典对象——2 种语言能 hold 住，但后续 dashboard 也要 i18n 时要重写

**取舍**：`next-intl` 的配置是一次性代价（约 2 小时），换来后续所有页面的复用

### 6.2 组件复用策略
- 沿用当前 `/landing-preview` demo 的 launch-ui 命名空间方案（`src/components/launch-ui/*`）
- 不修改已有的 CSS 作用域隔离（`.launch-ui-root` wrapper）
- 新落地页直接覆盖 `src/app/page.tsx`（旧版本走 git 回滚）
- 保留现有 `HeroDemoAnimation` 和 `ShowcaseGrid` 作为"产品特色插槽"填入 launch-ui 的结构

### 6.3 资源需求
- **急需**：1 条 9:16 最强样片视频（Hero 用）
- **急需**：8 条各模型样片（每条 3-5 秒，9:16，静音可循环）
- **稍后**：真实客户 ROAS 截图/数据（数字案例板块，上线后替换占位）
- **可选**：4-6 家客户 logo（暂可用现有 launch-ui 占位 logo）

## 7. 范围外（本期不做）

- 垂直子落地页（`/for-ecommerce` 等）
- A/B 测试基建（先跑一版看数据再说）
- 博客、帮助中心改版
- Dashboard i18n（本期只覆盖落地页 + 定价页 + 注册登录）
- 企业销售通道（Calendly 嵌入等，放 v2）

## 8. 开放问题（执行前需确认）

1. 你手头**立刻能给**的样片有几条？Hero 1 条 + 8 模型各 1 条 = 9 条最少。如果没有，是我从你 `/gallery` 抓取，还是你重新生成一批？
2. 真实客户的 ROAS/GMV 数据**这一期能用吗**？不能的话数字案例板块用占位+"暂不公开"措辞，还是直接砍掉？
3. `/pricing` 现有页是否需要同步重做？本 spec 不包含定价页改造，但从落地页跳过去应该风格一致。

---

## 下一步

Spec 你 review 完 → 批准 → 进 **Phase 4 Plan**：
拆成 2-5 分钟粒度的任务（写哪个文件、改哪行、怎么验证），写入 `docs/landing-redesign-plan.md`。
Plan 批准后 → **Phase 5 执行**（一边做一边用 Playwright MCP 或人工验证）。
