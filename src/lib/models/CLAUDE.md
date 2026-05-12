# models

## 目录结构

- `capabilities.ts`：模型能力枚举与类型守门，只负责定义能力边界。
- `repository.ts`：模型查询入口，按能力获取启用模型，避免业务层直接拼条件。

## 架构决策

模型不再默认等同于“视频模型”。
能力是第一维：`video_generation`、`image_edit`、`script_generation` 共享同一张表，但运行时必须按能力过滤，避免后台配置语义混淆。
前置脚本分析模型不能再藏在环境变量里；后台模型管理才是 AI 能力的唯一真相源。环境变量只允许做兜底，不允许继续做主配置。

## 开发规范

- 业务代码不要直接硬编码 capability 字符串。
- 查询启用模型时优先复用 repository，而不是在路由层重复写 SQL 条件。
- 非视频能力不要复用视频默认参数编辑器语义，避免后台误配。

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

## 变更日志

- 2026-03-29：新增模型能力分层，为图片编辑模型配置铺路。
- 2026-03-30：新增 `script_generation` 能力，把 Gemini 脚本分析模型接入后台统一管理；环境变量仅保留兜底。
