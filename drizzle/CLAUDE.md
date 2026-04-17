# drizzle

## 目录结构

- `0000_*.sql` ~ `0009_*.sql`：按时间递进的数据库迁移，数据库真实演化历史只认这里。
- `meta/_journal.json`：迁移账本，声明每个 SQL 文件的顺序与标签。

## 架构决策

数据库枚举一旦进入生产，就是状态机边界的一部分。
新增模型能力时，优先补 enum 迁移，而不是指望应用层偷偷兼容字符串。
模型能力扩张必须和业务语义同步演进；这次 `script_generation` 进入枚举，意味着“脚本分析模型”正式成为后台可配置的一等能力。
支付不是“积分备注”，而是独立订单域。`payment_orders` 的存在是为了把“支付成功”与“积分入账”拆成可审计、可重试、可回查的两个事实。

## 开发规范

- 新增迁移时，同时更新 `_journal.json`，不要让 SQL 文件变成孤儿。
- 只做 schema 演化，不在迁移里混业务回填脚本，除非没有别的安全入口。

## 变更日志

- 2026-03-30：新增 `0007_script_generation_capability.sql`，把脚本分析模型能力加入 `model_capability` 枚举。
- 2026-04-02：新增 `0009_alipay_payment_orders.sql`，引入 `payment_orders`、支付状态枚举和 `credit_txn_type=payment`，让支付充值正式并入统一账本。
