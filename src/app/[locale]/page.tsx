import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ArrowRight,
  Zap,
  Shield,
  Clock,
  Globe,
  Check,
  PawPrint,
  Store,
  Sparkles,
} from "lucide-react";
import { HeroDemoAnimation } from "@/components/landing/HeroDemoAnimation";
import { ShowcaseGrid } from "@/components/landing/ShowcaseGrid";
import { CursorGlow } from "@/components/landing/CursorGlow";
import { LocaleSwitcher } from "@/components/landing/LocaleSwitcher";

const MARQUEE_MODELS = [
  "Sora 2",
  "VEO 3.1",
  "Hailuo 2.3",
  "Seedance 2.0",
  "Kling 2.5",
  "Runway Gen-4",
  "Pika 2.2",
  "Luma Ray 2",
  "Wan 2.5",
  "Grok Imagine",
  "Nano Banana",
  "PixVerse",
  "Mochi 1",
  "CogVideoX",
  "Plato",
  "Yunwu",
  "Dashscope",
];

type Props = { params: Promise<{ locale: string }> };

export default async function LocalizedLanding({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const localePrefix = `/${locale}`;
  const trustPoints = [
    { Icon: Shield, text: t("hero.trust.refund") },
    { Icon: Clock, text: t("hero.trust.speed") },
    { Icon: Globe, text: t("hero.trust.lang") },
  ];

  const pricing = [
    {
      key: "starter",
      highlight: false,
      cta: t("pricing.ctaBuy"),
      href: `${localePrefix}/pricing`,
    },
    {
      key: "pro",
      highlight: true,
      cta: t("pricing.ctaBuy"),
      href: `${localePrefix}/pricing`,
    },
    {
      key: "enterprise",
      highlight: false,
      cta: t("pricing.ctaContact"),
      href: "/contact",
    },
  ] as const;

  return (
    <div
      className="relative min-h-screen text-white"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(13,204,242,0.10), transparent), #0a1214",
      }}
    >
      <CursorGlow />

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a1214]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
          <Link href={localePrefix} className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0dccf2]">
              <Sparkles className="h-4 w-4 text-[#0a1214]" />
            </div>
            <span className="text-lg font-bold tracking-tight">VidClaw</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-400 md:flex">
            <a href="#models" className="transition-colors hover:text-white">
              {t("nav.models")}
            </a>
            <a href="#cases" className="transition-colors hover:text-white">
              {t("nav.cases")}
            </a>
            <a href="#pricing" className="transition-colors hover:text-white">
              {t("nav.pricing")}
            </a>
            <Link href="/gallery" className="transition-colors hover:text-white">
              {t("nav.gallery")}
            </Link>
            <Link href="/blog" className="transition-colors hover:text-white">
              {t("nav.blog")}
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <Link
              href="/login"
              className="hidden text-sm text-slate-400 transition-colors hover:text-white sm:block"
            >
              {t("nav.login")}
            </Link>
            <Link
              href="/register"
              className="flex items-center gap-2 rounded-lg bg-[#0dccf2] px-5 py-2 text-sm font-medium text-[#0a1214] transition-all hover:brightness-110"
            >
              {t("nav.cta")}
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden px-6 pb-6 pt-6 lg:pt-8">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-[#0dccf2]/8 blur-[120px]" />
            <div className="absolute -right-40 top-20 h-[400px] w-[400px] rounded-full bg-cyan-500/5 blur-[100px]" />
          </div>

          <div className="relative mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0dccf2]/20 bg-[#0dccf2]/5 px-4 py-1.5 text-xs font-medium text-[#0dccf2]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0dccf2] opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#0dccf2]" />
                </span>
                {t("hero.badge")}
              </div>

              <h1 className="mt-5 text-4xl font-extrabold leading-[1.15] tracking-tight lg:text-5xl xl:text-6xl">
                {t("hero.titleLine1")}
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, #0dccf2, #60a5fa)",
                  }}
                >
                  {t("hero.titleLine2")}
                </span>
              </h1>

              <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-400">
                {t("hero.subtitle")}
              </p>

              <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0dccf2] px-8 py-3.5 text-sm font-semibold text-[#0a1214] shadow-lg shadow-[#0dccf2]/20 transition-all hover:brightness-110"
                >
                  <Zap className="h-4 w-4" />
                  {t("hero.primaryCta")}
                </Link>
                <Link
                  href="/gallery"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-6 py-3 text-sm text-slate-300 transition-all hover:bg-white/5"
                >
                  {t("hero.secondaryCta")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                {trustPoints.map(({ Icon, text }) => (
                  <span
                    key={text}
                    className="flex items-center gap-1.5 text-xs text-slate-500"
                  >
                    <Icon className="h-3 w-3" />
                    {text}
                  </span>
                ))}
              </div>
            </div>

            <HeroDemoAnimation />
          </div>
        </section>

        {/* ── Marquee ── */}
        <section
          id="models"
          className="relative overflow-hidden border-y border-white/5 bg-[#0a1214] py-6"
        >
          <div className="mx-auto max-w-[1200px] px-6">
            <p className="text-center text-sm font-medium text-slate-400">
              {t("marquee")}
            </p>
          </div>
          <div className="relative mt-6 flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
            <div className="flex shrink-0 animate-[marquee_40s_linear_infinite] items-center gap-12 pr-12">
              {MARQUEE_MODELS.concat(MARQUEE_MODELS).map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  className="whitespace-nowrap text-xl font-semibold text-slate-400 hover:text-white"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
          <style>{`
            @keyframes marquee {
              from { transform: translateX(0); }
              to { transform: translateX(-50%); }
            }
          `}</style>
        </section>

        {/* ── Showcase ── */}
        <section id="showcase" className="px-6 py-24">
          <div className="mx-auto max-w-[1200px]">
            <div className="text-center">
              <h2 className="text-3xl font-bold lg:text-4xl">
                {t("showcase.title")}
              </h2>
              <p className="mt-3 text-base text-slate-400">
                {t("showcase.subtitle")}
              </p>
            </div>
            <div className="mt-12">
              <ShowcaseGrid />
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section
          id="pricing"
          className="border-t border-white/5 bg-[#0d181b] px-6 py-24"
        >
          <div className="mx-auto max-w-[1200px]">
            <div className="text-center">
              <h2 className="text-3xl font-bold lg:text-4xl">
                {t("pricing.title")}
              </h2>
              <p className="mt-3 text-base text-slate-400">
                {t("pricing.subtitle")}
              </p>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              {pricing.map((p) => {
                const features = t.raw(
                  `pricing.plans.${p.key}.features`,
                ) as string[];
                return (
                  <div
                    key={p.key}
                    className={`relative rounded-2xl border p-8 transition-all ${
                      p.highlight
                        ? "border-[#0dccf2]/40 bg-[#0dccf2]/[0.04] shadow-lg shadow-[#0dccf2]/10"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    {p.highlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#0dccf2] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0a1214]">
                        {t("pricing.popular")}
                      </div>
                    )}
                    <h3 className="text-lg font-semibold">
                      {t(`pricing.plans.${p.key}.name`)}
                    </h3>
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="text-4xl font-bold">
                        {t(`pricing.plans.${p.key}.price`)}
                      </span>
                      {t(`pricing.plans.${p.key}.unit`) && (
                        <span className="text-sm text-slate-500">
                          {t(`pricing.plans.${p.key}.unit`)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-[#0dccf2]">
                      {t(`pricing.plans.${p.key}.credits`)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t(`pricing.plans.${p.key}.hint`)}
                    </p>
                    <ul className="mt-6 space-y-2.5">
                      {features.map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-2 text-sm text-slate-300"
                        >
                          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#0dccf2]" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={p.href}
                      className={`mt-8 flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all ${
                        p.highlight
                          ? "bg-[#0dccf2] text-[#0a1214] shadow-md shadow-[#0dccf2]/20 hover:brightness-110"
                          : "border border-white/10 text-white hover:bg-white/5"
                      }`}
                    >
                      {p.cta}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Cases ── */}
        <section id="cases" className="px-6 py-24">
          <div className="mx-auto max-w-[1200px]">
            <div className="text-center">
              <h2 className="text-3xl font-bold lg:text-4xl">
                {t("cases.title")}
              </h2>
              <p className="mt-3 text-base text-slate-400">
                {t("cases.subtitle")}
              </p>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8">
                <Store className="h-8 w-8 text-[#0dccf2]" strokeWidth={1.25} />
                <h3 className="mt-4 text-xl font-semibold">
                  {t("cases.case1.name")}
                </h3>
                <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">
                  {t("cases.case1.meta")}
                </p>
                <p className="mt-4 text-sm leading-relaxed text-slate-300">
                  {t("cases.case1.desc")}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8">
                <PawPrint className="h-8 w-8 text-[#0dccf2]" strokeWidth={1.25} />
                <h3 className="mt-4 text-xl font-semibold">
                  {t("cases.case2.name")}
                </h3>
                <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">
                  {t("cases.case2.meta")}
                </p>
                <p className="mt-4 text-sm leading-relaxed text-slate-300">
                  {t("cases.case2.desc")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="border-t border-white/5 px-6 py-24">
          <div className="mx-auto max-w-[840px]">
            <div className="text-center">
              <h2 className="text-3xl font-bold lg:text-4xl">{t("faq.title")}</h2>
            </div>
            <div className="mt-12 space-y-3">
              {(t.raw("faq.items") as { q: string; a: string }[]).map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl border border-white/10 bg-white/[0.02] p-5 open:border-[#0dccf2]/30"
                >
                  <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-white">
                    {item.q}
                    <ArrowRight className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-4 text-sm leading-relaxed text-slate-400">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="relative overflow-hidden px-6 py-24">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0dccf2]/6 blur-[120px]" />
          </div>
          <div className="relative mx-auto flex max-w-[800px] flex-col items-center gap-8 text-center">
            <h2 className="text-3xl font-bold leading-tight lg:text-4xl">
              {t("cta.titleLine1")}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: "linear-gradient(135deg, #0dccf2, #60a5fa)",
                }}
              >
                {t("cta.titleLine2")}
              </span>
            </h2>
            <p className="text-base text-slate-400">{t("cta.subtitle")}</p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0dccf2] px-10 py-4 text-base font-semibold text-[#0a1214] shadow-lg shadow-[#0dccf2]/20 transition-all hover:brightness-110"
            >
              <Zap className="h-5 w-5" />
              {t("cta.button")}
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#0a1214] px-6 py-12">
        <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-[#0dccf2]/20">
                <Sparkles className="h-3 w-3 text-[#0dccf2]" />
              </div>
              <span className="text-sm font-semibold">VidClaw</span>
            </div>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-slate-500">
              {t("footer.tagline")}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("footer.product")}
            </h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/generate" className="text-slate-400 hover:text-white">
                  {t("footer.links.generate")}
                </Link>
              </li>
              <li>
                <Link href="/analyze" className="text-slate-400 hover:text-white">
                  {t("footer.links.analyze")}
                </Link>
              </li>
              <li>
                <Link
                  href={`${localePrefix}/pricing`}
                  className="text-slate-400 hover:text-white"
                >
                  {t("footer.links.pricing")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("footer.resources")}
            </h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/gallery" className="text-slate-400 hover:text-white">
                  {t("footer.links.gallery")}
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-slate-400 hover:text-white">
                  {t("footer.links.blog")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("footer.legal")}
            </h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/terms" className="text-slate-400 hover:text-white">
                  {t("footer.links.terms")}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-slate-400 hover:text-white">
                  {t("footer.links.privacy")}
                </Link>
              </li>
              <li>
                <Link href="/refund" className="text-slate-400 hover:text-white">
                  {t("footer.links.refund")}
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-[1200px] border-t border-white/5 pt-6 text-center text-xs text-slate-600">
          {t("footer.copyright", { year: new Date().getFullYear() })}
        </div>
      </footer>
    </div>
  );
}
