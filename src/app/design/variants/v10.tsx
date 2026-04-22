import Link from "next/link";
import { ArrowRight } from "lucide-react";

import FAQ from "@/components/launch-ui/sections/faq/static";
import { Button } from "@/components/launch-ui/ui/button";

import {
  BRAND,
  BrandedBackground,
  FAQ_ITEMS,
  SampleVideo,
  VidClawMark,
  type VariantProps,
} from "./shared";

export default function V10SplitFeed({ samples }: VariantProps) {
  const feed =
    samples.modelSamples.length > 0
      ? [samples.hero, ...samples.modelSamples]
          .filter(Boolean)
          .slice(0, 8)
      : Array.from({ length: 6 }).map(() => null);

  return (
    <BrandedBackground>
      {/* Minimal top bar */}
      <header className="border-b border-border/60 bg-background/80 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link
            href="/design/10"
            className="flex items-center gap-2 text-lg font-bold"
          >
            <VidClawMark />
            {BRAND.name}
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-muted-foreground text-sm">
              登录
            </Link>
            <Button size="sm" asChild>
              <a href={BRAND.primaryCta.href}>免费开始</a>
            </Button>
          </div>
        </div>
      </header>

      {/* SPLIT HERO */}
      <section className="relative">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 py-12 lg:grid-cols-2">
          {/* LEFT sticky */}
          <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:self-start">
            <div className="flex h-full flex-col justify-center">
              <div className="text-brand text-xs uppercase tracking-[0.3em]">
                VidClaw
              </div>
              <h1 className="mt-3 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
                {BRAND.tagline}
              </h1>
              <p className="text-muted-foreground mt-6 max-w-lg text-lg">
                {BRAND.sub}
              </p>
              <ul className="text-muted-foreground mt-6 space-y-2 text-sm">
                {BRAND.values.map((v) => (
                  <li key={v} className="flex items-center gap-2">
                    <span className="text-brand">●</span>
                    {v}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex gap-3">
                <Button size="lg" asChild>
                  <a href={BRAND.primaryCta.href}>
                    {BRAND.primaryCta.text}
                    <ArrowRight className="ml-1 size-4" />
                  </a>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <a href="#feed">{BRAND.secondaryCta.text}</a>
                </Button>
              </div>
              <p className="text-muted-foreground mt-4 text-xs">
                {BRAND.pricingHint}
              </p>
            </div>
          </div>

          {/* RIGHT scrolling feed */}
          <div id="feed" className="space-y-4">
            {feed.map((s, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                <SampleVideo
                  sample={s as { videoUrl: string | null; thumbnailUrl?: string | null } | null}
                  aspect="9/16"
                  className="rounded-none"
                />
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">
                      {(s && "name" in (s as object) ? (s as { name: string }).name : "VidClaw 生成")}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      9:16 · 自动生成
                    </div>
                  </div>
                  <a
                    href={BRAND.primaryCta.href}
                    className="text-brand text-xs font-medium"
                  >
                    用这个模型 →
                  </a>
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <p className="text-muted-foreground text-sm">看完了 · 现在轮到你的产品</p>
              <Button className="mt-4" asChild>
                <a href={BRAND.primaryCta.href}>{BRAND.primaryCta.text}</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <FAQ
        title="常见问题"
        items={FAQ_ITEMS.map((i) => ({
          question: i.q,
          answer: (
            <p className="text-muted-foreground mb-4 max-w-[640px] text-balance">
              {i.a}
            </p>
          ),
        }))}
      />

      <section className="border-t border-border bg-gradient-to-br from-brand/10 via-background to-background py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-4xl font-semibold sm:text-5xl">
            一张产品图 · 三分钟 · 一条爆款视频
          </h2>
          <Button size="lg" className="mt-8" asChild>
            <a href={BRAND.primaryCta.href}>
              {BRAND.primaryCta.text}
              <ArrowRight className="ml-1 size-4" />
            </a>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-muted-foreground text-xs">
        © 2026 VidClaw.
      </footer>
    </BrandedBackground>
  );
}
