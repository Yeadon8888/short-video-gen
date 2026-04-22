"use client";

import { useState } from "react";

import Glow from "../ui/glow";
import Gauge from "../ui/gauge";

const scores = [
  { score: 95, scoreOnHover: 85, label: "Performance" },
  { score: 85, scoreOnHover: 99, label: "Accessibility" },
  { score: 90, scoreOnHover: 95, label: "Practices" },
];

export default function ScoresIllustration() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative flex h-full w-full items-center justify-center px-4"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start justify-center gap-8">
        {scores.map(({ score, scoreOnHover, label }) => (
          <div key={label} className="flex flex-col items-center gap-4">
            <Gauge
              score={score}
              scoreOnHover={scoreOnHover}
              isExternallyHovered={isHovered}
            />
            <span className="text-muted-foreground text-center text-sm font-medium">
              {label}
            </span>
          </div>
        ))}
      </div>
      <Glow
        variant="center"
        className="pointer-events-none scale-x-[1.5] opacity-20 transition-all duration-300 group-hover:opacity-30"
      />
    </div>
  );
}
