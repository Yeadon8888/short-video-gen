"use client";

import { useState } from "react";

import Glow from "@/components/launch-ui/ui/glow";

export interface ChartDataPoint {
  x: number;
  y: number;
  value: number;
}

export const brandLineData: ChartDataPoint[] = [
  { x: 0, y: 330, value: 23 },
  { x: 56, y: 310, value: 28 },
  { x: 112, y: 290, value: 35 },
  { x: 168, y: 270, value: 42 },
  { x: 224, y: 280, value: 38 },
  { x: 280, y: 250, value: 51 },
  { x: 336, y: 230, value: 63 },
  { x: 392, y: 240, value: 58 },
  { x: 448, y: 210, value: 74 },
  { x: 504, y: 190, value: 89 },
  { x: 560, y: 200, value: 82 },
  { x: 616, y: 170, value: 103 },
  { x: 672, y: 150, value: 121 },
  { x: 728, y: 130, value: 138 },
];

export const grayLineData: ChartDataPoint[] = [
  { x: 0, y: 350, value: 146 },
  { x: 56, y: 345, value: 152 },
  { x: 112, y: 335, value: 163 },
  { x: 168, y: 325, value: 174 },
  { x: 224, y: 320, value: 180 },
  { x: 280, y: 310, value: 191 },
  { x: 336, y: 300, value: 203 },
  { x: 392, y: 295, value: 209 },
  { x: 448, y: 285, value: 221 },
  { x: 504, y: 275, value: 233 },
  { x: 560, y: 270, value: 240 },
  { x: 616, y: 260, value: 252 },
  { x: 672, y: 250, value: 265 },
  { x: 728, y: 240, value: 277 },
];

export const timestamps: string[] = [
  "Oct 1, 2025 9:30 PM",
  "Oct 1, 2025 9:45 PM",
  "Oct 1, 2025 10:00 PM",
  "Oct 1, 2025 10:15 PM",
  "Oct 1, 2025 10:30 PM",
  "Oct 1, 2025 10:45 PM",
  "Oct 1, 2025 11:00 PM",
  "Oct 1, 2025 11:15 PM",
  "Oct 1, 2025 11:30 PM",
  "Oct 1, 2025 11:45 PM",
  "Oct 2, 2025 12:00 AM",
  "Oct 2, 2025 12:15 AM",
  "Oct 2, 2025 12:30 AM",
  "Oct 2, 2025 12:45 AM",
];

export default function LineChartIllustration() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Convert data points to SVG path string
  const createPath = (data: ChartDataPoint[]) => {
    return data
      .map((point, index) => {
        if (index === 0) {
          return `M ${point.x} ${point.y}`;
        }
        return `L ${point.x} ${point.y}`;
      })
      .join(" ");
  };

  // Create area path (line + bottom closure for gradient fill)
  const createAreaPath = (data: ChartDataPoint[], bottom: number) => {
    const linePath = createPath(data);
    const lastPoint = data[data.length - 1];
    const firstPoint = data[0];
    return `${linePath} L ${lastPoint.x} ${bottom} L ${firstPoint.x} ${bottom} Z`;
  };

  const chartTop = 0;
  const chartBottom = 390;

  return (
    <div className="fade-y relative -mx-32 flex items-center justify-center pt-8">
      <svg
        width="728"
        height="390"
        viewBox="0 0 728 390"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-full"
      >
        {/* Gradient definitions */}
        <defs>
          {/* Blue gradient */}
          <linearGradient id="brandGradient" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--brand-foreground)"
              stopOpacity="0.15"
            />
            <stop
              offset="100%"
              stopColor="var(--brand-foreground)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {/* Blue area gradient */}
        <path
          d={createAreaPath(brandLineData, chartBottom)}
          fill="url(#brandGradient)"
        />

        {/* Gray line */}
        <path
          d={createPath(grayLineData)}
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          className="dark:stroke-border/70 stroke-muted-foreground"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Brand line */}
        <path
          d={createPath(brandLineData)}
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          className="stroke-brand-foreground/50"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points for gray line */}
        {grayLineData.map((point, index) => (
          <circle
            key={`gray-point-${index}`}
            cx={point.x}
            cy={point.y}
            r={hoveredIndex === index ? 5 : 3}
            fill="currentColor"
            className={`fill-muted-foreground dark:fill-border pointer-events-none transition-all${
              hoveredIndex === index ? "opacity-100" : "opacity-80"
            }`}
          />
        ))}

        {/* Data points for brand line */}
        {brandLineData.map((point, index) => (
          <circle
            key={`brand-point-${index}`}
            cx={point.x}
            cy={point.y}
            r={hoveredIndex === index ? 5 : 3}
            fill="currentColor"
            className={`fill-brand-foreground pointer-events-none transition-all ${
              hoveredIndex === index ? "opacity-100" : "opacity-80"
            }`}
          />
        ))}

        {/* Vertical lines at each datapoint with hover areas - rendered last to be on top */}
        {brandLineData.map((point, index) => (
          <g key={`vertical-${index}`}>
            {/* Dashed line */}
            <line
              x1={point.x}
              y1={chartTop}
              x2={point.x}
              y2={chartBottom}
              stroke="currentColor"
              className={`pointer-events-none transition-all ${
                hoveredIndex === index
                  ? "stroke-muted-foreground/20"
                  : "stroke-border/10"
              }`}
            />
            {/* Wider invisible hover area */}
            <rect
              x={point.x - 20}
              y={chartTop}
              width="40"
              height={chartBottom}
              fill="transparent"
              className={`cursor-pointer transition-all ${
                hoveredIndex === index ? "fill-border/5" : "fill-transparent"
              }`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      {hoveredIndex !== null && (
        <div
          className="bg-popover border-border/15 text-foreground absolute z-10 rounded-xl border px-4 py-3 shadow-xl"
          style={{
            left: `${(brandLineData[hoveredIndex].x / 728) * 100}%`,
            top: "30%",
            transform: "translateX(-50%)",
            pointerEvents: "none",
          }}
        >
          <div className="mb-2 text-xs font-semibold">
            {timestamps[hoveredIndex]}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs">
              <div className="bg-border size-2 rounded-full"></div>
              <span className="text-muted-foreground text-nowrap">Before:</span>
              <span className="font-medium text-nowrap">
                {brandLineData[hoveredIndex].value}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="bg-brand size-2 rounded-full"></div>
              <span className="text-brand text-nowrap">After:</span>
              <span className="font-medium text-nowrap">
                {grayLineData[hoveredIndex].value}
              </span>
            </div>
          </div>
        </div>
      )}
      <Glow
        variant="center"
        className="pointer-events-none scale-x-[1.5] opacity-10 transition-all duration-300 group-hover:opacity-15"
      />
    </div>
  );
}
