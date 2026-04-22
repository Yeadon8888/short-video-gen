import { Layers, Zap, Coins, Clock } from "lucide-react";

import Hero from "@/components/launch-ui/sections/hero/barebone";
import Tabs from "@/components/launch-ui/sections/tabs/top";
import Navbar from "@/components/launch-ui/sections/navbar/barebone";
import Footer from "@/components/launch-ui/sections/footer/barebone";
import { Section } from "@/components/launch-ui/ui/section";
import { Badge } from "@/components/launch-ui/ui/badge";

import {
  BRAND,
  BrandedBackground,
  SampleVideo,
  VidClawMark,
  type VariantProps,
} from "./shared";

export default function V5Jupiter({ samples }: VariantProps) {
  const sampleTab = (idx: number) => (
    <div className="mx-auto max-w-3xl">
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((k) => (
          <SampleVideo
            key={k}
            sample={samples.modelSamples[(idx + k) % Math.max(1, samples.modelSamples.length)] ?? null}
            aspect="9/16"
          />
        ))}
      </div>
    </div>
  );

  return (
    <BrandedBackground>
      <Navbar />

      <Hero
        title={BRAND.tagline}
        description={BRAND.sub}
        buttons={[
          {
            text: BRAND.primaryCta.text,
            href: BRAND.primaryCta.href,
            variant: "default",
          },
          {
            text: BRAND.secondaryCta.text,
            href: BRAND.secondaryCta.href,
            variant: "outline",
          },
        ]}
      />

      <div className="-mt-8 text-center">
        <Badge variant="outline">{BRAND.pricingHint}</Badge>
      </div>

      <Tabs
        title="一套工作流，覆盖短视频全部场景"
        description="选择你最常用的场景，看看 VidClaw 是怎么输出成片的。"
        defaultTab="ecommerce"
        tabs={[
          {
            value: "ecommerce",
            title: "电商带货",
            description: "产品主图 → 竖版成片，一键铺量。",
            icon: <Layers className="size-5" />,
            content: sampleTab(0),
          },
          {
            value: "ugc",
            title: "UGC 仿拍",
            description: "爆款抖音 / TikTok 二创，模型自由切换。",
            icon: <Zap className="size-5" />,
            content: sampleTab(1),
          },
          {
            value: "batch",
            title: "批量素材",
            description: "一个 SKU 一次跑 N 条，失败自动退款。",
            icon: <Coins className="size-5" />,
            content: sampleTab(2),
          },
          {
            value: "fast",
            title: "3 分钟出片",
            description: "端到端平均 3 分钟，不用等排队。",
            icon: <Clock className="size-5" />,
            content: sampleTab(3),
          },
        ]}
      />

      <Section id="models">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-semibold sm:text-5xl">模型画廊</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl">
            8 个视频模型，点开自己选。每个模型都有对应的样片。
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            {(samples.modelSamples.length
              ? samples.modelSamples.slice(0, 8)
              : Array.from({ length: 8 }).map(() => null)
            ).map((m, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <SampleVideo
                  sample={m}
                  aspect="9/16"
                  className="rounded-none"
                />
                <div className="p-3">
                  <div className="text-sm font-medium">
                    {m?.name ?? `模型 ${i + 1}`}
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    点击使用 →
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <VidClawMark size={48} />
          <h2 className="mt-6 text-3xl font-semibold sm:text-4xl">
            从一张产品图到爆款视频，只需三分钟
          </h2>
          <a
            href={BRAND.primaryCta.href}
            className="mt-8 inline-flex items-center rounded-md bg-brand px-6 py-3 text-sm font-medium text-background"
          >
            {BRAND.primaryCta.text}
          </a>
          <p className="text-muted-foreground mt-3 text-xs">
            {BRAND.pricingHint}
          </p>
        </div>
      </Section>

      <Footer />
    </BrandedBackground>
  );
}
