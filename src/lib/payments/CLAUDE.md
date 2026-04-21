# payments

## 目录结构

- `config.ts`：支付配置与充值套餐的读写层。`payments.alipay.config` / `payments.credit_packages` 落 `system_config`；Stripe 密钥走 env。
- `alipay.ts`：支付宝协议适配层，负责签名、验签、下单 URL、交易查询。
- `stripe.ts`：Stripe 协议适配层，负责 SDK 初始化、Checkout Session 创建、webhook 验签、Customer id 持久化。
- `orders.ts`：支付订单领域层，按 provider 分流；Alipay 走异步 notify 入账，Stripe 走 webhook 入账。

## 架构决策

支付不是「积分备注」，而是独立订单域。
`payment_orders` 记录“用户发起了哪一笔支付”；`credit_txns` 记录“这笔支付最终给账户加了多少积分”。
两个事实拆开后，新增渠道、人工补单、退款回滚都不会把账做乱。

**多渠道并存**：Alipay 是 CNY、按 `amountFen` 计费；Stripe 是 USD、按 `amountUsdCents` 计费。`createCreditRechargeOrder` 按 `provider` 入参（默认 `stripe`）分流，调用方不关心底层差异。

**Stripe 幂等性双层防护**：
1. `stripe_events.id` 主键拦截 Stripe 重投递（`onConflictDoNothing`），第二次直接 short-circuit。
2. 订单 update 用 `WHERE status='pending'` 把积分入账卡死在 pending → paid 一次跃迁；即便事件日志竞态写入两次，积分也只加一次。

## 开发规范

- **入账事务三步**：更新订单 → 增加积分 → 写积分流水，必须在同一 `db.transaction` 内，要么都成要么都不成。两条路径（`markPaymentOrderPaidFromNotify`、`markStripeOrderPaid`）都遵守。
- **支付返回页只能展示**，真正到账只信异步通知（Alipay notify / Stripe webhook）或服务端主动查询。
- **Stripe webhook 必须用原始 body 验签**：路由里用 `req.text()` 取原文，不要 `.json()`。
- 渠道差异收敛在 `alipay.ts` / `stripe.ts`，路由文件不直接接触签名/网关参数。
- Stripe webhook 的错误返回区分语义：业务错误（订单不存在、金额异常）返 4xx 让 Stripe 停止重试；瞬时错误返 5xx 让其继续重试。

## 环境变量（Stripe）

- `STRIPE_SECRET_KEY`：服务端 API 密钥（`sk_live_...` / `sk_test_...`）。
- `STRIPE_WEBHOOK_SECRET`：webhook 端点的 signing secret（`whsec_...`），按端点单独轮换。
- `STRIPE_PUBLISHABLE_KEY`：前端可见，目前未在前端使用，预留给后续 Elements/Embedded Checkout。
- `NEXT_PUBLIC_SITE_URL`：用于 success_url / cancel_url 的站点根地址，缺省回落到 `https://video.yeadon.top`。

## 变更日志

- 2026-04-02：新增支付模块，首个渠道接入支付宝网页支付，并把充值正式并入现有积分账本。
- 2026-04-18：接入 Stripe Checkout 作为默认渠道。新增 `stripe.ts` 适配层、`/api/payments/stripe/checkout`、`/api/payments/stripe/webhook` 与 `stripe_events` 幂等表；`payment_orders` 默认 provider 改为 `stripe`，`createCreditRechargeOrder` 按 provider 分流。Pricing 页 starter/pro 改为跳转 Stripe，enterprise 仍走微信。
