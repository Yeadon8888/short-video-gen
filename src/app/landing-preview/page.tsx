import {
  Sparkles,
  Layers,
  ImageIcon,
  Coins,
  Plug,
  Zap,
} from "lucide-react";

import { Button } from "@/components/launch-ui/ui/button";
import ChatIllustration from "@/components/launch-ui/illustrations/chat";
import CodeEditorIllustration from "@/components/launch-ui/illustrations/code-editor";
import MockupBrowserIllustration from "@/components/launch-ui/illustrations/mockup-browser";
import MockupMobileIllustration from "@/components/launch-ui/illustrations/mockup-mobile";
import RisingLargeIllustration from "@/components/launch-ui/illustrations/rising-large";
import RisingSmallIllustration from "@/components/launch-ui/illustrations/rising-small";
import AxionLabs from "@/components/launch-ui/logos/axionlabs";
import Driftbase from "@/components/launch-ui/logos/driftbase";
import Flowrate from "@/components/launch-ui/logos/flowrate";
import Orbitra from "@/components/launch-ui/logos/orbitra";
import Quantify from "@/components/launch-ui/logos/quantify";
import Synthetikai from "@/components/launch-ui/logos/synthetikai";
import BentoGrid from "@/components/launch-ui/sections/bento-grid/3-rows-top";
import CTA from "@/components/launch-ui/sections/cta/box";
import FAQ from "@/components/launch-ui/sections/faq/static";
import FeatureIllustrationBottom from "@/components/launch-ui/sections/feature/illustration-bottom";
import Footer from "@/components/launch-ui/sections/footer/5-columns";
import Hero from "@/components/launch-ui/sections/hero/illustration";
import Logos from "@/components/launch-ui/sections/logos/grid-6";
import Navbar from "@/components/launch-ui/sections/navbar/floating";
import Pricing from "@/components/launch-ui/sections/pricing/3-cols-subscription";
import Stats from "@/components/launch-ui/sections/stats/grid-boxed";
import TestimonialsGrid from "@/components/launch-ui/sections/testimonials/grid";

function VidClawMark({ className }: { className?: string }) {
  return (
    <span
      className={
        "inline-flex size-7 items-center justify-center rounded-md bg-foreground text-background " +
        (className ?? "")
      }
    >
      <Sparkles className="size-4" strokeWidth={2.25} />
    </span>
  );
}

export default function LandingPreviewPage() {
  return (
    <div
      className="flex flex-col"
      style={
        {
          "--brand-foreground": "var(--brand-titanium-foreground)",
          "--brand": "var(--brand-titanium)",
          "--primary": "light-dark(var(--brand-titanium), oklch(0.985 0 0))",
          "--background": "var(--background-titanium)",
          "--muted": "var(--background-titanium)",
          "--radius": "var(--radius-default)",
        } as React.CSSProperties
      }
    >
      <Navbar
        logo={<VidClawMark />}
        name="VidClaw"
        actions={[
          { text: "登录", href: "/auth/login" },
          {
            text: "Start free",
            href: "/auth/signup",
            isButton: true,
            variant: "default",
          },
        ]}
      />
      <main className="flex-1">
        <Hero
          title="从一张产品图，批量生成高转化短视频"
          description="上传产品图 + 一句 prompt，主流 AI 视频模型任选，30 秒一条 9:16 成片，信用卡付费按量计费。"
          illustration={<RisingSmallIllustration />}
          form={
            <div className="flex flex-col items-center gap-3">
              <div className="flex w-full max-w-[420px] gap-2">
                <Button variant="default" size="lg" asChild>
                  <a href="/auth/signup">免费试用</a>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <a href="#pricing">查看定价</a>
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                注册即送试用积分，无需信用卡。
              </p>
            </div>
          }
        />
        <Stats
          title="行业领先的生成效率"
          description="我们的视频管线经过多模型优化，稳定、快速、可批量。"
          items={[
            {
              value: "99.9%",
              label: "服务可用性",
              description: "多模型自动故障切换，任务不丢失",
            },
            {
              value: "80,000+",
              label: "已生成视频",
              description: "累计为电商品牌交付的成片数量",
            },
            {
              value: "300+",
              label: "付费客户",
              description: "覆盖跨境电商、独立站、亚马逊卖家",
            },
            {
              value: "~30s",
              label: "平均生成时长",
              description: "从提交到可下载的端到端时间",
            },
          ]}
        />
        <Logos
          title="受到电商品牌与增长团队的信赖"
          logoItems={[
            { logo: <AxionLabs className="h-8 w-auto" /> },
            { logo: <Driftbase className="h-8 w-auto" /> },
            { logo: <Orbitra className="h-8 w-auto" /> },
            { logo: <Quantify className="h-8 w-auto" /> },
            { logo: <Synthetikai className="h-8 w-auto" /> },
            { logo: <Flowrate className="h-8 w-auto" /> },
          ]}
        />
        <BentoGrid
          title="为电商视频而生的功能集合"
          description="一套工作流串起 5 种主流 AI 视频模型，从产品图到竖版成片再到批量下载，零切屏完成。"
          tiles={[
            {
              title: "多模型任选",
              description: (
                <p className="max-w-[320px] lg:max-w-[460px]">
                  Grok、Sora、Dashscope、Plato、Yunwu 五大主流模型统一接口。
                  不同场景匹配不同模型，失败自动重试。
                </p>
              ),
              visual: (
                <div className="min-h-[240px] grow basis-0 sm:p-4 md:min-h-[320px] md:py-12 lg:min-h-[360px]">
                  <MockupBrowserIllustration />
                </div>
              ),
              icon: (
                <Layers className="text-muted-foreground size-6 stroke-1" />
              ),
              size: "col-span-12 md:flex-row",
            },
            {
              title: "批量并发",
              description: (
                <p className="max-w-[460px]">
                  一个产品一次性跑 N 条素材；批量任务按速率平滑投递，
                  自动轮询状态，任何一条失败都会自动退款积分。
                </p>
              ),
              visual: (
                <div className="min-h-[160px] grow items-center self-center">
                  <ChatIllustration />
                </div>
              ),
              icon: <Zap className="text-muted-foreground size-6 stroke-1" />,
              size: "col-span-12 md:col-span-6 lg:col-span-5",
            },
            {
              title: "产品图优化",
              description: (
                <p className="max-w-[460px]">
                  内置 9:16 白底优化管线，产品图自动去背、补白、居中，
                  直接适配短视频平台的竖屏尺寸。
                </p>
              ),
              visual: (
                <div className="min-h-[240px] w-full grow items-center self-center px-4 lg:px-12">
                  <CodeEditorIllustration />
                </div>
              ),
              icon: (
                <ImageIcon className="text-muted-foreground size-6 stroke-1" />
              ),
              size: "col-span-12 md:col-span-6 lg:col-span-7",
            },
            {
              title: "积分灵活计费",
              description:
                "按生成次数扣积分，任务失败自动退款，余额可跨模型复用，不绑定单一供应商。",
              visual: (
                <div className="min-h-[240px] grow basis-0 sm:p-4 md:min-h-[320px] md:py-12 lg:min-h-[360px]">
                  <MockupBrowserIllustration />
                </div>
              ),
              icon: <Coins className="text-muted-foreground size-6 stroke-1" />,
              size: "col-span-12 md:col-span-6 lg:col-span-6",
            },
            {
              title: "API 接入",
              description: (
                <p className="max-w-[460px]">
                  提供 REST API，支持企业自建系统直接下发任务、
                  查询结果、自动归档到 R2/S3。
                </p>
              ),
              visual: (
                <div className="min-h-[240px] w-full grow items-center self-center px-4 lg:px-12">
                  <MockupMobileIllustration />
                </div>
              ),
              icon: <Plug className="text-muted-foreground size-6 stroke-1" />,
              size: "col-span-12 md:col-span-6 lg:col-span-6",
            },
          ]}
        />
        <FeatureIllustrationBottom
          title="覆盖从产品图到短视频的完整链路"
          description="VidClaw 是一体化的电商视频生成平台,包含素材处理、模型调度、任务监控与批量下载,无需再拼接多个工具。"
          visual={<RisingLargeIllustration />}
        />
        <TestimonialsGrid
          items={[
            {
              name: "Jason Liu",
              role: "创始人, DTC 家居品牌",
              text: "之前外包剪视频一条 300 块还要排一周队,现在 30 秒一条,一天给 20 个 SKU 出素材,投流测试成本砍掉 80%。",
              image: "/placeholder-avatar.svg",
              Logo: Orbitra,
            },
            {
              name: "Mia Chen",
              role: "增长负责人, 独立站 3C 卖家",
              text: "批量并发非常香,Black Friday 前两周一口气给 80 个产品出竖屏视频,TikTok 投放 ROAS 稳定在 2.8 以上。",
              image: "/placeholder-avatar.svg",
              Logo: Driftbase,
            },
          ]}
        />
        <div id="pricing">
          <Pricing
            title="定价"
            description="按月订阅或按年预付。所有方案均以积分结算,未用完可次月滚存(月订阅不滚存至新周期)。"
            yearlyDiscount={20}
            plans={[
              {
                name: "Starter",
                description: "个人卖家和小团队入门",
                monthlyPrice: 9,
                yearlyPrice: 86,
                features: [
                  "每月 300 积分(约 60 条视频)",
                  "2 条并发",
                  "Grok / Sora / Dashscope 模型",
                  "标准队列",
                  "邮件支持",
                ],
                cta: {
                  label: "立即开始",
                  href: "/auth/signup",
                  variant: "default",
                },
                variant: "default",
              },
              {
                name: "Pro",
                description: "最受电商团队欢迎",
                monthlyPrice: 29,
                yearlyPrice: 278,
                features: [
                  "每月 1200 积分(约 240 条视频)",
                  "5 条并发",
                  "全部 5 款 AI 模型",
                  "优先队列",
                  "批量下载 ZIP",
                  "工单支持",
                ],
                cta: {
                  label: "升级 Pro",
                  href: "/auth/signup?plan=pro",
                  variant: "default",
                },
                variant: "glow-brand",
              },
              {
                name: "Business",
                description: "面向代运营与品牌团队",
                monthlyPrice: 99,
                yearlyPrice: 950,
                features: [
                  "每月 5000 积分(约 1000 条视频)",
                  "10 条并发",
                  "全部 5 款 AI 模型",
                  "API 接入",
                  "VIP 优先队列",
                  "专属对接群 + SLA",
                ],
                cta: {
                  label: "联系销售",
                  href: "mailto:hello@vidclaw.com",
                  variant: "glow",
                },
                variant: "glow",
              },
            ]}
          />
        </div>
        <FAQ
          title="常见问题"
          items={[
            {
              question: "一条视频大概多少钱?",
              answer: (
                <p className="text-muted-foreground mb-4 max-w-[640px] text-balance">
                  以 Pro 方案为例,每月 $29 包含 1200 积分,按常用模型一条视频
                  5 积分计算,相当于每条 $0.12。具体消耗因模型和时长而异。
                </p>
              ),
            },
            {
              question: "支持哪些视频模型?",
              answer: (
                <p className="text-muted-foreground mb-4 max-w-[640px] text-balance">
                  当前支持 Grok Imagine、Sora、Dashscope(万相)、Plato、Yunwu,
                  覆盖主流效果与价位段。我们持续接入新的模型供应商。
                </p>
              ),
            },
            {
              question: "生成失败会扣积分吗?",
              answer: (
                <p className="text-muted-foreground mb-4 max-w-[640px] text-balance">
                  不会。任务失败会自动退回全部积分,同时系统会尝试切换到
                  备用模型重试,除非你显式取消。
                </p>
              ),
            },
            {
              question: "可以接入我们现有的工作流吗?",
              answer: (
                <p className="text-muted-foreground mb-4 max-w-[640px] text-balance">
                  Business 方案提供 REST API 与 Webhook,可以对接 ERP、
                  PIM 或自研投流中台,批量下发任务并接收结果通知。
                </p>
              ),
            },
            {
              question: "如何付款?有发票吗?",
              answer: (
                <p className="text-muted-foreground mb-4 max-w-[640px] text-balance">
                  支持 Stripe 信用卡(USD)与支付宝结算,付款后自动开具
                  电子发票,Business 客户可申请企业抬头。
                </p>
              ),
            },
          ]}
        />
        <CTA
          title="准备好为你的产品量产短视频了吗?"
          description="注册即送试用积分,跑完一轮再决定要不要付费。"
          buttons={[
            {
              text: "免费试用",
              href: "/auth/signup",
              variant: "default",
            },
            {
              text: "查看定价",
              href: "#pricing",
              variant: "outline",
            },
          ]}
        />
      </main>
      <Footer
        logo={<VidClawMark />}
        name="VidClaw"
        columns={[
          {
            title: "产品",
            links: [
              { text: "功能特性", href: "#" },
              { text: "定价", href: "#pricing" },
              { text: "API 文档", href: "#" },
              { text: "模型对比", href: "#" },
            ],
          },
          {
            title: "资源",
            links: [
              { text: "教程", href: "/blog" },
              { text: "示例作品", href: "/gallery" },
              { text: "提示词模板", href: "#" },
              { text: "案例研究", href: "#" },
            ],
          },
          {
            title: "公司",
            links: [
              { text: "关于我们", href: "#" },
              { text: "博客", href: "/blog" },
              { text: "联系", href: "mailto:hello@vidclaw.com" },
              { text: "服务条款", href: "#" },
            ],
          },
        ]}
        copyright="© 2026 VidClaw. All rights reserved."
      />
    </div>
  );
}
