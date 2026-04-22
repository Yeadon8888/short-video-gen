import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/launch-ui/ui/button";

import {
  BRAND,
  BrandedBackground,
  VidClawMark,
  type VariantProps,
} from "./shared";

// Deterministic height distribution so masonry feels varied but predictable
const HEIGHTS = [
  "aspect-[9/16]",
  "aspect-[9/16]",
  "aspect-[3/4]",
  "aspect-[9/16]",
  "aspect-[4/5]",
  "aspect-[9/16]",
  "aspect-[3/4]",
  "aspect-[9/16]",
  "aspect-[9/16]",
  "aspect-[4/5]",
  "aspect-[9/16]",
  "aspect-[3/4]",
];

export default function V7Showcase({ samples }: VariantProps) {
  const pool =
    samples.modelSamples.length > 0
      ? samples.modelSamples
      : (Array.from({ length: 12 }).map(() => null) as Array<null>);
  const cards = Array.from({ length: 12 }).map(
    (_, i) => pool[i % pool.length] ?? null,
  );

  return (
    <BrandedBackground>
      {/* Minimal navbar */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/design/7" className="flex items-center gap-2 text-lg font-bold">
            <VidClawMark />
            {BRAND.name}
          </Link>
          <Button size="sm" asChild>
            <a href={BRAND.primaryCta.href}>
              {BRAND.primaryCta.text}
              <ArrowRight className="ml-1 size-3.5" />
            </a>
          </Button>
        </div>
      </header>

      {/* Single headline strip */}
      <section className="border-b border-border/50">
        <div className="mx-auto max-w-7xl px-6 py-16 text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
            {BRAND.tagline}
          </h1>
          <p className="text-muted-foreground mt-4 text-sm">
            下方全部由 VidClaw 生成 · 点任意一个卡片立即开始
          </p>
        </div>
      </section>

      {/* Masonry grid */}
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="columns-2 gap-4 md:columns-3 lg:columns-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
          {cards.map((m, i) => (
            <a
              key={i}
              href={BRAND.primaryCta.href}
              className={
                "group relative block w-full overflow-hidden rounded-xl bg-muted/30 " +
                HEIGHTS[i % HEIGHTS.length]
              }
            >
              {m?.videoUrl ? (
                <video
                  src={m.videoUrl}
                  poster={m.thumbnailUrl ?? undefined}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="size-full object-cover transition group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground text-xs">
                  sample
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition group-hover:opacity-100">
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <div className="text-xs font-medium text-white">
                    {m?.name ?? "VidClaw 生成"}
                  </div>
                  <div className="text-white/70 text-xs">点击使用 →</div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Single CTA banner */}
      <section className="border-t border-border/50">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 py-16 text-center">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            你的产品 · 也能做成这样
          </h2>
          <p className="text-muted-foreground">
            {BRAND.pricingHint} · 3 分钟出片，失败自动退款。
          </p>
          <Button size="lg" asChild>
            <a href={BRAND.primaryCta.href}>
              {BRAND.primaryCta.text}
              <ArrowRight className="ml-1 size-4" />
            </a>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-6 text-center text-muted-foreground text-xs">
        © 2026 VidClaw
      </footer>
    </BrandedBackground>
  );
}
