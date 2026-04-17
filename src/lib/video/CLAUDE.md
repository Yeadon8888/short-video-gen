# video

## 目录结构

- `service.ts`：视频模型与 provider 的统一入口，只负责解析模型、合并默认参数、分发到具体供应商适配器。
- `types.ts`：视频生成、任务状态、脚本产物的共享类型边界。
- `model-default-params-form.ts`：管理后台模型默认参数编辑器的纯转换逻辑。
- `providers/plato.ts`：BLTCY / Plato 协议适配器。
- `providers/yunwu.ts`：Yunwu 视频协议适配器，负责 `/v1/video/create` 与 `/v1/video/query`。
- `providers/shared.ts`：供应商共用的失败分类、比率映射与响应解析工具。

## 架构决策

供应商差异必须被关进 `providers/`，不能泄漏到任务域或页面层。
模型配置可以自由变化，但任务生命周期不应该感知“这家是 Plato，那家是 Yunwu”。
真正稳定的边界只有两件事：
创建任务，查询任务。
凡是供应商私有的 URL、字段名、状态词、失败文案，都应在适配器内消化。
失败分类属于横切规则，但不属于任何单一供应商，所以抽到 `providers/shared.ts`，避免每加一家就复制一份“敏感词 / 限流 / 超时”判断。

## 开发规范

- 新增视频供应商时，优先加新 adapter，不要继续在已有 provider 里堆 `if provider === ...`。
- `service.ts` 只做注册与分发，不写供应商私有协议细节。
- 后台 `defaultParams` 只保存真正的模型默认值；供应商专属扩展放 `providerOptions`，不要污染通用字段。

## 变更日志

- 2026-03-31：新增 `yunwu` 视频供应商适配器，并把视频供应商共用失败分类与比例映射下沉到 `providers/shared.ts`。
