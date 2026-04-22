import Glow from "@/components/launch-ui/ui/glow";
import { cn } from "@/components/launch-ui/lib/utils";
export interface ChartDataPoint {
  desktop: number;
  mobile: number;
}

export const requestsChartData: ChartDataPoint[] = [
  { desktop: 70, mobile: 30 },
  { desktop: 77, mobile: 28 },
  { desktop: 74, mobile: 36 },
  { desktop: 82, mobile: 29 },
  { desktop: 80, mobile: 41 },
  { desktop: 87, mobile: 33 },
  { desktop: 85, mobile: 39 },
  { desktop: 90, mobile: 44 },
  { desktop: 93, mobile: 49 },
  { desktop: 97, mobile: 51 },
  { desktop: 68, mobile: 32 },
  { desktop: 75, mobile: 35 },
  { desktop: 79, mobile: 38 },
  { desktop: 84, mobile: 40 },
  { desktop: 88, mobile: 42 },
  { desktop: 91, mobile: 45 },
  { desktop: 86, mobile: 43 },
  { desktop: 83, mobile: 37 },
  { desktop: 78, mobile: 34 },
  { desktop: 81, mobile: 39 },
  { desktop: 76, mobile: 31 },
  { desktop: 89, mobile: 46 },
  { desktop: 94, mobile: 48 },
  { desktop: 92, mobile: 47 },
  { desktop: 87, mobile: 41 },
  { desktop: 73, mobile: 33 },
  { desktop: 85, mobile: 44 },
  { desktop: 95, mobile: 50 },
  { desktop: 98, mobile: 52 },
  { desktop: 96, mobile: 49 },
];

export default function BarChartIllustration({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn("relative flex aspect-square w-full gap-1", className)}>
      {requestsChartData.map((item, index) => (
        <div key={index} className="flex flex-1 flex-col items-end justify-end">
          <div
            className="glass-4 rounded-t-x w-full"
            style={{ height: `${item.desktop / 3}%` }}
          />
          <div
            className="from-brand-foreground/20 border-brand-foreground/30 border-t-brand-foreground/70 w-full border border-b-0 bg-linear-to-b to-transparent"
            style={{ height: `${item.mobile / 3}%` }}
          />
        </div>
      ))}
      <Glow
        variant="center"
        className="pointer-events-none scale-x-[1.5] opacity-20 transition-all duration-300 group-hover:opacity-30"
      />
    </div>
  );
}
