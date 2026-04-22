import Link from "next/link";
import {
  ArrowRight,
  Zap,
  Shield,
  Clock,
  Globe,
  Check,
  PawPrint,
  Store,
  Sparkles,
} from "lucide-react";
import { HeroDemoAnimation } from "@/components/landing/HeroDemoAnimation";
import { ShowcaseGrid } from "@/components/landing/ShowcaseGrid";
import { CursorGlow } from "@/components/landing/CursorGlow";
import type { VariantProps } from "./shared";

// Popular AI video models — scrolling marquee
const MARQUEE_MODELS = [
  "Sora 2",
  "VEO 3.1",
  "Hailuo 2.3",
  "Seedance 2.0",
  "Kling 2.5",
  "Runway Gen-4",
  "Pika 2.2",
  "Luma Ray 2",
  "Wan 2.5",
  "Grok Imagine",
  "Nano Banana",
  "PixVerse",
  "Mochi 1",
  "CogVideoX",
  "Plato",
  "Yunwu",
  "Dashscope",
];

const TRUST_POINTS = [
  { icon: Shield, text: "失败自动退款" },
  { icon: Clock, text: "平均 3 分钟出片" },
  { icon: Globe, text: "支持 9 种语言" },
];

const PRICING = [
  {
    name: "Starter",
    price: "$9.9",
    unit: "一次性",
    credits: "700 积分",
    hint: "约 100 条视频",
    features: [
      "8 大模型任选",
      "失败自动退款",
      "积分永不过期",
      "标准队列",
    ],
    cta: "立即购买",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$49",
    unit: "一次性",
    credits: "3500 积分",
    hint: "约 500 条视频 · 最划算",
    features: [
      "Starter 全部",
      "优先队列（快 40%）",
      "批量并发（5 路同时）",
      "API 接入 Beta",
    ],
    cta: "立即购买",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "联系销售",
    unit: "",
    credits: "按量结算",
    hint: "独立实例 · 白标",
    features: [
      "Pro 全部",
      "独立结算通道",
      "独立队列 + SLA",
      "白标 / OEM 支持",
    ],
    cta: "联系我们",
    highlight: false,
  },
];

const FAQ = [
  {
    q: "生成失败会退款吗？",
    a: "会，全额退回积分。任何因模型侧问题导致的失败（质量不达标、审核拒绝、超时），系统自动监测并退款，不需要你申请。",
  },
  {
    q: "积分有效期多久？",
    a: "永久有效。买了就是你的，不过期，不清零，不用急着用完。",
  },
  {
    q: "8 个模型怎么选？",
    a: "每个模型都在生成界面有效果预览和单条价格。通用场景推荐 Seedance 2.0（性价比），高端质感选 Sora 2 或 VEO 3.1，快速出量选 Hailuo 2.3。",
  },
  {
    q: "有企业方案吗？",
    a: "有。年付 75 折、独立结算、API 接入、独立队列优先级、白标支持。联系 sales@video.yeadon.top。",
  },
  {
    q: "支持哪些付款方式？",
    a: "Stripe 信用卡（Visa / MasterCard / American Express）、Apple Pay、Google Pay。中国大陆用户也可用支付宝。",
  },
];

export default function V4Saturn(_: VariantProps) {
  return (
    <div
      className="relative min-h-screen text-white"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(13,204,242,0.10), transparent), #0a1214",
      }}
    >
      {/* Mouse-follow glow */}
      <CursorGlow />

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a1214]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
          <Link href="/design/4" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0dccf2]">
              <Sparkles className="h-4 w-4 text-[#0a1214]" />
            </div>
            <span className="text-lg font-bold tracking-tight">VidClaw</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-400 md:flex">
            <a href="#models" className="transition-colors hover:text-white">
              模型
            </a>
            <a href="#showcase" className="transition-colors hover:text-white">
              案例
            </a>
            <a href="#pricing" className="transition-colors hover:text-white">
              定价
            </a>
            <Link href="/gallery" className="transition-colors hover:text-white">
              灵感广场
            </Link>
            <Link href="/blog" className="transition-colors hover:text-white">
              Blog
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm text-slate-400 transition-colors hover:text-white sm:block"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="flex items-center gap-2 rounded-lg bg-[#0dccf2] px-5 py-2 text-sm font-medium text-[#0a1214] transition-all hover:brightness-110"
            >
              免费开始
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden px-6 pb-6 pt-6 lg:pt-8">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-[#0dccf2]/8 blur-[120px]" />
            <div className="absolute -right-40 top-20 h-[400px] w-[400px] rounded-full bg-cyan-500/5 blur-[100px]" />
          </div>

          <div className="relative mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0dccf2]/20 bg-[#0dccf2]/5 px-4 py-1.5 text-xs font-medium text-[#0dccf2]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0dccf2] opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#0dccf2]" />
                </span>
                8 大 AI 模型 · Sora 2 / VEO 3.1 / Seedance / Hailuo
              </div>

              <h1 className="mt-5 text-4xl font-extrabold leading-[1.15] tracking-tight lg:text-5xl xl:text-6xl">
                AI 电商
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, #0dccf2, #60a5fa)",
                  }}
                >
                  视频生产工具
                </span>
              </h1>

              <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-400">
                从视频生成、竞品拆解、商品组图到视频换人 — 一站式覆盖电商内容创作全链路。3 分钟出片，支持抖音、TikTok、小红书等平台。
              </p>

              <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0dccf2] px-8 py-3.5 text-sm font-semibold text-[#0a1214] shadow-lg shadow-[#0dccf2]/20 transition-all hover:brightness-110"
                >
                  <Zap className="h-4 w-4" />
                  进入工作台
                </Link>
                <Link
                  href="/gallery"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-6 py-3 text-sm text-slate-300 transition-all hover:bg-white/5"
                >
                  浏览灵感广场
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="mt-4 flex items-center gap-4">
                {TRUST_POINTS.map((tp) => (
                  <span
                    key={tp.text}
                    className="flex items-center gap-1.5 text-xs text-slate-500"
                  >
                    <tp.icon className="h-3 w-3" />
                    {tp.text}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: existing hero animation */}
            <HeroDemoAnimation />
          </div>
        </section>

        {/* ── Model marquee ── */}
        <section
          id="models"
          className="relative overflow-hidden border-y border-white/5 bg-[#0a1214] py-6"
        >
          <div className="mx-auto max-w-[1200px] px-6">
            <p className="text-center text-sm font-medium text-slate-400">
              聚合全球主流视频生成模型 · 一个账号全部调用
            </p>
          </div>
          <div className="relative mt-8 flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
            <div className="flex shrink-0 animate-[marquee_40s_linear_infinite] items-center gap-12 pr-12">
              {MARQUEE_MODELS.concat(MARQUEE_MODELS).map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  className="whitespace-nowrap text-xl font-semibold text-slate-400 hover:text-white"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
          <style>{`
            @keyframes marquee {
              from { transform: translateX(0); }
              to { transform: translateX(-50%); }
            }
          `}</style>
        </section>

        {/* ── Showcase: AI 生成的产品广告 ── */}
        <section id="showcase" className="px-6 py-24">
          <div className="mx-auto max-w-[1200px]">
            <div className="text-center">
              <h2 className="text-3xl font-bold lg:text-4xl">AI 生成的产品广告</h2>
              <p className="mt-3 text-base text-slate-400">
                不同品类、不同风格、不同平台
              </p>
            </div>
            <div className="mt-12">
              <ShowcaseGrid />
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section
          id="pricing"
          className="border-t border-white/5 bg-[#0d181b] px-6 py-24"
        >
          <div className="mx-auto max-w-[1200px]">
            <div className="text-center">
              <h2 className="text-3xl font-bold lg:text-4xl">按量付费，不绑订阅</h2>
              <p className="mt-3 text-base text-slate-400">
                积分永不过期 · 失败自动退款 · 随时停用
              </p>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              {PRICING.map((p) => (
                <div
                  key={p.name}
                  className={`relative rounded-2xl border p-8 transition-all ${
                    p.highlight
                      ? "border-[#0dccf2]/40 bg-[#0dccf2]/[0.04] shadow-lg shadow-[#0dccf2]/10"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  {p.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#0dccf2] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0a1214]">
                      最受欢迎
                    </div>
                  )}
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-4xl font-bold">{p.price}</span>
                    {p.unit && <span className="text-sm text-slate-500">{p.unit}</span>}
                  </div>
                  <p className="mt-1 text-sm text-[#0dccf2]">{p.credits}</p>
                  <p className="mt-1 text-xs text-slate-500">{p.hint}</p>
                  <ul className="mt-6 space-y-2.5">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#0dccf2]" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={p.name === "Enterprise" ? "/contact" : "/pricing"}
                    className={`mt-8 flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all ${
                      p.highlight
                        ? "bg-[#0dccf2] text-[#0a1214] shadow-md shadow-[#0dccf2]/20 hover:brightness-110"
                        : "border border-white/10 text-white hover:bg-white/5"
                    }`}
                  >
                    {p.cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Cases ── */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-[1200px]">
            <div className="text-center">
              <h2 className="text-3xl font-bold lg:text-4xl">真实客户的真实数据</h2>
              <p className="mt-3 text-base text-slate-400">不是 demo，不是 vanity metrics</p>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8">
                <Store className="h-8 w-8 text-[#0dccf2]" strokeWidth={1.25} />
                <h3 className="mt-4 text-xl font-semibold">短视频带货团队</h3>
                <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">
                  跨境电商团队 · 月利润 ¥900,000
                </p>
                <p className="mt-4 text-sm leading-relaxed text-slate-300">
                  月 90 万带货利润。把 VidClaw 当批量素材中台，一天生成 200+ 条视频供投手挑选，素材测试成本降 80%。
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8">
                <PawPrint className="h-8 w-8 text-[#0dccf2]" strokeWidth={1.25} />
                <h3 className="mt-4 text-xl font-semibold">马来西亚宠物品牌</h3>
                <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">
                  DTC 品牌 · 独家合作
                </p>
                <p className="mt-4 text-sm leading-relaxed text-slate-300">
                  独家合作方。所有 TikTok / Lazada 投放素材全量交给 VidClaw 生产，单月跑 500+ 条 SKU，爆品率提升 3 倍。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="border-t border-white/5 px-6 py-24">
          <div className="mx-auto max-w-[840px]">
            <div className="text-center">
              <h2 className="text-3xl font-bold lg:text-4xl">付费前想清楚这几件事</h2>
            </div>
            <div className="mt-12 space-y-3">
              {FAQ.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl border border-white/10 bg-white/[0.02] p-5 open:border-[#0dccf2]/30"
                >
                  <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-white">
                    {item.q}
                    <ArrowRight className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-4 text-sm leading-relaxed text-slate-400">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="relative overflow-hidden px-6 py-24">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0dccf2]/6 blur-[120px]" />
          </div>
          <div className="relative mx-auto flex max-w-[800px] flex-col items-center gap-8 text-center">
            <h2 className="text-3xl font-bold leading-tight lg:text-4xl">
              今天开始，
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, #0dccf2, #60a5fa)" }}
              >
                明天就有内容
              </span>
            </h2>
            <p className="text-base text-slate-400">
              无需拍摄团队，无需剪辑经验，AI 帮你搞定一切
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0dccf2] px-10 py-4 text-base font-semibold text-[#0a1214] shadow-lg shadow-[#0dccf2]/20 transition-all hover:brightness-110"
            >
              <Zap className="h-5 w-5" />
              免费生成第一条视频
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#0a1214] px-6 py-12">
        <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-[#0dccf2]/20">
                <Sparkles className="h-3 w-3 text-[#0dccf2]" />
              </div>
              <span className="text-sm font-semibold">VidClaw</span>
            </div>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-slate-500">
              AI 电商视频生产工具 · 8 大顶级模型 · 3 分钟出片
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">产品</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/generate" className="text-slate-400 hover:text-white">开始创作</Link></li>
              <li><Link href="/analyze" className="text-slate-400 hover:text-white">视频拆解</Link></li>
              <li><Link href="/pricing" className="text-slate-400 hover:text-white">定价</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">资源</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/gallery" className="text-slate-400 hover:text-white">灵感广场</Link></li>
              <li><Link href="/blog" className="text-slate-400 hover:text-white">Blog</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">法务</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/terms" className="text-slate-400 hover:text-white">服务条款</Link></li>
              <li><Link href="/privacy" className="text-slate-400 hover:text-white">隐私政策</Link></li>
              <li><Link href="/refund" className="text-slate-400 hover:text-white">退款政策</Link></li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-[1200px] border-t border-white/5 pt-6 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} VidClaw · AI 电商视频生产工具
        </div>
      </footer>
    </div>
  );
}
