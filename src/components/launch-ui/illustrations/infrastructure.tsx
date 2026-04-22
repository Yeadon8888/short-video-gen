import * as React from "react";

import LaunchUILogo from "@/components/launch-ui/logos/launch-ui";
import { cn } from "@/components/launch-ui/lib/utils";

import Glow from "../ui/glow";

interface InfrastructureIllustrationProps {
  centerLogo?: React.ComponentType<{ className?: string }>;
  className?: string;
}

function InfrastructureIllustration({
  centerLogo: CenterLogo = LaunchUILogo,
  className,
}: InfrastructureIllustrationProps = {}) {
  return (
    <div
      data-slot="infrastructure-illustration"
      className={cn("h-full w-full max-w-[640px]", className)}
    >
      <div className="relative h-full w-full">
        <div className="absolute -bottom-8 left-[50%] z-10 w-full -translate-x-[50%] translate-y-0">
          <div className="border-border dark:border-border/10 relative flex h-auto min-w-[460px] flex-col overflow-hidden rounded-3xl border">
            {/* Bento Grid Content */}
            <div className="relative w-full grow p-4">
              <div className="grid h-full grid-cols-3 grid-rows-3 gap-3">
                {/* Top Left - API Status */}
                <div className="glass-3 flex flex-col justify-between gap-4 rounded-xl p-5">
                  <div className="flex items-center gap-2">
                    <div className="bg-brand ring-brand/20 size-2 animate-pulse rounded-full border border-white/20 ring-4"></div>
                    <span className="text-muted-foreground font-mono text-[10px] font-medium tracking-wider uppercase">
                      ai-powered stack
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[...Array(8)].map((_, i) => (
                      <div
                        key={i}
                        className="border-border/50 bg-foreground/5 size-3.5 rounded-sm border"
                        style={{
                          opacity: Math.random() * 0.7 + 0.2,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Top Center - Workspace Counter */}
                <div className="glass-4 relative flex h-full w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-lg p-3">
                  <div className="from-foreground/20 dark:from-foreground to-foreground/60 dark:to-muted-foreground/20 bg-linear-to-br bg-clip-text font-mono text-2xl text-transparent">
                    21,000
                  </div>
                  <div className="text-muted-foreground text-[9px] tracking-wider uppercase">
                    active users
                  </div>
                  <Glow variant="below" className="" />
                </div>

                {/* Top Right - Compliance */}
                <div className="bg-background/20 border-border dark:border-border/10 row-span-2 rounded-xl border border-dashed p-2">
                  <div className="glass-2 row-span-2 grid h-full grid-rows-8 rounded-lg shadow-xl">
                    {[...Array(8)].map((_, i) => (
                      <div
                        className="border-border/10 flex items-center justify-start px-2 not-last:border-b"
                        key={i}
                      >
                        <div className="bg-foreground/5 border-border/10 size-2 rounded-sm border"></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Middle Left - Linear Engine */}
                <div className="border-border dark:border-border/20 relative row-span-2 flex flex-col justify-between overflow-hidden rounded-lg border border-dashed p-4"></div>

                {/* Center - Logo */}
                <div className="glass-5 relative row-span-2 flex aspect-square h-full w-full items-center justify-center overflow-hidden rounded-lg">
                  <CenterLogo className="text-muted-foreground/20 dark:text-background/80 size-full max-h-20 max-w-20 drop-shadow-xs drop-shadow-white/20" />
                </div>

                {/* Bottom Left - SOC 2 Compliance */}
                <div className="glass-3 overflow-hidden rounded-lg p-3"></div>
              </div>
            </div>
          </div>
        </div>
        <Glow
          variant="bottom"
          className="translate-y-32 scale-250 opacity-40 transition-all duration-1000 group-hover:scale-300 group-hover:opacity-60"
        />
      </div>
    </div>
  );
}

export default InfrastructureIllustration;
