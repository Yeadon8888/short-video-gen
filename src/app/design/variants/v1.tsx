import { Layers, Coins, Zap, ImageIcon, Gauge } from "lucide-react";
import AxionLabs from "@/components/launch-ui/logos/axionlabs";
import Driftbase from "@/components/launch-ui/logos/driftbase";

import BentoGrid from "@/components/launch-ui/sections/bento-grid/3-rows-top";
import CTA from "@/components/launch-ui/sections/cta/box";
import FAQ from "@/components/launch-ui/sections/faq/static";
import Footer from "@/components/launch-ui/sections/footer/5-columns";
import Hero from "@/components/launch-ui/sections/hero/illustration";
import Navbar from "@/components/launch-ui/sections/navbar/floating";
import Pricing from "@/components/launch-ui/sections/pricing/3-cols-subscription";
import Stats from "@/components/launch-ui/sections/stats/grid-boxed";
import TestimonialsGrid from "@/components/launch-ui/sections/testimonials/grid";
import { Button } from "@/components/launch-ui/ui/button";
import RisingLargeIllustration from "@/components/launch-ui/illustrations/rising-large";

import {
  BRAND,
  BrandedBackground,
  CASES,
  FAQ_ITEMS,
  FOOTER_COLUMNS,
  SampleVideo,
  VidClawMark,
  type VariantProps,
} from "./shared";

export default function V1Luna({ samples }: VariantProps) {
  return (
    <BrandedBackground>
      <Navbar
        logo={<VidClawMark />}
        name={BRAND.name}
        homeUrl="/design/1"
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
      <main className="flex-1">
        <Hero
          title={BRAND.tagline}
          description={BRAND.sub}
          illustration={
            <div className="mx-auto w-full max-w-3xl">
              <SampleVideo sample={samples.hero} aspect="16/9" />
            </div>
          }
          form={
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-3">
                <Button variant="default" size="lg" asChild>
                  <a href={BRAND.primaryCta.href}>{BRAND.primaryCta.text}</a>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <a href={BRAND.secondaryCta.href}>{BRAND.secondaryCta.text}</a>
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                {BRAND.pricingHint} · 注册即送试用积分
              </p>
            </div>
          }
        />
        <Stats
          title="被 300+ 电商团队信赖"
          description="从 DTC 卖家到跨境代运营，VidClaw 已成为他们的标准视频生产线。"
          items={[
            { value: "¥900K", label: "月利润", description: "头部客户单月带货净利" },
            { value: "80,000+", label: "已生成视频", description: "累计交付成片" },
            { value: "8", label: "视频模型", description: "Sora / VEO / Hailuo..." },
            { value: "~3min", label: "平均出片", description: "端到端时间" },
          ]}
        />
        <BentoGrid
          title="为电商短视频而生"
          description="一套工作流串起 8 种主流 AI 视频模型，从产品图到竖版成片再到批量下载。"
          tiles={[
            {
              title: "8 模型聚合",
              description: (
                <p className="max-w-[460px]">
                  Sora 2、VEO 3.1、Hailuo、Seedance、Kling、Plato、Yunwu、Dashscope 统一接口。
                </p>
              ),
              visual: (
                <div className="min-h-[240px] grow basis-0 sm:p-4 md:min-h-[320px] md:py-12 lg:min-h-[360px]">
                  <RisingLargeIllustration />
                </div>
              ),
              icon: <Layers className="text-muted-foreground size-6 stroke-1" />,
              size: "col-span-12 md:flex-row",
            },
            {
              title: "批量并发",
              description: (
                <p className="max-w-[460px]">
                  一个 SKU 一次跑 N 条素材，失败自动切换备用模型。
                </p>
              ),
              visual: (
                <div className="min-h-[160px] grow items-center self-center p-6">
                  <SampleVideo
                    sample={samples.modelSamples[0] ?? null}
                    aspect="9/16"
                    className="mx-auto max-w-[180px]"
                  />
                </div>
              ),
              icon: <Zap className="text-muted-foreground size-6 stroke-1" />,
              size: "col-span-12 md:col-span-6 lg:col-span-5",
            },
            {
              title: "9:16 白底优化",
              description: (
                <p className="max-w-[460px]">
                  产品图自动去背、补白、居中，直接适配短视频平台规格。
                </p>
              ),
              visual: (
                <div className="min-h-[240px] grow items-center self-center p-6">
                  <SampleVideo
                    sample={samples.modelSamples[1] ?? null}
                    aspect="9/16"
                    className="mx-auto max-w-[220px]"
                  />
                </div>
              ),
              icon: <ImageIcon className="text-muted-foreground size-6 stroke-1" />,
              size: "col-span-12 md:col-span-6 lg:col-span-7",
            },
            {
              title: "积分永不过期",
              description:
                "按次扣积分，失败自动退款，跨模型通用，不绑定单一供应商。",
              visual: (
                <div className="min-h-[240px] grow basis-0 sm:p-4 md:min-h-[320px]">
                  <RisingLargeIllustration />
                </div>
              ),
              icon: <Coins className="text-muted-foreground size-6 stroke-1" />,
              size: "col-span-12 md:col-span-6 lg:col-span-6",
            },
            {
              title: "3 分钟出片",
              description: (
                <p className="max-w-[460px]">
                  端到端平均 3 分钟，任务并发自动轮询，Dashboard 实时追踪。
                </p>
              ),
              visual: (
                <div className="min-h-[240px] w-full grow items-center self-center p-6">
                  <SampleVideo
                    sample={samples.modelSamples[2] ?? null}
                    aspect="9/16"
                    className="mx-auto max-w-[220px]"
                  />
                </div>
              ),
              icon: <Gauge className="text-muted-foreground size-6 stroke-1" />,
              size: "col-span-12 md:col-span-6 lg:col-span-6",
            },
          ]}
        />
        <section id="cases" className="bg-background">
          <div className="max-w-container mx-auto px-4 py-24">
            <h2 className="text-3xl font-semibold sm:text-5xl">真实客户案例</h2>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {CASES.map((c) => (
                <div
                  key={c.name}
                  className="rounded-2xl border border-border bg-card p-8"
                >
                  <div className="text-brand text-3xl font-bold">{c.stat}</div>
                  <div className="mt-2 text-lg font-semibold">{c.name}</div>
                  <p className="text-muted-foreground mt-3">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <TestimonialsGrid
          items={[
            {
              name: "Jason Liu",
              role: "创始人, DTC 家居品牌",
              text: "外包剪一条 300 块排一周，现在 3 分钟一条，一天 20 个 SKU 同步上线，投流成本砍掉 80%。",
              image: "/placeholder-avatar.svg",
              Logo: AxionLabs,
            },
            {
              name: "Mia Chen",
              role: "增长负责人, TikTok 独立站",
              text: "批量并发太香了，BF 前两周给 80 个 SKU 出竖屏视频，ROAS 稳定在 2.8 以上。",
              image: "/placeholder-avatar.svg",
              Logo: Driftbase,
            },
          ]}
        />
        <div id="pricing">
          <Pricing
            title="透明计费 · 积分永不过期"
            description="按需购买，不绑定订阅。最低 $9.9 起步，当月用不完下个月继续用。"
            yearlyDiscount={0}
            plans={[
              {
                name: "Starter",
                description: "个人卖家 / 小团队试水",
                monthlyPrice: 9.9,
                yearlyPrice: 9.9 * 12,
                cta: { label: "立即开始", href: "/register", variant: "default" },
                features: [
                  "700 积分 (约 100 条)",
                  "全部 8 款 AI 模型",
                  "9:16 产品图优化",
                  "邮件支持",
                  "积分永久有效",
                ],
                variant: "default",
              },
              {
                name: "Pro",
                description: "最受电商团队欢迎",
                monthlyPrice: 49,
                yearlyPrice: 49 * 12,
                cta: { label: "升级 Pro", href: "/register?plan=pro", variant: "default" },
                features: [
                  "3500 积分 (约 500 条)",
                  "全部 8 款 AI 模型",
                  "批量并发 / ZIP 打包",
                  "优先队列",
                  "工单支持",
                  "积分永久有效",
                ],
                variant: "glow-brand",
              },
              {
                name: "Enterprise",
                description: "代运营 / 品牌团队 / API",
                monthlyPrice: 299,
                yearlyPrice: 299 * 12,
                cta: { label: "联系销售", href: "mailto:hello@vidclaw.com", variant: "glow" },
                features: [
                  "大额积分包",
                  "REST API + Webhook",
                  "专属对接群 + SLA",
                  "定制模型 / 私有部署",
                ],
                variant: "glow",
              },
            ]}
          />
        </div>
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
          description="注册即送试用积分，先跑一轮再决定要不要付费。"
          buttons={[
            { text: BRAND.primaryCta.text, href: BRAND.primaryCta.href, variant: "default" },
            { text: "查看定价", href: "#pricing", variant: "outline" },
          ]}
        />
      </main>
      <Footer
        logo={<VidClawMark />}
        name={BRAND.name}
        columns={FOOTER_COLUMNS}
        copyright="© 2026 VidClaw. All rights reserved."
      />
    </BrandedBackground>
  );
}
