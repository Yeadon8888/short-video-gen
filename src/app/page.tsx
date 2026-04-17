import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  ArrowRight,
  Zap,
  Film,
  Clapperboard,
  ScanSearch,
  Images,
  UserCircle,
  Sparkles,
  Globe,
  Shield,
  Clock,
} from "lucide-react";
import { AnimatedCounter } from "@/components/landing/AnimatedCounter";
import { ShowcaseGrid } from "@/components/landing/ShowcaseGrid";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { HeroDemoAnimation } from "@/components/landing/HeroDemoAnimation";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "VidClaw V2",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  description:
    "AI-powered product video generator for e-commerce. Generate videos, analyze competitors, create product images, and swap faces — all in one platform.",
  url: "https://video.yeadon.top",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free tier available",
  },
};

const FEATURES = [
  {
    icon: Clapperboard,
    title: "AI 视频生成",
    desc: "8 大 AI 模型一键生成带货短视频，支持 Sora-2、VEO 3.1、Seedance 2.0、Hailuo 2.3 等",
    href: "/generate",
    badge: "核心功能",
  },
  {
    icon: ScanSearch,
    title: "视频拆解",
    desc: "粘贴抖音/TikTok 链接，AI 自动提取钩子话术、分镜脚本和配套文案",
    href: "/analyze",
    badge: null,
  },
  {
    icon: Images,
    title: "商品组图",
    desc: "一张产品图生成 6 种风格场景图 — 生活场景、模特展示、细节特写、平铺摆拍",
    href: "/scene",
    badge: null,
  },
  {
    icon: UserCircle,
    title: "视频换人",
    desc: "上传人脸照片 + 视频，AI 自动替换视频中的模特面孔，适配全球市场",
    href: "/face-swap",
    badge: null,
  },
  {
    icon: Sparkles,
    title: "灵感广场",
    desc: "浏览社区优秀作品，获取创意灵感，一键复用 Prompt 快速出片",
    href: "/gallery",
    badge: null,
  },
  {
    icon: Globe,
    title: "批量带货",
    desc: "同一份创意主题，批量为多张产品图出片，失败自动补齐，定时凌晨执行",
    href: "/generate",
    badge: null,
  },
];

const TRUST_POINTS = [
  { icon: Shield, text: "失败自动退款" },
  { icon: Clock, text: "平均 3 分钟出片" },
  { icon: Globe, text: "支持 9 种语言" },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const ctaHref = user ? "/generate" : "/register";
  const ctaLabel = user ? "进入工作台" : "免费开始创作";

  return (
    <div className="min-h-screen bg-[var(--vc-bg-root)] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[var(--vc-bg-root)]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--vc-accent)]">
              <Film className="h-4 w-4 text-[var(--vc-bg-root)]" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              VidClaw
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-slate-400 md:flex">
            <a href="#features" className="transition-colors hover:text-white">功能</a>
            <a href="#showcase" className="transition-colors hover:text-white">案例</a>
            <Link href="/gallery" className="transition-colors hover:text-white">灵感广场</Link>
            <Link href="/blog" className="transition-colors hover:text-white">Blog</Link>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                href="/generate"
                className="flex items-center gap-2 rounded-lg bg-[var(--vc-accent)] px-5 py-2 text-sm font-medium text-[var(--vc-bg-root)] transition-all hover:brightness-110"
              >
                工作台 <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden text-sm text-slate-400 transition-colors hover:text-white sm:block">
                  登录
                </Link>
                <Link
                  href="/register"
                  className="flex items-center gap-2 rounded-lg bg-[var(--vc-accent)] px-5 py-2 text-sm font-medium text-[var(--vc-bg-root)] transition-all hover:brightness-110"
                >
                  免费开始
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden px-6 pb-24 pt-20 lg:pt-32">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-[var(--vc-accent)]/8 blur-[120px]" />
            <div className="absolute -right-40 top-20 h-[400px] w-[400px] rounded-full bg-cyan-500/5 blur-[100px]" />
          </div>

          <div className="relative mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-16 lg:grid-cols-2">
            <div>
              <ScrollReveal>
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--vc-accent)]/20 bg-[var(--vc-accent)]/5 px-4 py-1.5 text-xs font-medium text-[var(--vc-accent)]">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--vc-accent)] opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--vc-accent)]" />
                  </span>
                  8 大 AI 模型 · Sora-2 / VEO 3.1 / Seedance / Hailuo
                </div>
              </ScrollReveal>

              <ScrollReveal delay={0.08}>
                <h1 className="mt-8 text-4xl font-extrabold leading-[1.15] tracking-tight lg:text-6xl">
                  AI 电商
                  <br />
                  <span className="vc-gradient-text">视频生产工具</span>
                </h1>
              </ScrollReveal>

              <ScrollReveal delay={0.16}>
                <p className="mt-6 max-w-lg text-base leading-relaxed text-slate-400">
                  从视频生成、竞品拆解、商品组图到视频换人 — 一站式覆盖电商内容创作全链路。3 分钟出片，支持抖音、TikTok、小红书等平台。
                </p>
              </ScrollReveal>

              <ScrollReveal delay={0.24}>
                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Link
                    href={ctaHref}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--vc-accent)] px-8 py-3.5 text-sm font-semibold text-[var(--vc-bg-root)] shadow-lg shadow-[var(--vc-accent)]/20 transition-all hover:brightness-110"
                  >
                    <Zap className="h-4 w-4" />
                    {ctaLabel}
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
                    <span key={tp.text} className="flex items-center gap-1.5 text-xs text-slate-500">
                      <tp.icon className="h-3 w-3" />
                      {tp.text}
                    </span>
                  ))}
                </div>
              </ScrollReveal>
            </div>

            <ScrollReveal delay={0.3}>
              <HeroDemoAnimation />
            </ScrollReveal>
          </div>
        </section>

        {/* ── Stats ── */}
        <section className="border-y border-white/5 px-6 py-12">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-8">
            {[
              { label: "视频已生成", value: 120000, suffix: "+" },
              { label: "AI 模型", value: 8, suffix: "个", isRaw: true },
              { label: "平均出片", value: 2.8, suffix: "min", isRaw: true },
              { label: "支持语言", value: 9, suffix: "种", isRaw: true },
            ].map((item) => (
              <div key={item.label} className="flex flex-col gap-1 text-center">
                <span className="text-xs uppercase tracking-wider text-slate-500">{item.label}</span>
                {item.isRaw ? (
                  <span className="text-3xl font-bold tabular-nums text-white">{item.value}<span className="text-lg text-slate-400">{item.suffix}</span></span>
                ) : (
                  <AnimatedCounter target={item.value} suffix={item.suffix} />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="px-6 py-24">
          <div className="mx-auto max-w-[1200px]">
            <ScrollReveal>
              <div className="text-center">
                <h2 className="text-3xl font-bold">一站式电商内容生产</h2>
                <p className="mt-3 text-base text-slate-400">
                  六大 AI 工具，覆盖从创意到发布的完整链路
                </p>
              </div>
            </ScrollReveal>

            <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feat, i) => (
                <ScrollReveal key={feat.title} delay={i * 0.06}>
                  <Link
                    href={feat.href}
                    className="group flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-6 transition-all hover:border-[var(--vc-accent)]/20 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--vc-accent)]/10">
                        <feat.icon className="h-5 w-5 text-[var(--vc-accent)]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-white">{feat.title}</h3>
                          {feat.badge && (
                            <span className="rounded bg-[var(--vc-accent)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--vc-accent)]">
                              {feat.badge}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-400 group-hover:text-slate-300">
                      {feat.desc}
                    </p>
                  </Link>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Showcase ── */}
        <section id="showcase" className="border-t border-white/5 px-6 py-24">
          <div className="mx-auto max-w-[1200px]">
            <ScrollReveal>
              <div className="text-center">
                <h2 className="text-3xl font-bold">AI 生成的产品广告</h2>
                <p className="mt-3 text-base text-slate-400">
                  不同品类、不同风格、不同平台
                </p>
              </div>
            </ScrollReveal>
            <div className="mt-12">
              <ShowcaseGrid />
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="relative overflow-hidden px-6 py-24">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--vc-accent)]/6 blur-[120px]" />
          </div>
          <div className="relative mx-auto flex max-w-[800px] flex-col items-center gap-8 text-center">
            <ScrollReveal>
              <h2 className="text-3xl font-bold leading-tight lg:text-4xl">
                今天开始，<span className="vc-gradient-text">明天就有内容</span>
              </h2>
              <p className="mt-3 text-base text-slate-400">
                无需拍摄团队、无需剪辑经验，AI 帮你搞定一切
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <Link
                href={ctaHref}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--vc-accent)] px-10 py-4 text-base font-semibold text-[var(--vc-bg-root)] shadow-lg shadow-[var(--vc-accent)]/20 transition-all hover:brightness-110"
              >
                <Zap className="h-5 w-5" />
                {ctaLabel}
              </Link>
            </ScrollReveal>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 px-6 py-8">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-slate-500">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--vc-accent)]/20">
              <Film className="h-3 w-3 text-[var(--vc-accent)]" />
            </div>
            <span className="text-sm font-medium">VidClaw</span>
          </div>
          <p className="text-xs text-slate-600">
            &copy; {new Date().getFullYear()} VidClaw &middot; AI 电商视频生产工具
          </p>
        </div>
      </footer>
    </div>
  );
}
