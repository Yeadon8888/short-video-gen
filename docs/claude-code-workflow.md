# Claude Code 产品开发最佳实践工作流

调研范围：Anthropic 官方文档、Boris Cherny（Claude Code 作者）、Jesse Vincent（Superpowers 作者）公开分享、GitHub 头部框架源码、Medium/Dev.to 工程师实战记录，覆盖 2025 年 10 月到 2026 年 4 月的主流实践。

---

## 一、认知层：为什么 2026 年的工作流长这样

### 1. 核心约束

Claude 的上下文窗口 200K，填满后性能显著下降。Claude Code 自己的系统提示就吃掉大约 50 个有效指令槽位（总容量约 150-200），真正留给你写规则的不到 100 个。CLAUDE.md 里的指令大约有 70% 的遵守率，对风格偏好够用，对"不许删生产数据"这种硬约束就不够。

所以**所有工作流都在干一件事：控制什么时候加载什么上下文，并在错的时候清掉**。

### 2. 2025 → 2026 的根本变化

- 2025 年：开发者手动管理 context、写长 prompt、多轮纠偏。
- 2026 年：harness（Claude Code 本身）自动管理，开发者从"上下文管理者"变成"结果规约者"（outcome specification）。

变化带来的实际差别：
- 不再需要手动 `/clear`，自动 compaction 处理
- 不再需要复杂的研究/规划自定义命令，`/plan` 加自然语言搞定
- 长会话（几小时到一天）成为主流，让上下文跨任务累积
- Boris Cherny 在 Opus 4.5 之后 47 天里 46 天在用，最长单次 session 跑了 1 天 18 小时 50 分钟，不再手写一行代码

---

## 二、从 idea 到产品的 7 阶段端到端工作流

这套流程在 Superpowers、BMAD、SpecKit、gstack 四大框架里高度一致，只是强制程度不同。下面按实际操作顺序展开，每一阶段说明目的、工具、触发提示词。

### Phase 1 · Brainstorm（苏格拉底式逼问）

**目的**：把一个糙想法逼成一份明确的 spec。AI 默认会直接开始写代码，这个阶段的核心就是**不让它写**。

**Superpowers 的关键发现**（来自 Jesse Vincent 的 v4.3 release note）：纯描述性的 skill 指令（advisory）会被 AI 合理化跳过。有效的写法是硬门（hard gate）：

```
do not invoke any implementation skill, write any code,
or scaffold any project until you have presented a design
and the user has approved it.
```

**实操命令**（装 Superpowers 后）：

```bash
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace

# 启动一次头脑风暴
/superpowers:brainstorm "你的想法一句话"
```

或者裸跑 Claude Code，手动说：

```
我有一个想法：<描述>。不要写代码，不要 scaffold，不要讨论技术栈。
先问我 3 个关键问题帮我厘清：谁是用户、他要完成什么任务、
衡量成功的指标是什么。每次只问一个问题，等我回答再进下一个。
```

**产出**：一份 `docs/design.md`，包含问题、用户、核心 flow、范围内/外功能。

### Phase 2 · UI/视觉方向（可选，但对前端产品价值巨大）

主流有三条路线，按你 Claude Code 主力的定位：

**路线 A · Stitch（Google Labs 出品，免费，推荐轻量）**

装 stitchkit 插件后：

```bash
/stitch-setup  # 一条命令装 Stitch、Figma、NanoBanana 三个 MCP
```

然后直接说 `"设计一个健身追踪 app 首页，深色主题，活力配色"`，Stitch MCP 会返回可编辑 UI，再通过 `react-components` skill 直接转 React。

**路线 B · Figma MCP + Claude Code to Figma（有 Figma 账号的团队）**

Claude Code 在浏览器里构建出 UI 后，打一句 `"Send this to Figma"` 就会把运行中的 UI 抓成可编辑 Figma layers。团队在 Figma 里标注、发散，再通过 Figma MCP 把改动带回代码。

**路线 C · v0/Shadcn Skills（最快上手，产品化）**

shadcn 官方出了 Skills，装上后 Claude 自动读 `components.json`，知道你项目的 framework/aliases/已装组件，第一次生成就直接对得上。配合 Shadcnblocks-Skill（2500+ 预制 blocks），描述"我要一个 SaaS 定价页 + FAQ + 页脚"，Claude 自己挑 block、装、组装。

### Phase 3 · Spec/PRD（把设计稿和 flow 变成机器可执行的契约）

这一步是 Spec-Driven Development（SDD）的核心。GitHub 的 Spec-Kit、Amazon 的 Kiro、gotalab/cc-sdd 都是同一套思路。

**cc-sdd（Kiro 风格，对中文友好，一条命令装好）**：

```bash
npx cc-sdd@latest --lang zh-TW  # 或 --lang zh
```

装完后固定流程：

```
/kiro-spec-init           # 初始化 spec 骨架
/kiro-spec-requirements   # 需求（谁、做什么、何时算完）
/kiro-spec-design         # 技术设计（架构、数据、接口）
/kiro-spec-tasks          # 拆任务
/kiro-impl                # 开始实现
```

每个阶段是人工 gate，没 approved 不进下一步。

**为什么要 spec**：AddyOsmani 在 O'Reilly 的文章里说得最清楚——spec 是 PRD（用户视角的 why）加 SRS（给 AI 的 what），写进仓库，和代码一起 version control。不是文档，是契约。

### Phase 4 · Plan（把 spec 拆成 2-5 分钟粒度的任务）

Superpowers 的 `writing-plans` skill 有一条硬规矩：每个任务粒度 2-5 分钟，必须写清"改哪个文件、完整代码、怎么验证"。粒度大了 AI 会偏航。

**Boris Cherny 的个人技巧**（他在 X 上公开的）：让 Claude 在 Plan Mode 下出计划，然后**开第二个 Claude 会话审计这个计划**，确认后再编码。两个独立 context 交叉校验，比单会话自检靠谱得多。

Plan Mode 进入方式：`Shift+Tab` 两次。特点：只读，不改文件。计划按 `Ctrl+G` 可以直接在编辑器里改。

**反复迭代的保险句**：改完计划发回去时必须加上 `"address all notes, don't implement yet"`。少了后半句，Claude 会直接开始写代码。

### Phase 5 · TDD 实现（红绿蓝）

Claude 默认会先写实现再补测试，正好反了。TDD 需要显式强制：

```
Write a FAILING test for <feature>. Do NOT write implementation yet.
Show me the test and confirm it fails.
```

Superpowers 的 TDD skill 把三个阶段拆成三个 subagent，互相看不见对方的实现，测试真正反映需求：

- 🔴 **RED**：`tdd-test-writer` subagent 写失败测试
- 🟢 **GREEN**：`tdd-implementer` subagent 只看测试，写最小实现
- 🔵 **REFACTOR**：`tdd-refactorer` subagent 改进实现

配置一次大约 2 小时，之后每个 feature 自动走完循环。HouseofMVPs 的 Ultraship 插件也是同一思路但更轻量，`claude plugin add ultraship` 一条命令。

**数据**：Claude Code Tips for 2026 统计，TDD 带来 70% 更少的生产 bug，50% 更快的调试速度，90% 的测试覆盖率（vs 没 TDD 的 40%）。

### Phase 6 · 自动化验证（Boris 说这是质量提升 2-3 倍的关键）

**Boris Cherny 的原话**：Claude 在能验证自己工作的时候表现远更好。给它反馈回路，它能自我纠正；不给反馈回路，它就在猜。

三种主流验证方式：

**方式 1 · Playwright MCP（前端/全栈必备）**

```bash
claude mcp add playwright npx @playwright/mcp@latest
/mcp  # 验证连接
```

连好后直接说 `"use playwright mcp to 测试登录流程"`，Claude 自己开浏览器、点按钮、截图、读 DOM、发现问题。alexop.dev 的案例里，用 Claude Code + Playwright MCP 写了一个叫 "Quinn" 的自动 QA agent，每次 PR 触发 GitHub Action，跑 7 分钟出验收报告。

**方式 2 · PostToolUse Hook 自动跑测试**

`.claude/settings.json`：

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "command": "npm test --watchAll=false 2>&1 | head -20"
    }]
  }
}
```

每次改文件 Claude 自动看到测试结果。

**方式 3 · Chrome 扩展（前端可视化验证）**

Claude Code 的 Chrome 扩展可以开浏览器、测 UI、截图、对比。Boris 在 X 上说这是前端开发者最强的验证工具。

### Phase 7 · Finalize（收尾、合并、沉淀）

Superpowers 的 finalize 阶段自动清 worktree，offer 三个选项：开 GitHub PR、merge 回主分支、或者丢掉。

**最有价值的沉淀动作**：每次 Claude 出错被纠正，让它自己写进 `lessons.md`。Boris 的原话："Claude is eerily good at writing rules for itself。" 一句 prompt：

```
你刚才犯的这个错误，写一条规则进 lessons.md，
防止未来的你再犯。
```

这个 `lessons.md` 通过 `@lessons.md` 引用进 CLAUDE.md。一个月后你的 CLAUDE.md 会变成该项目专属的 AI 编码手册。

---

## 三、多项目并行的 3 层机制

按粒度从小到大。

### 机制 1 · Subagent（同一会话内的分身，无需外部工具）

单个 Claude session 开 subagent，每个 subagent 独立 context。`.claude/agents/` 下放 markdown 文件定义：

```yaml
---
name: security-reviewer
description: Reviews code for security vulnerabilities
tools: Read, Grep, Glob, Bash
model: opus
---
You are a senior security engineer. Review code for...
```

显式触发：`"use the security-reviewer subagent to check this"`。

Claude Code 2.1 起支持 **background execution**：`Ctrl+B` 把 subagent 丢后台，主线程继续干别的，subagent 完事会发消息叫醒主线程。实测最多可以同时跑 7 个并行 subagent（官方文档数据）。

### 机制 2 · Git Worktree（同一项目多分支并行）

```bash
# 官方命令
claude --worktree feature-auth
claude --worktree bugfix-123

# 或手动
git worktree add ../myapp-feature feature/new-dashboard
cd ../myapp-feature && claude
```

每个 worktree 共享 `.git` 但有独立工作目录。你可以在 worktree A 里重构认证，worktree B 里修 bug，互不干扰。

**配置技巧**：项目根加 `.worktreeinclude` 文件列出 `.env.local` 等未版本化的文件，创建 worktree 时自动复制。

### 机制 3 · Agent Teams（Claude Code 2.1.32+，同项目多 Claude 协作）

```bash
# settings.json 开启
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

跟 subagent 的关键差别：Agent Teams 里的 teammate **互相能直接通讯**，不只是向 lead 汇报。适合"4 个人一起审一个大 PR"、"5 个人互相挑战假设找 bug"这种协作任务。

Anthropic 自己用 16 个 agent + 近 2000 个 session 写了一个 Rust 版 C 编译器，10 万行代码，API 成本 2 万美元。这是 Agent Teams 的上限标杆。

### 实战配置（Rushabh Doshi / Hiro 工程师的方案）

他是这么干的（在小-中型 monorepo 上实战）：

- 5 个 checkouts，5 个 tmux 窗口，每个 checkout 独立 sqlite、独立 dev server
- 不用 git-worktree（他们项目有 sqlite 迁移依赖，worktree 处理不好）
- 大脑上限：同时跑 3-4 个 Claude，第 5 个留给零散任务
- 超过 2 小时三个并行会脑子炸

Boris 本人是另一个极端：10-15 个 session（5 个终端 tab + 5-10 个 web + 手机几个），每个一个 worktree。

**取舍原则**：并行数受限于你能 review 几个不同 context。不要过度并行，code generation 不再是瓶颈，你的审核能力才是。

---

## 四、工具栈推荐（按投入回报排序）

### 必装（第一周搞定）

1. **Superpowers**（9.4 万 star）—— 覆盖 brainstorm/plan/TDD/subagent/review 完整方法论，一条命令安装，无配置
2. **CLAUDE.md**（项目根）—— Boris 模板：100 行以内，项目结构、命令、风格、3 条硬原则（"做最简单的改动"、"找根因不贴补丁"、"只动必要的"）
3. **Playwright MCP** —— 前端/全栈必备反馈回路

### 推荐（第二周加）

4. **shadcn Skills + Shadcnblocks-Skill** —— 如果做前端，第一次生成就对口
5. **Stitch Skills** —— UI 快速原型，免费
6. **自定义 slash command**（`.claude/commands/`）—— 每天重复的 prompt 做成命令，比如 `/new-component`、`/feature-spec`

### 按需（特定场景）

7. **BMAD-METHOD** —— 大型 greenfield 项目，5+ 人团队，需要严格 SDLC
8. **cc-sdd (Kiro 风格)** —— 企业场景，要强制 spec gate 和团队协作
9. **Figma MCP** —— 有设计师参与的协作
10. **Agent Teams** —— 大型代码库审计、多假设并行调试

---

## 五、避坑提醒（从实战血泪里提炼）

### 关于 context

- 不要搞 "kitchen sink session"（一个会话里干多件无关事），`/clear` 很便宜
- CLAUDE.md 控制在 200 行内，每行问自己"删掉这行 Claude 会不会出错？不会就删"
- 上下文快满时，先 dump 当前进度到 markdown，再 `/clear`，让 Claude 读 markdown 继续，比 `/compact` 可控

### 关于 prompt

- 糙 prompt 往往反而好，让 Claude 先问清楚再动手（Socratic prompting）
- 硬约束用 hook/settings.json 强制，不要写在 CLAUDE.md（70% 遵守率对硬约束不够）
- 每次纠错 Claude 时，让它自己写规则进 lessons.md

### 关于验证

- 没有反馈回路 = 猜。每个新功能先想清楚怎么验证
- TDD 不是"加个测试"，是顺序强制（测试先写、看到失败、再实现）
- Playwright MCP 第一次用要显式说 `"use playwright mcp"`，否则 Claude 会去 bash 里找 playwright

### 关于并行

- worktree 适合独立任务，不适合有共享数据库迁移/外部依赖的项目
- Agent Teams 擅长"并行探索"（多假设验证、多模块 review），不擅长"并行实现"（两个 agent 改同一文件会冲突）
- 3-4 个并行是大多数人的认知上限，不是工具上限

---

## 六、给 VidClaw 团队的实战建议

结合本项目（VidClaw v2，Next.js 16 AI 视频 SaaS）+ 周边产品线（Glumoo、OpenClaw、ToB 咨询）的落地路径。

### 短路径建议

**本周投入 4 小时**：

1. 装 Superpowers（30 分钟试跑一次 brainstorm→plan→execute 闭环）
2. 给 OpenClaw 仓库写一份 100 行以内的 CLAUDE.md，记下你自己的编码原则、常用命令、"不要做 X"
3. 跑一次 `/superpowers:brainstorm` 对 VidClaw 的某个小需求，感受 brainstorm 硬门拦住你直接写代码的感觉

**下周开始**：

4. 每个客户交付项目用独立 worktree，避免 context 污染
5. 前端相关交付挂 Playwright MCP，让 Claude 自己截图验证
6. 建立你的 `~/.claude/commands/` 个人命令库，把 VidClaw 批量生产、Glumoo 内容生产里重复的 prompt 做成 slash command

**一个月内**：

7. 把你 ToB 咨询的标准交付流程（需求访谈 → 架构建议 → 落地方案）也变成一个 Superpowers 风格的 skill 集合，每次客户项目直接 `/consulting:new`

---

## 参考资料（原始链接，按权威度排序）

**官方文档**
- Claude Code Best Practices: https://code.claude.com/docs/en/best-practices
- Common Workflows: https://code.claude.com/docs/en/common-workflows
- Agent Teams: https://code.claude.com/docs/en/agent-teams

**Boris Cherny（Claude Code 作者）**
- CLAUDE.md 公开分享: mindwiredai.com/2026/03/25/claude-code-creator-workflow-claudemd/
- 中文整理版: zhuanlan.zhihu.com/p/2009744974980331332

**Jesse Vincent（Superpowers 作者）**
- Superpowers 初代设计: blog.fsck.com/2025/10/09/superpowers/
- v4.3 硬门发现: blog.fsck.com/releases/2026/02/12/superpowers-v4-3-0/
- GitHub: github.com/obra/superpowers

**框架对比**
- 四大框架横评: medium.com/@richardhightower/the-great-framework-showdown-superpowers-vs-bmad-vs-speckit-vs-gsd
- 实战约束维度分析: medium.com/@tentenco/superpowers-gsd-and-gstack-what-each-claude-code-framework-actually-constrains

**具体实战**
- SDD 一天迁移 15 文件: alexop.dev/posts/spec-driven-development-claude-code-in-action/
- TDD subagent 配置: alexop.dev/posts/custom-tdd-workflow-claude-code-vue/
- QA agent Quinn: alexop.dev/posts/building_ai_qa_engineer_claude_code_playwright/
- 多 claude 并行（Hiro）: rushabhdoshi.com/posts/2026-01-11-multiclauding-like-a-boss/

**中文资源**
- 得物技术 Spec Coding 实战: zhuanlan.zhihu.com/p/2015365442928140835
- 腾讯新闻 AI 产品经理工作流: news.qq.com/rain/a/20251014A05CXG00
- Claude Code 从入门到精通 v2（PDF）: pub-161ae4b5ed0644c4a43b5c6412287e03.r2.dev/latest/claude-code.pdf
