"use client";

import { useState } from "react";
import {
  Zap,
  Crown,
  Building2,
  Check,
  X,
  MessageCircle,
} from "lucide-react";
import Image from "next/image";

// ─── Plans ───

// Mirror of payments/config.ts DEFAULT_PACKAGES — keep in sync.
// Stripe charges USD (`amountUsdCents`); the CNY column is shown only for
// reference so users without USD bank cards can roughly compare.
const plans = [
  {
    id: "starter",
    name: "入门版",
    priceUsd: 9.9,
    priceCnyApprox: 70,
    credits: 700,
    expiresInDays: 180,
    icon: Zap,
    color: "from-blue-500 to-cyan-400",
    border: "border-blue-500/30",
    features: [
      "700 积分",
      "约 35 条 Hailuo Fast / 14 条 Sora 2",
      "全模型可用",
      "180 天有效期",
    ],
  },
  {
    id: "pro",
    name: "专业版",
    priceUsd: 49,
    priceCnyApprox: 349,
    credits: 3500,
    expiresInDays: 180,
    icon: Crown,
    color: "from-[var(--vc-accent)] to-purple-400",
    border: "border-[var(--vc-accent)]/40",
    popular: true,
    features: [
      "3500 积分",
      "约 175 条 Hailuo Fast / 70 条 Sora 2",
      "全模型可用",
      "180 天有效期",
      "优先排队",
      "自定义 Prompt",
    ],
  },
  {
    id: "enterprise",
    name: "企业部署",
    priceUsd: null,
    priceCnyApprox: null,
    credits: null,
    expiresInDays: null,
    icon: Building2,
    color: "from-amber-400 to-orange-500",
    border: "border-amber-500/30",
    features: [
      "无限积分",
      "公式化爆款视频拆解",
      "完形填空式内容生产",
      "接入龙虾自动化数字员工",
      "API 对接 & 私有化部署",
      "专属客服 & 定制开发",
    ],
  },
];

export default function PricingPage() {
  const [qrOpen, setQrOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function handleSelect(planId: string) {
    setSelectedPlan(planId);
    setCheckoutError(null);

    if (planId === "enterprise") {
      setQrOpen(true);
      return;
    }

    setCheckoutLoading(planId);
    try {
      const res = await fetch("/api/payments/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packageId: planId }),
      });
      const data = (await res.json()) as { paymentUrl?: string; error?: string };
      if (!res.ok || !data.paymentUrl) {
        throw new Error(data.error ?? "创建支付失败");
      }
      window.location.href = data.paymentUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建支付失败,请稍后再试";
      setCheckoutError(message);
      setCheckoutLoading(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      {/* ═══ Header ═══ */}
      <div className="space-y-4 pt-4 text-center sm:pt-8">
        <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">
          积分充值
        </h1>
        <p className="text-lg text-slate-400">
          选择适合你的套餐，开始 AI 视频创作
        </p>
      </div>

      {/* ═══ Pricing Cards ═══ */}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isEnterprise = plan.id === "enterprise";

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border ${plan.border} bg-[var(--vc-bg-surface)] p-6 transition-all duration-300 hover:shadow-xl hover:shadow-[var(--vc-accent)]/5 ${
                plan.popular ? "ring-2 ring-[var(--vc-accent)]/40" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-gradient-to-r from-[var(--vc-accent)] to-purple-500 px-4 py-1 text-xs font-bold text-white shadow-lg shadow-[var(--vc-accent)]/30">
                    最受欢迎
                  </span>
                </div>
              )}

              {/* Icon + Name */}
              <div className="mb-6 flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${plan.color}`}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  {plan.credits && (
                    <p className="text-sm text-[var(--vc-text-muted)]">
                      {plan.credits} 积分
                    </p>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="mb-6">
                {plan.priceUsd !== null ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-white">
                        ${plan.priceUsd}
                      </span>
                      <span className="text-sm text-[var(--vc-text-muted)]">
                        USD
                      </span>
                    </div>
                    {plan.priceCnyApprox && (
                      <p className="mt-1 text-xs text-[var(--vc-text-dim)]">
                        ≈ ¥{plan.priceCnyApprox} 人民币（仅供参考，实际按 USD 收费）
                      </p>
                    )}
                    {plan.credits && (
                      <p className="mt-1 text-sm text-[var(--vc-text-muted)]">
                        ≈ ${(plan.priceUsd / plan.credits * 10).toFixed(2)}/条视频
                      </p>
                    )}
                  </>
                ) : (
                  <div className="text-2xl font-bold text-amber-400">
                    定制方案
                  </div>
                )}
              </div>

              {/* Features */}
              <ul className="mb-8 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                    <span className="text-slate-300">{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => handleSelect(plan.id)}
                disabled={checkoutLoading === plan.id}
                className={`w-full rounded-xl py-3 text-sm font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
                  plan.popular
                    ? "bg-gradient-to-r from-[var(--vc-accent)] to-purple-500 text-white shadow-lg shadow-[var(--vc-accent)]/25 hover:shadow-[var(--vc-accent)]/40"
                    : isEnterprise
                      ? "border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                      : "border border-[var(--vc-border)] bg-[var(--vc-bg-elevated)] text-white hover:bg-white/[0.08]"
                }`}
              >
                {checkoutLoading === plan.id
                  ? "正在跳转 Stripe..."
                  : isEnterprise
                    ? "联系我们"
                    : "立即充值"}
              </button>
            </div>
          );
        })}
      </div>

      {/* ═══ Notice ═══ */}
      <div className="mx-auto max-w-lg space-y-3">
        {checkoutError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {checkoutError}
          </div>
        )}
        <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
          <MessageCircle className="h-5 w-5 shrink-0 text-blue-400" />
          <div className="text-sm text-blue-300/90">
            <p className="font-medium">充值流程</p>
            <p className="mt-0.5 text-blue-300/70">
              点击「立即充值」跳转 Stripe 完成付款，支付成功后积分自动到账。如需企业部署或定制方案，请使用「联系我们」扫码沟通。
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <Building2 className="h-5 w-5 shrink-0 text-amber-400" />
          <div className="text-sm text-amber-300/90">
            <p className="font-medium">企业部署 · 公式化爆款拆解</p>
            <p className="mt-0.5 text-amber-300/70">
              专业拆解爆款视频逻辑，用「完形填空」的方式做内容生产 —— 让爆款更有规律，内容创作跟喝水一样简单。接入龙虾自动化数字员工，实现视频具体规模化批量生产。
            </p>
          </div>
        </div>
      </div>

      {/* ═══ QR Code Modal ═══ */}
      {qrOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="relative mx-4 w-full max-w-sm rounded-2xl border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setQrOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1 text-[var(--vc-text-muted)] transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-5 text-center">
              <div>
                <h3 className="text-xl font-bold text-white">企业咨询</h3>
                <p className="mt-1 text-sm text-[var(--vc-text-muted)]">
                  扫码添加微信，详细沟通企业部署方案
                </p>
              </div>

              <div className="flex justify-center">
                <div className="overflow-hidden rounded-xl border border-[var(--vc-border)] bg-white p-3">
                  <Image
                    src="/wechat-qr.png"
                    alt="微信二维码"
                    width={220}
                    height={220}
                    className="h-auto w-[220px]"
                  />
                </div>
              </div>

              <p className="text-xs text-[var(--vc-text-dim)]">
                添加好友后备注「企业咨询」，我们会尽快联系您
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
