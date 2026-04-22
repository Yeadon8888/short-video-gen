import { useEffect, useRef, useState } from "react";

import { cn } from "@/components/launch-ui/lib/utils";

interface GaugeProps {
  score: number;
  scoreOnHover?: number;
  isExternallyHovered?: boolean;
  size?: "small" | "large";
}

const getColorClasses = (score: number) => ({
  stroke:
    score < 90
      ? "stroke-foreground/50"
      : score < 95
        ? "stroke-brand"
        : "stroke-brand-foreground",
  text:
    score < 90
      ? "text-foreground/50"
      : score < 95
        ? "text-brand"
        : "text-brand-foreground",
  bg:
    score < 90
      ? "from-border/20"
      : score < 95
        ? "from-brand/30"
        : "from-brand-foreground/30",
});

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export default function Gauge({
  score,
  scoreOnHover,
  isExternallyHovered = false,
  size = "small",
}: GaugeProps) {
  const [displayScore, setDisplayScore] = useState(score);
  const [isHovered, setIsHovered] = useState(false);
  const animationRef = useRef<number | null>(null);
  const prevTargetRef = useRef(score);

  useEffect(() => {
    const targetScore =
      (isHovered || isExternallyHovered) && scoreOnHover !== undefined
        ? scoreOnHover
        : score;

    if (prevTargetRef.current === targetScore) return;

    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    const startScore = prevTargetRef.current;
    const difference = targetScore - startScore;
    const startTime = Date.now();

    const animate = () => {
      const progress = Math.min((Date.now() - startTime) / 800, 1);
      const newScore = Math.round(
        startScore + difference * easeOutCubic(progress),
      );

      setDisplayScore(newScore);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        prevTargetRef.current = targetScore;
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isHovered, isExternallyHovered, score, scoreOnHover]);

  const { stroke, text, bg } = getColorClasses(displayScore);
  const radius = size === "small" ? 24 : 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayScore / 100) * circumference;
  const svgSize = size === "small" ? 64 : 128;
  const center = svgSize / 2;
  const strokeWidth = size === "small" ? 3 : 8;

  return (
    <div className="relative flex flex-col items-center">
      <div
        className="glass-5 dark:border-brand/20 outline-border/30 dark:outline-background/30 relative z-2 rounded-full p-1 outline-4 transition-transform duration-200 hover:scale-105"
        onMouseEnter={() => scoreOnHover !== undefined && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          className="-rotate-90"
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            className="stroke-border/15"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            className={cn(stroke, "transition-all duration-1000 ease-out")}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-full bg-radial to-transparent to-70%",
            bg,
          )}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              size === "small" ? "text-lg" : "text-2xl",
              "font-medium",
              text,
            )}
          >
            {displayScore}
          </span>
        </div>
      </div>
      <div className="via-foreground/10 dark:via-brand-foreground/15 absolute -top-[500%] left-1/2 h-[1000%] w-[1px] -translate-x-1/2 bg-linear-to-b from-transparent from-20% to-transparent to-90%" />
    </div>
  );
}
