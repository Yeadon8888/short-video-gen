import { Smartphone, Sparkles, Coins, Zap } from "lucide-react";

import Hero from "@/components/launch-ui/sections/hero/mobile-app";
import Navbar from "@/components/launch-ui/sections/navbar/floating";
import Footer from "@/components/launch-ui/sections/footer/minimal";
import { Section } from "@/components/launch-ui/ui/section";
import { Badge } from "@/components/launch-ui/ui/badge";

import {
  BRAND,
  BrandedBackground,
  SampleVideo,
  VidClawMark,
  type VariantProps,
} from "./shared";

function PhoneFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "relative mx-auto aspect-[9/18] w-full max-w-[280px] rounded-[2.2rem] border-8 border-foreground/90 bg-foreground/90 shadow-[0_40px_80px_-20px_var(--brand)] " +
        (className ?? "")
      }
    >
      <div className="absolute inset-x-1/3 top-0 z-10 h-5 rounded-b-2xl bg-foreground/90" />
      <div className="relative size-full overflow-hidden rounded-[1.5rem] bg-background">
        {children}
      </div>
    </div>
  );
}

export default function V8MobileApp({ samples }: VariantProps) {
  const feat = [
    {
      icon: Smartphone,
      title: "手机上也能出片",
      desc: "直接在浏览器打开，手机拍一张产品图立即生成成片。",
    },
    {
      icon: Zap,
      title: "3 分钟 · 真的",
      desc: "点击生成后可以去刷手机，再回来成片就在下载盒里。",
    },
    {
      icon: Coins,
      title: "先试再买",
      desc: "注册即送试用积分，体验完再决定要不要付 $9.9 起步套餐。",
    },
    {
      icon: Sparkles,
      title: "8 个模型选",
      desc: "根据风格和预算切换模型，不需要记参数。",
    },
  ];

  return (
    <BrandedBackground>
      <Navbar
        logo={<VidClawMark />}
        name={BRAND.name}
        homeUrl="/design/8"
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
        badge={
          <Badge variant="outline" className="animate-appear">
            <span className="text-muted-foreground">在手机上也能一键出片</span>
          </Badge>
        }
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
          <PhoneFrame>
            <SampleVideo sample={samples.hero} aspect="9/18" className="rounded-none" />
          </PhoneFrame>
        }
      />

      {/* STACKED 3 phones */}
      <Section id="models">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="text-3xl font-semibold sm:text-5xl">
            生成的是 9:16 竖屏成片
          </h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-xl">
            自带产品图去背 + 补白 + 居中预处理，直接适配抖音 / TikTok / Shop 规格。
          </p>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <PhoneFrame key={i}>
                <SampleVideo
                  sample={samples.modelSamples[i] ?? null}
                  aspect="9/18"
                  className="rounded-none"
                />
              </PhoneFrame>
            ))}
          </div>
        </div>
      </Section>

      <Section className="bg-muted/5" id="features">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-4">
          {feat.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-brand/15 text-brand">
                  <Icon className="size-5" />
                </div>
                <div className="mt-4 text-lg font-semibold">{f.title}</div>
                <p className="text-muted-foreground mt-2 text-sm">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            {BRAND.pricingHint}
          </h2>
          <p className="text-muted-foreground">积分永久有效 · 失败自动退款</p>
          <a
            href={BRAND.primaryCta.href}
            className="mt-2 rounded-md bg-brand px-6 py-3 text-sm font-medium text-background"
          >
            {BRAND.primaryCta.text}
          </a>
        </div>
      </Section>

      <Footer
        copyright="© 2026 VidClaw. All rights reserved."
        showModeToggle={false}
        links={[
          { text: "登录", href: "/login" },
          { text: "注册", href: "/register" },
          { text: "隐私", href: "/privacy" },
          { text: "条款", href: "/terms" },
        ]}
      />
    </BrandedBackground>
  );
}
