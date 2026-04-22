import type { JSX } from "react";
import * as React from "react";

import { cn } from "@/components/launch-ui/lib/utils";

import LaunchUI from "../logos/launch-ui";
import ReactLogo from "../logos/react";
import ShadcnLogo from "../logos/shadcn-ui";
import TailwindLogo from "../logos/tailwind";
import TypeScriptLogo from "../logos/typescript";
import Glow from "../ui/glow";

interface RadarSmallIllustrationProps {
  className?: string;
  centerLogo?: React.ComponentType<{ className?: string }>;
  radarLogos?: [
    React.ComponentType<{ className?: string }>,
    React.ComponentType<{ className?: string }>,
    React.ComponentType<{ className?: string }>,
    React.ComponentType<{ className?: string }>,
  ];
}

function RadarSmallIllustration({
  className,
  centerLogo: CenterLogo = LaunchUI,
  radarLogos = [ReactLogo, TailwindLogo, TypeScriptLogo, ShadcnLogo],
}: RadarSmallIllustrationProps) {
  const totalCircles = 4;
  const totalSegments = 12;

  const createCircles = (index: number = 0): JSX.Element | null => {
    const opacity = (50 * index) / totalCircles;

    if (index === totalCircles) return null;

    const decrementPerStep = 80 / totalCircles;
    const size = 80 - index * decrementPerStep; // Dynamically calculate size reduction

    return (
      <>
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[100%] border p-4 opacity-40"
          style={{
            borderColor: `color-mix(in oklab, var(--brand) ${opacity + 50}%, transparent)`,
            boxShadow: `inset 0px 0px 128px color-mix(in oklab, var(--brand-foreground) ${opacity + 30}%, transparent)`,
            width: `${20 + size}%`,
            height: `${20 + size}%`,
          }}
        ></div>
        {createCircles(index + 1)}
      </>
    );
  };

  const createSegments = (index: number = 0): JSX.Element | null => {
    if (index === totalSegments) return null;

    return (
      <>
        <div
          className="bg-brand-foreground/10 absolute top-1/2 left-0 h-[1px] w-full"
          style={{
            transform: `rotate(${index * (360 / totalSegments)}deg)`,
          }}
        ></div>
        {createSegments(index + 1)}
      </>
    );
  };

  return (
    <div
      data-slot="radar-small-illustration"
      className={cn(
        "relative mb-8 flex h-full w-full items-end sm:mb-0",
        className,
      )}
    >
      <div className="relative flex aspect-1/1 h-full w-full items-end">
        <div className="relative aspect-1/1 h-full w-full p-6">
          {createSegments()}
          <div className="dark:border-background relative h-full w-full rounded-full">
            {createCircles()}
            <div
              className="group-hover:animate-spin-slow absolute inset-[0] h-full w-full rounded-full opacity-0 group-hover:opacity-40"
              style={{
                background:
                  "conic-gradient(transparent, transparent, transparent, transparent, var(--brand-foreground))",
              }}
            ></div>
          </div>
        </div>
        <div className="bg-brand absolute top-[20%] right-[20%] size-7 rounded-full opacity-40 shadow-[0_0_12px_4px_var(--brand-foreground)] group-hover:animate-ping group-hover:opacity-100 dark:opacity-50" />
        <div className="absolute top-[20%] right-[20%] flex size-7 items-center justify-center rounded-full bg-white/90 dark:bg-white/10">
          {React.createElement(radarLogos[0], {
            className: "text-light size-4 opacity-80",
          })}
        </div>
        <div className="bg-brand absolute top-[20%] left-[20%] size-7 rounded-full opacity-40 shadow-[0_0_12px_4px_var(--brand-foreground)] group-hover:animate-ping group-hover:opacity-100 dark:opacity-50" />
        <div className="absolute top-[20%] left-[20%] flex size-7 items-center justify-center rounded-full bg-white/90 dark:bg-white/10">
          {React.createElement(radarLogos[1], {
            className: "text-light size-4 opacity-80",
          })}
        </div>
        <div className="bg-brand absolute bottom-[20%] left-[30%] size-7 rounded-full opacity-40 shadow-[0_0_12px_4px_var(--brand-foreground)] group-hover:animate-ping group-hover:opacity-100 dark:opacity-50" />
        <div className="absolute bottom-[20%] left-[30%] flex size-7 items-center justify-center rounded-full bg-white/90 dark:bg-white/10">
          {React.createElement(radarLogos[2], {
            className: "text-light size-4 opacity-80",
          })}
        </div>
        <div className="bg-brand absolute right-[25%] bottom-[40%] size-7 rounded-full opacity-40 shadow-[0_0_12px_4px_var(--brand-foreground)] group-hover:animate-ping group-hover:opacity-100 dark:opacity-50" />
        <div className="absolute right-[25%] bottom-[40%] flex size-7 items-center justify-center rounded-full bg-white/90 dark:bg-white/10">
          {React.createElement(radarLogos[3], {
            className: "text-light size-4 opacity-80",
          })}
        </div>
        <Glow
          variant="center"
          className="opacity-20 transition-all duration-300 group-hover:opacity-30"
        />
      </div>
      <div className="glass-5 border-brand/30 dark:border-brand/20 absolute top-1/2 left-1/2 flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full p-2.5 shadow-md backdrop-blur-md">
        <CenterLogo className="text-light size-10" />
      </div>
    </div>
  );
}

export default RadarSmallIllustration;
