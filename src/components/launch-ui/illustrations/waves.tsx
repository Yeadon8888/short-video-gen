import * as React from "react";

import { Beam } from "@/components/launch-ui/ui/beam";
import LaunchUI from "@/components/launch-ui/logos/launch-ui";

import Glow from "../ui/glow";

interface WaveElement {
  height: string;
  delay: string;
  size: number;
}

interface WavesIllustrationProps {
  centerLogo?: React.ComponentType<{ className?: string }>;
}

const waves: WaveElement[] = [
  {
    height: "10%",
    delay: "-300ms",
    size: 3,
  },
  {
    height: "19%",
    delay: "650ms",
    size: 3,
  },
  {
    height: "28%",
    delay: "1600ms",
    size: 3,
  },
  {
    height: "35%",
    delay: "350ms",
    size: 3,
  },
  {
    height: "42%",
    delay: "-900ms",
    size: 3,
  },
  {
    height: "31.5%",
    delay: "850ms",
    size: 3,
  },
  {
    height: "21%",
    delay: "2200ms",
    size: 3,
  },
  {
    height: "34.5%",
    delay: "850ms",
    size: 3,
  },
  {
    height: "48%",
    delay: "-500ms",
    size: 3,
  },
  {
    height: "36%",
    delay: "-800ms",
    size: 3,
  },
  {
    height: "24%",
    delay: "-1100ms",
    size: 3,
  },
  {
    height: "33.5%",
    delay: "-750ms",
    size: 3,
  },
  {
    height: "43%",
    delay: "-400ms",
    size: 3,
  },
  {
    height: "31.5%",
    delay: "-1350ms",
    size: 3,
  },
  {
    height: "20%",
    delay: "-2300ms",
    size: 3,
  },
  {
    height: "15%",
    delay: "-1400ms",
    size: 3,
  },
  {
    height: "10%",
    delay: "-400ms",
    size: 3,
  },
  {
    height: "17.5%",
    delay: "-1500ms",
    size: 3,
  },
  {
    height: "25%",
    delay: "-2600ms",
    size: 3,
  },
  {
    height: "20%",
    delay: "-800ms",
    size: 3,
  },
  {
    height: "15%",
    delay: "-400ms",
    size: 3,
  },
  {
    height: "22.5%",
    delay: "-800ms",
    size: 3,
  },
  {
    height: "30%",
    delay: "-1200ms",
    size: 3,
  },
  {
    height: "25%",
    delay: "-1650ms",
    size: 3,
  },
  {
    height: "20%",
    delay: "-2100ms",
    size: 3,
  },
];

function WavesIllustration({
  centerLogo: CenterLogo = LaunchUI,
}: WavesIllustrationProps = {}) {
  return (
    <div className="group relative flex aspect-square w-full items-center justify-center">
      <div className="via-foreground/10 dark:via-border/30 absolute top-[calc(50%-1px)] left-0 h-0.5 w-full bg-linear-to-r from-transparent to-transparent"></div>

      <div className="glass-4 ring-background/30 absolute top-1/2 left-1/2 z-10 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-md ring-8 backdrop-blur-lg transition-all duration-1000 ease-in-out group-hover:scale-105">
        <Beam tone="brandLight">
          <div className="relative z-10">
            <CenterLogo className="text-light size-8 sm:size-8" />
          </div>
        </Beam>
      </div>

      <div className="flex h-full w-full items-center justify-between px-[12.5%]">
        {waves.map((wave, index) => (
          <div
            key={index}
            className="via-brand/20 group-hover:animate-wave border-brand/10 w-1 rounded-full border bg-linear-to-b from-transparent to-transparent"
            style={{ height: wave.height, animationDelay: wave.delay }}
          />
        ))}
      </div>

      <Glow
        variant="center"
        className="pointer-events-none scale-x-[1.5] opacity-20 transition-all duration-300 group-hover:opacity-30"
      />
    </div>
  );
}

export default WavesIllustration;
