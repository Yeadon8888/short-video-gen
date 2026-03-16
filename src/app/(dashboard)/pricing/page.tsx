"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Zap,
  Crown,
  Building2,
  Check,
  Clock,
  X,
  Sparkles,
  MessageCircle,
} from "lucide-react";
import Image from "next/image";

// ─── Countdown target: 7 days from first deployment (fixed date) ───
// You can update this date whenever you want to reset the countdown
const PROMO_END = new Date("2026-03-23T23:59:59+08:00");

function useCountdown(target: Date) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return useMemo(() => {
    const diff = Math.max(0, target.getTime() - now.getTime());
    const days = Math.floor(diff / (86400 * 1000));
    const hours = Math.floor((diff % (86400 * 1000)) / (3600 * 1000));
    const minutes = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
    const seconds = Math.floor((diff % (60 * 1000)) / 1000);
    return { days, hours, minutes, seconds, expired: diff === 0 };
  }, [now, target]);
}

// ─── Plans ───

const plans = [
  {
    id: "starter",
    name: "体验包",
    price: 9.9,
    originalPrice: 19.9,
    credits: 50,
    icon: Zap,
    color: "from-blue-500 to-cyan-400",
    border: "border-blue-500/30",
    features: ["50 积分", "约 5-10 条视频", "全模型可用", "7 天有效期"],
  },
  {
    id: "pro",
    name: "创作者套餐",
    price: 50,
    originalPrice: 99,
    credits: 500,
    icon: Crown,
    color: "from-[var(--vc-accent)] to-purple-400",
    border: "border-[var(--vc-accent)]/40",
    popular: true,
    features: [
      "500 积分",
      "约 50-100 条视频",
      "全模型可用",
      "30 天有效期",
      "优先排队",
      "自定义 Prompt",
    ],
  },
  {
    id: "enterprise",
    name: "企业部署",
    price: null,
    credits: null,
    icon: Building2,
    color: "from-amber-400 to-orange-500",
    border: "border-amber-500/30",
    features: [
      "无限积分",
      "私有化部署",
      "接入龙虾自动化数字员工",
      "API 对接",
      "专属客服",
      "定制开发",
    ],
  },
];

export default function PricingPage() {
  const countdown = useCountdown(PROMO_END);
  const [qrOpen, setQrOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  function handleSelect(planId: string) {
    setSelectedPlan(planId);
    setQrOpen(true);
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

      {/* ═══ Countdown Banner ═══ */}
      {!countdown.expired && (
        <div className="mx-auto max-w-lg">
          <div className="relative overflow-hidden rounded-2xl border border-[var(--vc-accent)]/30 bg-gradient-to-r from-[var(--vc-accent)]/5 to-purple-500/5 px-6 py-4">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-[var(--vc-accent)]/10 blur-2xl" />
            <div className="relative flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[var(--vc-accent)]" />
                <span className="text-sm font-bold text-white">限时优惠</span>
              </div>
              <div className="flex items-center gap-2">
                {(
                  [
                    ["天", countdown.days],
                    ["时", countdown.hours],
                    ["分", countdown.minutes],
                    ["秒", countdown.seconds],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex items-center gap-1">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--vc-bg-elevated)] font-mono text-lg font-bold tabular-nums text-white">
                      {String(value).padStart(2, "0")}
                    </span>
                    <span className="text-xs text-[var(--vc-text-muted)]">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
                {plan.price !== null ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-white">
                      ¥{plan.price}
                    </span>
                    {plan.originalPrice && (
                      <span className="text-lg text-[var(--vc-text-dim)] line-through">
                        ¥{plan.originalPrice}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-2xl font-bold text-amber-400">
                    定制方案
                  </div>
                )}
                {plan.price !== null && plan.credits && (
                  <p className="mt-1 text-sm text-[var(--vc-text-muted)]">
                    ≈ ¥{(plan.price / plan.credits * 10).toFixed(1)}/条视频
                  </p>
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
                className={`w-full rounded-xl py-3 text-sm font-bold transition-all duration-200 ${
                  plan.popular
                    ? "bg-gradient-to-r from-[var(--vc-accent)] to-purple-500 text-white shadow-lg shadow-[var(--vc-accent)]/25 hover:shadow-[var(--vc-accent)]/40"
                    : isEnterprise
                      ? "border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                      : "border border-[var(--vc-border)] bg-[var(--vc-bg-elevated)] text-white hover:bg-white/[0.08]"
                }`}
              >
                {isEnterprise ? "联系我们" : "立即充值"}
              </button>
            </div>
          );
        })}
      </div>

      {/* ═══ Notice ═══ */}
      <div className="mx-auto max-w-lg space-y-3">
        <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
          <MessageCircle className="h-5 w-5 shrink-0 text-blue-400" />
          <div className="text-sm text-blue-300/90">
            <p className="font-medium">支付接口正在开发中</p>
            <p className="mt-0.5 text-blue-300/70">
              当前采用微信扫码 + 人工确认的方式充值，付款后请备注邮箱，通常 5 分钟内到账。
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <Building2 className="h-5 w-5 shrink-0 text-amber-400" />
          <div className="text-sm text-amber-300/90">
            <p className="font-medium">企业部署 & 龙虾自动化数字员工</p>
            <p className="mt-0.5 text-amber-300/70">
              支持私有化部署、API 接口对接、接入龙虾自动化数字员工体系，按需定制。
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
                <h3 className="text-xl font-bold text-white">
                  {selectedPlan === "enterprise"
                    ? "企业咨询"
                    : "微信扫码付款"}
                </h3>
                <p className="mt-1 text-sm text-[var(--vc-text-muted)]">
                  {selectedPlan === "enterprise"
                    ? "扫码添加微信，详细沟通需求方案"
                    : `付款 ¥${plans.find((p) => p.id === selectedPlan)?.price ?? ""} 后备注您的注册邮箱`}
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

              {selectedPlan !== "enterprise" && (
                <div className="space-y-2 text-sm text-[var(--vc-text-secondary)]">
                  <div className="flex items-center justify-center gap-2">
                    <Clock className="h-4 w-4 text-[var(--vc-accent)]" />
                    <span>付款后通常 5 分钟内到账</span>
                  </div>
                  <p className="text-xs text-[var(--vc-text-dim)]">
                    请备注您的注册邮箱，以便我们为您充值积分
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
