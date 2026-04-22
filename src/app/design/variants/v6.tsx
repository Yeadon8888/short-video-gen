import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/launch-ui/ui/button";
import { Section } from "@/components/launch-ui/ui/section";

import {
  BRAND,
  BrandedBackground,
  SampleVideo,
  VidClawMark,
  type VariantProps,
} from "./shared";

export default function V6CinematicHero({ samples }: VariantProps) {
  const heroVideo = samples.hero;
  return (
    <BrandedBackground>
      {/* FULL-BLEED HERO */}
      <section className="relative h-screen min-h-[720px] w-full overflow-hidden bg-black">
        {/* background video */}
        {heroVideo?.videoUrl ? (
          <video
            src={heroVideo.videoUrl}
            poster={heroVideo.thumbnailUrl ?? undefined}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 size-full object-cover opacity-80"
          />
        ) : (
          <div className="absolute inset-0 size-full bg-gradient-to-br from-brand/40 via-background to-black" />
        )}

        {/* gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />

        {/* transparent navbar */}
        <header className="absolute left-0 right-0 top-0 z-20 p-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <Link href="/design/6" className="flex items-center gap-2 text-lg font-bold text-white">
              <VidClawMark />
              {BRAND.name}
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-sm text-white/80 hover:text-white">
                登录
              </Link>
              <Button asChild>
                <a href={BRAND.primaryCta.href}>免费开始</a>
              </Button>
            </div>
          </div>
        </header>

        {/* bottom-left text block */}
        <div className="absolute bottom-0 left-0 z-10 w-full p-8 md:p-16">
          <div className="max-w-2xl">
            <div className="text-brand mb-4 text-xs uppercase tracking-[0.3em]">
              VidClaw · AI Video for Commerce
            </div>
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl">
              {BRAND.tagline}
            </h1>
            <p className="mt-6 max-w-xl text-base text-white/80 md:text-lg">
              {BRAND.sub}
            </p>
            <div className="mt-8 flex gap-3">
              <Button size="lg" asChild>
                <a href={BRAND.primaryCta.href}>
                  {BRAND.primaryCta.text}
                  <ArrowRight className="ml-1 size-4" />
                </a>
              </Button>
              <Button variant="glow" size="lg" asChild>
                <a href={BRAND.secondaryCta.href}>{BRAND.secondaryCta.text}</a>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/60">
              {BRAND.values.map((v) => (
                <span key={v}>· {v}</span>
              ))}
            </div>
          </div>
        </div>

        {/* scroll hint */}
        <div className="absolute bottom-6 right-8 hidden text-white/40 text-xs md:block">
          ↓ 向下滚动看更多模型
        </div>
      </section>

      {/* MODELS 4-col grid */}
      <Section id="models" className="bg-background">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between">
            <h2 className="text-3xl font-semibold sm:text-5xl">8 个模型 · 任你切换</h2>
            <a href={BRAND.primaryCta.href} className="text-brand text-sm">
              立即使用 →
            </a>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            {(samples.modelSamples.length
              ? samples.modelSamples.slice(0, 8)
              : Array.from({ length: 8 }).map(() => null)
            ).map((m, i) => (
              <div key={i} className="group relative overflow-hidden rounded-lg bg-muted/30">
                <SampleVideo sample={m} aspect="9/16" className="rounded-none" />
                {m && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <div className="text-sm font-medium text-white">{m.name}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* CTA band */}
      <section className="relative overflow-hidden bg-gradient-to-r from-brand/10 via-background to-brand/10 py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-4xl font-semibold sm:text-5xl">
            一张产品图，一部成片
          </h2>
          <p className="text-muted-foreground mt-4">
            {BRAND.pricingHint} · 注册即送试用积分
          </p>
          <Button size="lg" className="mt-8" asChild>
            <a href={BRAND.primaryCta.href}>
              {BRAND.primaryCta.text}
              <ArrowRight className="ml-1 size-4" />
            </a>
          </Button>
        </div>
      </section>

      {/* Minimal footer */}
      <footer className="border-t border-border bg-background px-6 py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-muted-foreground text-sm">
          <div className="flex items-center gap-2">
            <VidClawMark size={20} />
            <span>© 2026 VidClaw</span>
          </div>
          <div className="flex gap-6">
            <Link href="/privacy">隐私</Link>
            <Link href="/terms">条款</Link>
            <Link href="/blog">博客</Link>
          </div>
        </div>
      </footer>
    </BrandedBackground>
  );
}
