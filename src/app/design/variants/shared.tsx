import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import type { HeroSample, ModelSample } from "@/lib/landing/samples";

export type Samples = {
  hero: HeroSample | null;
  modelSamples: ModelSample[];
};

export type VariantProps = { samples: Samples };

export const BRAND = {
  name: "VidClaw",
  tagline: "从产品图到爆款视频，只需三分钟",
  sub: "上传一张产品图，选一个 AI 模型，3 分钟得到 9:16 带货成片。Sora 2、VEO 3.1、Hailuo、Seedance 一个账号全搞定。",
  primaryCta: { text: "免费生成第一条视频", href: "/register" },
  secondaryCta: { text: "看样片", href: "#models" },
  values: ["8 模型聚合", "失败退款", "积分不过期", "3 分钟出片"],
  pricingHint: "$9.9 起 · 100 条视频起步",
};

export const VALUE_PROPS: { title: string; desc: string }[] = [
  {
    title: "8 模型聚合",
    desc: "Sora 2 / VEO 3.1 / Hailuo / Seedance / Kling / Plato / Yunwu / Dashscope，一个账号全部调用。",
  },
  {
    title: "失败自动退款",
    desc: "生成失败或超时自动退还积分，不需要客服介入。",
  },
  {
    title: "积分永不过期",
    desc: "按需购买，不绑定订阅；账户余额永久有效，跨模型通用。",
  },
  {
    title: "3 分钟出成片",
    desc: "从上传产品图到得到 9:16 带货成片，平均耗时 3 分钟。",
  },
  {
    title: "批量并发",
    desc: "一个 SKU 一次跑 N 条素材，自动轮询，失败自动切换备用模型。",
  },
  {
    title: "9:16 白底优化",
    desc: "内置产品图去背 / 居中 / 补白管线，一键适配短视频平台规格。",
  },
];

export const CASES: { name: string; desc: string; stat: string }[] = [
  {
    name: "短视频带货团队",
    desc: "使用 VidClaw 批量生成竖屏素材，单月通过 TikTok + 抖音投流做出 ¥900,000 净利润。",
    stat: "¥900,000 / 月利润",
  },
  {
    name: "马来西亚宠物品牌",
    desc: "独家合作，以一个 SKU 日均 20 条视频的速度在 TikTok Shop 铺量，ROAS 稳定在 2.8+。",
    stat: "20 条 / 日 · SKU",
  },
];

export const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "一条视频大概多少钱？",
    a: "按模型计费，最便宜 Hailuo 约 $0.1 / 条，Sora 2 顶配约 $0.6 / 条。$9.9 起步套餐可产出约 100 条短视频。",
  },
  {
    q: "支持哪些视频模型？",
    a: "Sora 2 / VEO 3.1 / Hailuo / Seedance / Kling / Plato / Yunwu / Dashscope 共 8 个模型，按场景自由切换。",
  },
  {
    q: "生成失败会扣积分吗？",
    a: "不会。任务失败 / 超时会自动退还全部积分，并尝试切换到备用模型重试。",
  },
  {
    q: "积分会过期吗？",
    a: "不会。积分永久有效，不绑定订阅，跨模型通用。",
  },
  {
    q: "可以接入我们自己的系统吗？",
    a: "Business 方案提供 REST API + Webhook，可对接 ERP / PIM / 投流中台，批量下发任务。",
  },
];

export const PRICING_TIERS = [
  {
    name: "Starter",
    price: "$9.9",
    cadence: "一次性",
    desc: "适合个人卖家 / 小团队试水",
    features: [
      "700 积分 (约 100 条)",
      "全部 8 款 AI 模型",
      "9:16 产品图优化",
      "邮件支持",
      "积分永久有效",
    ],
    cta: { text: "立即开始", href: "/register" },
    highlight: false,
  },
  {
    name: "Pro",
    price: "$49",
    cadence: "一次性",
    desc: "最受电商团队欢迎",
    features: [
      "3500 积分 (约 500 条)",
      "全部 8 款 AI 模型",
      "批量并发 / ZIP 打包",
      "优先队列",
      "工单支持",
      "积分永久有效",
    ],
    cta: { text: "升级 Pro", href: "/register?plan=pro" },
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "联系销售",
    cadence: "定制",
    desc: "面向代运营 / 品牌团队 / 企业 API",
    features: [
      "大额积分包 / 按月结算",
      "API 接入 + Webhook",
      "专属对接群 + SLA",
      "定制模型 / 私有部署",
    ],
    cta: { text: "联系销售", href: "mailto:hello@vidclaw.com" },
    highlight: false,
  },
];

export function VidClawMark({
  className,
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={
        "inline-flex items-center justify-center rounded-md bg-brand/15 text-brand " +
        (className ?? "")
      }
      style={{ width: size, height: size }}
    >
      <Sparkles className="size-4" strokeWidth={2.25} />
    </span>
  );
}

export function SampleVideo({
  sample,
  className,
  aspect = "9/16",
  muted = true,
  autoPlay = true,
}: {
  sample: { videoUrl: string | null; thumbnailUrl?: string | null } | null;
  className?: string;
  aspect?: string;
  muted?: boolean;
  autoPlay?: boolean;
}) {
  const cls =
    "w-full bg-muted/40 overflow-hidden rounded-lg " + (className ?? "");
  if (!sample || !sample.videoUrl) {
    return (
      <div className={cls} style={{ aspectRatio: aspect }}>
        <div className="flex size-full items-center justify-center text-muted-foreground text-xs">
          sample coming soon
        </div>
      </div>
    );
  }
  return (
    <div className={cls} style={{ aspectRatio: aspect }}>
      <video
        src={sample.videoUrl}
        poster={sample.thumbnailUrl ?? undefined}
        autoPlay={autoPlay}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        className="size-full object-cover"
      />
    </div>
  );
}

export const FOOTER_COLUMNS: {
  title: string;
  links: { text: string; href: string }[];
}[] = [
  {
    title: "产品",
    links: [
      { text: "功能特性", href: "#features" },
      { text: "定价", href: "#pricing" },
      { text: "样片", href: "#models" },
      { text: "模型对比", href: "#" },
    ],
  },
  {
    title: "资源",
    links: [
      { text: "教程", href: "/blog" },
      { text: "示例作品", href: "/gallery" },
      { text: "提示词模板", href: "#" },
      { text: "案例研究", href: "#cases" },
    ],
  },
  {
    title: "公司",
    links: [
      { text: "关于我们", href: "#" },
      { text: "博客", href: "/blog" },
      { text: "联系", href: "mailto:hello@vidclaw.com" },
      { text: "服务条款", href: "/terms" },
    ],
  },
];

export function BrandedBackground({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-col bg-background text-foreground"
      style={
        {
          "--brand": "#0dccf2",
          "--brand-foreground": "#0dccf2",
          "--primary": "#0dccf2",
          "--radius": "var(--radius-default, 0.75rem)",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
