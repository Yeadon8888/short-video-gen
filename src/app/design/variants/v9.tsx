import { Check } from "lucide-react";

import Navbar from "@/components/launch-ui/sections/navbar/static";
import Hero from "@/components/launch-ui/sections/hero/barebone";
import Footer from "@/components/launch-ui/sections/footer/minimal";
import { Section } from "@/components/launch-ui/ui/section";
import { Button } from "@/components/launch-ui/ui/button";

import {
  BRAND,
  BrandedBackground,
  PRICING_TIERS,
  VidClawMark,
  type VariantProps,
} from "./shared";

export default function V9Enterprise({}: VariantProps) {
  return (
    <BrandedBackground>
      <Navbar
        logo={<VidClawMark />}
        name={BRAND.name}
        homeUrl="/design/9"
        mobileLinks={[
          { text: "产品", href: "#features" },
          { text: "定价", href: "#pricing" },
          { text: "案例", href: "#case" },
        ]}
        actions={[
          { text: "登录", href: "/login" },
          {
            text: "申请试用",
            href: BRAND.primaryCta.href,
            isButton: true,
            variant: "outline",
          },
        ]}
      />

      <Hero
        title={BRAND.tagline}
        description={BRAND.sub}
        buttons={[
          {
            text: "申请试用",
            href: BRAND.primaryCta.href,
            variant: "default",
          },
          {
            text: "联系销售",
            href: "mailto:hello@vidclaw.com",
            variant: "outline",
          },
        ]}
      />

      {/* VALUE ROW (muted) */}
      <Section id="features">
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-4">
          {[
            ["8", "接入模型"],
            ["~3min", "端到端出片"],
            ["99.9%", "服务可用性"],
            ["REST", "API 接入"],
          ].map(([v, l]) => (
            <div key={l} className="text-center">
              <div className="text-3xl font-semibold">{v}</div>
              <div className="text-muted-foreground mt-1 text-xs uppercase tracking-wider">
                {l}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Single testimonial */}
      <Section id="case" className="border-y border-border/60 bg-muted/5">
        <figure className="mx-auto max-w-3xl text-center">
          <blockquote className="text-2xl font-medium leading-relaxed tracking-tight sm:text-3xl">
            “我们接入 VidClaw 之后，单月通过短视频带货做到了
            <span className="text-brand"> ¥900,000 </span>
            净利润。过去排期一周的视频外包，现在 3 分钟就能出一条。”
          </blockquote>
          <figcaption className="text-muted-foreground mt-6 text-sm">
            — 某头部短视频带货团队负责人
          </figcaption>
        </figure>
      </Section>

      {/* PRICING 3-col */}
      <Section id="pricing">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12">
            <h2 className="text-3xl font-semibold sm:text-4xl">定价</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              按需购买，不绑定订阅。积分永不过期，失败自动退款。
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {PRICING_TIERS.map((t) => (
              <div
                key={t.name}
                className={
                  "flex flex-col rounded-lg border p-6 " +
                  (t.highlight
                    ? "border-foreground bg-foreground/[0.02]"
                    : "border-border")
                }
              >
                <div className="text-sm font-medium uppercase tracking-wider">
                  {t.name}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold">{t.price}</span>
                  <span className="text-muted-foreground text-xs">
                    {t.cadence}
                  </span>
                </div>
                <p className="text-muted-foreground mt-2 text-sm">{t.desc}</p>
                <ul className="mt-6 flex-1 space-y-2">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6 w-full"
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

      <Section>
        <div className="mx-auto flex max-w-3xl flex-col items-start gap-4">
          <h2 className="text-2xl font-semibold">
            需要企业级部署？
          </h2>
          <p className="text-muted-foreground max-w-xl text-sm">
            我们为代运营公司、品牌团队、独立站集团提供大额积分包、
            REST API、Webhook、定制模型和私有部署方案，欢迎联系销售对接。
          </p>
          <Button variant="outline" asChild>
            <a href="mailto:hello@vidclaw.com">联系销售 →</a>
          </Button>
        </div>
      </Section>

      <Footer
        copyright="© 2026 VidClaw. 企业级 AI 视频生成平台。"
        showModeToggle={false}
        links={[
          { text: "登录", href: "/login" },
          { text: "申请试用", href: "/register" },
          { text: "隐私", href: "/privacy" },
          { text: "条款", href: "/terms" },
        ]}
      />
    </BrandedBackground>
  );
}
