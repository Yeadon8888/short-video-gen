"use client";

import { CountdownTimer } from "../../ui/countdown-timer";

interface SaleBannerProps {
  title?: string;
  subtitle?: string;
  targetDate?: string;
  footer?: React.ReactNode;
}

// Helper function to get default target date (1 day from now)
const getDefaultTargetDate = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);
  return tomorrow.toISOString();
};

export default function SaleBanner({
  title = "Black Friday Sale",
  subtitle = "Get Launch UI Pro for 50% off",
  targetDate = getDefaultTargetDate(),
  footer = <p>Limited time offer. Valid until December 1st, 2025.</p>,
}: SaleBannerProps) {
  // Check if countdown has ended
  const now = new Date().getTime();
  const target = new Date(targetDate).getTime();

  if (target - now <= 0) {
    return null;
  }

  return (
    <div className="from-brand-foreground to-brand dark:from-brand-foreground/30 dark:to-brand-foreground/10 after:bg-brand-foreground/70 relative mx-auto flex w-full max-w-6xl flex-col items-center gap-6 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-b p-8 shadow-xl after:absolute after:-top-[128px] after:left-1/2 after:h-[128px] after:w-[100%] after:max-w-[960px] after:-translate-x-1/2 after:rounded-[50%] after:blur-[72px] sm:gap-8 sm:p-12">
      <hr className="via-brand absolute top-0 left-[10%] h-[1px] w-[80%] border-0 bg-linear-to-r from-transparent to-transparent" />

      <header className="z-10 flex flex-col items-center gap-2 text-center">
        <h3 className="text-foreground text-2xl leading-tight font-bold sm:text-4xl dark:text-shadow-lg">
          {title}
        </h3>
        <p className="text-foreground/80 dark:text-brand/80 text-base font-medium sm:text-lg dark:text-shadow-lg">
          {subtitle}
        </p>
      </header>

      <div className="z-10">
        <CountdownTimer targetDate={targetDate} />
      </div>

      {footer && (
        <div className="text-foreground/50 [&_strong]:text-foreground z-10 text-center text-sm font-medium text-balance">
          {footer}
        </div>
      )}
    </div>
  );
}
