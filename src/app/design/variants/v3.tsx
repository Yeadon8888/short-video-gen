import { Zap, Coins, Film, Layers } from "lucide-react";

import Hero from "@/components/launch-ui/sections/hero/top-glow";
import BentoGrid from "@/components/launch-ui/sections/bento-grid/2-rows-top";
import FAQ from "@/components/launch-ui/sections/faq/2-cols";
import CTA from "@/components/launch-ui/sections/cta/barebone";
import Navbar from "@/components/launch-ui/sections/navbar/static";
import Footer from "@/components/launch-ui/sections/footer/default";
import { Mockup } from "@/components/launch-ui/ui/mockup";

import {
  BRAND,
  BrandedBackground,
  FAQ_ITEMS,
  SampleVideo,
  VidClawMark,
  type VariantProps,
} from "./shared";

export default function V3Pluto({ samples }: VariantProps) {
  return (
    <BrandedBackground>
      <Navbar
        logo={<VidClawMark />}
        name={BRAND.name}
        homeUrl="/design/3"
        actions={[
          { text: "登录", href: "/login" },
          {
            text: "免费开始",
            href: BRAND.primaryCta.href,
            isButton: true,
            variant: "default",
          },
        ]}
      />

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
            variant: "glow",
          },
        ]}
        mockup={
          <Mockup className="bg-background/90 w-full rounded-xl border-0 p-2">
            <div className="mx-auto w-full max-w-4xl">
              <SampleVideo sample={samples.hero} aspect="16/9" />
            </div>
          </Mockup>
        }
      />

      <BentoGrid
        title="核心能力"
        description="简单、快、不坑人：三条就是我们做视频生成的全部信仰。"
        tiles={[
          {
            title: "8 模型聚合",
            description: (
              <p className="max-w-[420px]">
                Sora 2 / VEO 3.1 / Hailuo / Seedance ... 一个账号调度 8 个模型，按场景自由切换。
              </p>
            ),
            visual: (
              <div className="flex min-h-[220px] grow items-center justify-center p-6">
                <Layers className="text-brand size-24 stroke-1" />
              </div>
            ),
            size: "col-span-12 md:col-span-6",
          },
          {
            title: "失败自动退款",
            description: (
              <p className="max-w-[420px]">
                任务失败或超时自动退还全部积分；系统尝试切换备用模型重试，除非你主动取消。
              </p>
            ),
            visual: (
              <div className="flex min-h-[220px] grow items-center justify-center p-6">
                <Coins className="text-brand size-24 stroke-1" />
              </div>
            ),
            size: "col-span-12 md:col-span-6",
          },
          {
            title: "批量并发",
            description: (
              <p className="max-w-[420px]">
                一个 SKU 一次跑 N 条素材，投递按速率平滑排队。
              </p>
            ),
            visual: (
              <div className="flex min-h-[200px] grow items-center justify-center p-6">
                <Zap className="text-brand size-20 stroke-1" />
              </div>
            ),
            size: "col-span-12 md:col-span-6 lg:col-span-4",
          },
          {
            title: "9:16 成片",
            description: (
              <p className="max-w-[420px]">
                内置产品图预处理，直接输出适配短视频平台的竖屏成片。
              </p>
            ),
            visual: (
              <div className="flex min-h-[200px] grow items-center justify-center p-6">
                <Film className="text-brand size-20 stroke-1" />
              </div>
            ),
            size: "col-span-12 md:col-span-6 lg:col-span-4",
          },
          {
            title: "3 分钟出片",
            description: (
              <p className="max-w-[420px]">
                上传到下载，端到端平均 3 分钟。
              </p>
            ),
            visual: (
              <div className="flex min-h-[200px] grow items-center justify-center p-6">
                <span className="text-brand text-6xl font-bold">3′</span>
              </div>
            ),
            size: "col-span-12 md:col-span-12 lg:col-span-4",
          },
        ]}
      />

      <section id="models" className="bg-background">
        <div className="mx-auto max-w-6xl px-4 py-24">
          <h2 className="text-3xl font-semibold sm:text-5xl">样片</h2>
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SampleVideo
                key={i}
                sample={samples.modelSamples[i] ?? null}
                aspect="9/16"
              />
            ))}
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

      <CTA
        title="准备好为你的产品量产短视频了吗？"
        buttons={[
          {
            text: BRAND.primaryCta.text,
            href: BRAND.primaryCta.href,
            variant: "default",
          },
        ]}
      />

      <Footer />
    </BrandedBackground>
  );
}
