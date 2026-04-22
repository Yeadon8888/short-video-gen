# VidClaw 落地页重设计 · 执行计划

> Phase 4 产出。粒度 2-5 分钟/任务。
> 关联：`docs/landing-redesign-spec.md`

---

## 关键前提已确认

| Spec 开放问题 | 你的决策 | 执行影响 |
|---|---|---|
| Q1 样片 | 从 `galleryItems` 表挑 | 运行时 SSR 查询 DB，按 `viewCount × likeCount` 排序选最优 + 每个模型各 1 |
| Q2 数字案例 | ① 短视频带货团队月 90 万带货利润 ② 马来西亚宠物品牌独家合作 | 硬编码 2 张案例卡，配 `视频带货团队` + `马来西亚宠物品牌` 占位 avatar/logo |
| Q3 定价页 | 一起升级 | 纳入本次范围，增加 1-1.5h |

**灵感广场（现 /gallery）效果一般**——本期**不改**，只做两件事：
- 从中挑样片喂给落地页
- 落地页导航不再显眼地指向 /gallery（下放到 footer）

---

## 执行分组（4 组，29 任务，约 6-8 小时）

每组结束是一个 **Review Gate**——跑起来看一眼再进下一组。

### Group A · i18n 基建（1-1.5h · 6 任务）

**产出**：`/zh/*` 和 `/en/*` 路由可用，默认根路径重定向到浏览器语言。

- [ ] **A1** 装依赖：`npm i next-intl` · 验证：`package.json` 新增一行
- [ ] **A2** 新建 `src/i18n/routing.ts` — 定义 locales `['zh','en']`、defaultLocale `'zh'`、pathnames · 验证：`tsc` 通过
- [ ] **A3** 新建 `src/i18n/request.ts` — 实现 `getRequestConfig`，加载 `src/locales/{locale}.json` · 验证：`tsc` 通过
- [ ] **A4** 新建 `src/locales/zh.json` 和 `en.json` — 先占位 5-6 个 key（`nav.login`、`hero.title` 等），后续填 · 验证：文件能被 require
- [ ] **A5** 改 `next.config.ts` — 加 `createNextIntlPlugin()` 包裹；改 `src/lib/supabase/middleware.ts` — 加 `next-intl` middleware 合并逻辑，保持原有 auth 逻辑不破坏 · 验证：`/zh` 和 `/en` 都 200
- [ ] **A6** 把 `src/app/page.tsx` 和 `src/app/layout.tsx` 迁移到 `src/app/[locale]/page.tsx` + `[locale]/layout.tsx`；原 `/` 改 `redirect('/zh')` · 验证：`/` → `/zh`；dashboard 路由（非落地页）不受影响

**Review Gate A**：访问 `/zh` 和 `/en` 都能看到现有 landing；dashboard 正常；登录流正常。

---

### Group B · 落地页重建（3-4h · 15 任务）

**产出**：新落地页覆盖原 `/[locale]/page.tsx`，使用 launch-ui sections + 真实数据。

- [ ] **B1** 新建 `src/lib/landing/samples.ts` — 导出 `getHeroSample()` 和 `getModelSamples()`；前者从 `galleryItems` 按 `viewCount*likeCount` 降序取 1，后者按 `modelSlug` 分组各取 top 1；缓存 5 分钟（`unstable_cache`） · 验证：单独 node 脚本调用能返回数据
- [ ] **B2** 草稿新 `page.tsx` 骨架：import 10 个 launch-ui section 组件 + 占位 props · 验证：编译通过，页面能渲染（内容还不对）
- [ ] **B3** Section 1 · Navbar floating：logo=VidClaw、items=[功能、案例、定价]、actions=[登录、免费生成第一条视频]；**右上角加 `<LocaleSwitcher>` 组件**（自建，`<Select>` 切 zh/en） · 验证：切换语言 URL 变化 + 内容变化
- [ ] **B4** Section 2 · Hero：左 6 词标题（zh "从产品图到爆款视频只需三分钟"、en "From product image to viral ad in 3 minutes"）、副标 ≤18 词、CTA "免费生成第一条视频"；右 `<video autoplay muted loop playsinline>` 播 `getHeroSample().videoUrl` · 验证：样片能自动播放，CTA 链到 `/register`
- [ ] **B5** Section 3 · 8 模型 BentoGrid：用 `getModelSamples()`，每卡片播放对应 modelSlug 样片；标题 "8 个顶级 AI 视频模型，一个账号全搞定" · 验证：8 卡片都显示样片；缺样片的模型用占位缩略图
- [ ] **B6** Section 4 · 3 步流程（`feature/illustration-bottom`）：上传产品图 → 选模型 → 3 分钟出片 · 验证：文案准确，icon 对应
- [ ] **B7** Section 5 · Showcase 分类墙：沿用现有 `<ShowcaseGrid>` 组件，但包一层 launch-ui 风格的 Section title；标题 "不同品类，都能出片" · 验证：ShowcaseGrid 正常渲染
- [ ] **B8** Section 6 · 价值锚点（改造 `stats/grid-boxed`）：4 项 — "$9.9 起 = 100 条视频"、"比外包省 95%"、"失败自动退款"、"3 分钟出片"；**不是定价档位** · 验证：文案和图标对齐
- [ ] **B9** Section 7 · 数字案例（`testimonials/grid`）：2 张大卡 — ① "短视频带货团队 · 月 90 万带货利润 · 用 VidClaw 做批量素材" ② "马来西亚宠物品牌独家合作 · 跨境爆品视频全量外包给 VidClaw" · 验证：文案无歧义，logo/avatar 占位合理（可用 lucide `Store` 和 `PawPrint` 图标代替真实 logo）
- [ ] **B10** Section 8 · FAQ（`faq/static`，5 条）：① 生成失败会退款吗 ② 积分有效期多久 ③ 8 个模型怎么选 ④ 有企业方案吗 ⑤ 支持哪些付款方式 · 验证：每条答案准确，尤其退款条款要和 `/pricing` 一致
- [ ] **B11** Section 9 · CTA box：双按钮 — 主 "免费生成第一条视频" → `/register`，次 "查看定价详情" → `/{locale}/pricing` · 验证：两个按钮链接都对
- [ ] **B12** Section 10 · Footer 5-col：产品/资源/公司/法务/语言——其中"语言"栏放 zh/en 切换 + 版权行 · 验证：链接全部生效或 `#` 占位无断链
- [ ] **B13** 品牌色映射：在 `launch-ui.css` 的 `.launch-ui-root` 内补一条 `--brand: var(--vc-accent);` 和 `--brand-foreground: var(--vc-bg-root);` · 验证：按钮、accent 都呈现 teal 而非 titanium
- [ ] **B14** 填 i18n 文案：把所有硬编码 zh 文本迁移到 `zh.json`，同步翻译 `en.json`；用 `useTranslations()` 读取 · 验证：切 en 时全页英文无遗漏
- [ ] **B15** 清理废代码：原 `HeroDemoAnimation`、`TerminalAnimation`、`FeatureTabs` 如落地页不再引用则从 `src/components/landing/` 删除；保留 `ShowcaseGrid`、`AnimatedCounter`、`ScrollReveal`（仍被用） · 验证：`grep -r "HeroDemoAnimation"` 无引用后再删

**Review Gate B**：`/zh` 和 `/en` 全页能看、能切；8 模型墙样片都在；CTA 都能点；`npm run build` 通过。

---

### Group C · 定价页升级（1-1.5h · 5 任务）

**产出**：`/[locale]/pricing` 用 launch-ui 风格，保留现有 Stripe 结账逻辑。

- [ ] **C1** 把 `src/app/(dashboard)/pricing/page.tsx` 抽离到 `src/app/[locale]/pricing/page.tsx`（脱离 dashboard layout，这样能用 launch-ui 主题） · 验证：`/zh/pricing` 和 `/en/pricing` 都 200
- [ ] **C2** 用 `sections/pricing/3-cols-subscription` 替换现有 UI，保留 3 档：Starter $9.9 / Pro $49（highlight）/ Enterprise 联系；保留现有 Stripe checkout handler 的 onClick 逻辑 · 验证：点击 Pro 档位能跳 Stripe
- [ ] **C3** 在 3 档下方加一段"为什么 VidClaw 值这个价"——2 句话 + 3 个 bullet（失败退款、积分不过期、8 模型任选）· 验证：内容和 FAQ 不重复不矛盾
- [ ] **C4** 加一个小 FAQ 区（4 条定价特有问题）：积分怎么扣、能不能退钱、支持哪些卡、企业折扣联系谁 · 验证：答案与落地页 FAQ 一致
- [ ] **C5** i18n 文案迁移：`pricing.*` 键入 `zh.json` 和 `en.json` · 验证：切 en 时定价页全英文

**Review Gate C**：走通一次 zh → pricing → Stripe checkout（用测试卡）。

---

### Group D · 验证 + 收尾（30-60min · 3 任务）

- [ ] **D1** Playwright MCP 或人工走查：zh 完整浏览 → 切 en → 点 Hero CTA → 点 Pricing → 看 FAQ；截图 3 张放 `docs/landing-after/` · 验证：无 404、无报错、视频都播
- [ ] **D2** `npm run build && npm run lint` 通过 · 验证：0 错 0 警告
- [ ] **D3** 把本 plan 打 ✅、把纠错写入 `lessons.md`（按 workflow doc 的沉淀规范） · 验证：`lessons.md` 存在或更新

---

## 回滚预案

- 任何 Group 出问题：`git reset --hard HEAD~N` 回到组前
- 已上线后发现问题：旧 `/page.tsx` 在 git 历史里，`git revert` 一键恢复
- `next-intl` 引入如果破坏 middleware：删 `next.config.ts` 的 plugin + 回滚 middleware 即可

## 范围外（再次确认不做）

- A/B 测试基建
- 客户 ROAS 真实数据（等有了再替换占位）
- Dashboard、Generate、Admin 页面的 i18n
- `/gallery` 页面改版
- 垂直子落地页

---

## 执行建议

**分两天做**，Day 1 做 A+B（最重），Day 2 做 C+D。
每个 Group 结束**让我停一下**给你看效果，你说继续我才进下一组。
Group B 里任何一个 section 你看着别扭，我当场改，不等整组做完。
