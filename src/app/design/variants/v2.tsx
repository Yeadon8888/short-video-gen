import { ArrowRight, Check } from "lucide-react";

import Navbar from "@/components/launch-ui/sections/navbar/default";
import Footer from "@/components/launch-ui/sections/footer/minimal";
import { Button } from "@/components/launch-ui/ui/button";
import { Section } from "@/components/launch-ui/ui/section";

import {
  BRAND,
  BrandedBackground,
  CASES,
  PRICING_TIERS,
  SampleVideo,
  VALUE_PROPS,
  VidClawMark,
  type VariantProps,
} from "./shared";

export default function V2Neptune({ samples }: VariantProps) {
  return (
    <BrandedBackground>
      <Navbar
        logo={<VidClawMark />}
        name={BRAND.name}
        homeUrl="/design/2"
        actions={[
          { text: "登录", href: "/login", isButton: false },
          {
            text: "免费开始",
            href: BRAND.primaryCta.href,
            isButton: true,
            variant: "default",
          },
        ]}
      />

      {/* HERO — huge centered headline over data wall */}
      <Section className="relative overflow-hidden pt-32">
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/5 px-4 py-1.5 text-xs text-brand">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
            </span>
            Sora 2 · VEO 3.1 · Hailuo · Seedance · 一个账号全搞定
          </div>
          <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
            {BRAND.tagline}
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg">
            {BRAND.sub}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button variant="default" size="lg" asChild>
              <a href={BRAND.primaryCta.href}>
                {BRAND.primaryCta.text}
                <ArrowRight className="ml-1 size-4" />
              </a>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href={BRAND.secondaryCta.href}>{BRAND.secondaryCta.text}</a>
            </Button>
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            {BRAND.pricingHint}
          </p>
        </div>

        {/* data wall */}
        <div className="mx-auto mt-20 grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
          {[
            { v: "8", l: "接入模型" },
            { v: "~3min", l: "平均出片" },
            { v: "80K+", l: "已生成视频" },
            { v: "¥900K", l: "头部客户月利润" },
          ].map((s) => (
            <div
              key={s.l}
              className="bg-background p-8 text-center"
            >
              <div className="text-brand text-4xl font-bold">{s.v}</div>
              <div className="text-muted-foreground mt-1 text-sm">{s.l}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* LOGO STRIP */}
      <div className="border-y border-border bg-muted/10 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-around gap-6 px-6 text-muted-foreground text-sm">
          <span>Sora 2</span>
          <span>VEO 3.1</span>
          <span>Hailuo</span>
          <span>Seedance</span>
          <span>Kling</span>
          <span>Plato</span>
          <span>Yunwu</span>
          <span>Dashscope</span>
        </div>
      </div>

      {/* STICKY FEATURE: sample gallery */}
      <Section id="models">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-semibold sm:text-5xl">
            真实样片 · 来自真实客户
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl">
            以下视频均由用户通过 VidClaw 生成。挑一个模型，3 分钟后你也能得到同样质量的成片。
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            {samples.modelSamples.slice(0, 8).map((m, i) => (
              <div key={i}>
                <SampleVideo sample={m} aspect="9/16" />
                <div className="mt-2 text-sm font-medium">{m.name}</div>
              </div>
            ))}
            {samples.modelSamples.length === 0 &&
              Array.from({ length: 8 }).map((_, i) => (
                <SampleVideo key={i} sample={null} aspect="9/16" />
              ))}
          </div>
        </div>
      </Section>

      {/* VALUE PROPS 3-col */}
      <Section className="bg-muted/5" id="features">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-semibold sm:text-5xl">
            为什么选 VidClaw
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {VALUE_PROPS.map((v) => (
              <div
                key={v.title}
                className="rounded-xl border border-border bg-card p-6"
              >
                <div className="text-lg font-semibold">{v.title}</div>
                <p className="text-muted-foreground mt-2 text-sm">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* CASES */}
      <Section id="cases">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
          {CASES.map((c) => (
            <div
              key={c.name}
              className="relative overflow-hidden rounded-2xl border border-border bg-card p-10"
            >
              <div className="text-brand text-4xl font-bold">{c.stat}</div>
              <div className="mt-2 text-xl font-semibold">{c.name}</div>
              <p className="text-muted-foreground mt-4 max-w-md">{c.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* PRICING custom 3-col */}
      <Section id="pricing">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-3xl font-semibold sm:text-5xl">
              透明计费 · 积分永不过期
            </h2>
            <p className="text-muted-foreground mt-3">
              按需购买，不绑定订阅。$9.9 起步。
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PRICING_TIERS.map((t) => (
              <div
                key={t.name}
                className={
                  "rounded-2xl border bg-card p-8 " +
                  (t.highlight
                    ? "border-brand shadow-[0_0_40px_-10px_var(--brand)]"
                    : "border-border")
                }
              >
                <div className="text-xl font-semibold">{t.name}</div>
                <div className="text-muted-foreground mt-1 text-sm">
                  {t.desc}
                </div>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-4xl font-bold">{t.price}</span>
                  <span className="text-muted-foreground text-sm">
                    {t.cadence}
                  </span>
                </div>
                <ul className="mt-6 space-y-2">
                  {t.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Check className="text-brand mt-0.5 size-4 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-8 w-full"
                  variant={t.highlight ? "default" : "outline"}
                  asChild
                >
                  <a href={t.cta.href}>{t.cta.text}</a>
                </Button>
              </div>
            ))}
          </div>
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
