import {
  BlocksIcon,
  EclipseIcon,
  FastForwardIcon,
  LanguagesIcon,
  MonitorSmartphoneIcon,
  RocketIcon,
  ScanFaceIcon,
  SquarePenIcon,
} from "lucide-react";
import * as React from "react";

import { cn } from "@/components/launch-ui/lib/utils";

import Glow from "../ui/glow";
import Marquee from "../ui/marquee";

const items = [
  {
    title: "Accessibility first",
    icon: <ScanFaceIcon className="size-4 stroke-1" />,
  },
  {
    title: "Responsive design",
    icon: <MonitorSmartphoneIcon className="size-4 stroke-1" />,
  },
  {
    title: "Light and dark mode",
    icon: <EclipseIcon className="size-4 stroke-1" />,
  },
  {
    title: "Easy to customize",
    icon: <BlocksIcon className="size-4 stroke-1" />,
  },
  {
    title: "Top-level performance",
    icon: <FastForwardIcon className="size-4 stroke-1" />,
  },
  {
    title: "Production ready",
    icon: <RocketIcon className="size-4 stroke-1" />,
  },
  {
    title: "Made for localisation",
    icon: <LanguagesIcon className="size-4 stroke-1" />,
  },
  {
    title: "CMS friendly",
    icon: <SquarePenIcon className="size-4 stroke-1" />,
  },
];

interface CarouselIllustrationProps {
  className?: string;
}

function CarouselIllustration({ className }: CarouselIllustrationProps = {}) {
  const halfLength = Math.ceil(items.length / 2);
  const firstRow = items.slice(0, halfLength);
  const secondRow = items.slice(halfLength);

  return (
    <div
      data-slot="carousel-illustration"
      className={cn(
        "relative flex h-full w-full flex-col items-center justify-center gap-3",
        className,
      )}
    >
      <div className="relative z-10 flex w-full flex-col gap-3">
        <Marquee playOnHover className="[--duration:20s]" repeat={3}>
          {firstRow.map((item, index) => (
            <div
              key={index}
              className="glass-4 ring-background/20 z-10 flex items-center gap-2 rounded-xl p-4 text-xs font-medium shadow-sm ring-4 transition-all duration-300"
            >
              <span className="text-brand bg-brand/5 dark:bg-background/20 border-background/20 rounded-full border p-2">
                {item.icon}
              </span>
              <span className="whitespace-nowrap">{item.title}</span>
            </div>
          ))}
        </Marquee>
        <Marquee playOnHover reverse className="[--duration:20s]" repeat={3}>
          {secondRow.map((item, index) => (
            <div
              key={index}
              className="glass-4 ring-background/20 z-10 flex items-center gap-2 rounded-xl p-4 text-xs font-medium shadow-sm ring-4 transition-all duration-300"
            >
              <span className="text-brand bg-brand/5 dark:bg-background/20 border-background/20 rounded-full border p-2">
                {item.icon}
              </span>
              <span className="whitespace-nowrap">{item.title}</span>
            </div>
          ))}
        </Marquee>
      </div>
      <Glow
        variant="center"
        className="scale-x-[1.5] opacity-20 transition-all duration-300 group-hover:opacity-30"
      />
    </div>
  );
}

export default CarouselIllustration;
