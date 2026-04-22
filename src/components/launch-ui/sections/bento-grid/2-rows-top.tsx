import { ReactNode } from "react";

import { Section } from "../../ui/section";
import BarChartIllustration from "../../illustrations/bar-chart";
import MockupMobileIllustration from "../../illustrations/mockup-mobile";
import NetworkIllustration from "../../illustrations/network";
import TilesIllustration from "../../illustrations/tiles";
import WavesIllustration from "../../illustrations/waves";
import {
  Card,
  CardContent,
  CardDescription,
  CardLink,
  CardTitle,
  CardVisual,
} from "../../ui/card";

interface CardProps {
  title: string;
  description: ReactNode;
  visual: ReactNode;
  size?: string;
}

interface BentoGridProps {
  title?: string;
  description?: string;
  tiles?: CardProps[] | false;
  className?: string;
}

export default function BentoGrid({
  title = "Build a website that is hard to forget.",
  description = "Build a top-notch landing page even if you don't have the time for it. Create an irresistible offer that speaks professionalism and hi-end design.",
  tiles = [
    {
      title: "Made for search engines",
      description: (
        <p className="max-w-[460px]">
          Unlike the bloated no-code solutions, Launch UI is built to be
          perfectly optimized for search engines.
        </p>
      ),
      visual: (
        <div className="relative -mx-8 -mb-12 h-full min-h-[160px] w-full grow items-center self-center">
          <NetworkIllustration className="absolute bottom-0 left-0" />
        </div>
      ),
      size: "col-span-12 md:col-span-5",
    },
    {
      title: "The code is yours",
      description: (
        <>
          <p className="max-w-[320px] lg:max-w-[460px]">
            With Launch UI, the code is yours forever. You can use it as a
            starting point for your own projects and customize it to your needs.
          </p>
          <p>Never bother about subscriptions and lock-ins.</p>
        </>
      ),
      visual: (
        <div className="min-h-[240px] w-full grow items-center self-center p-4 lg:px-12">
          <TilesIllustration />
        </div>
      ),
      size: "col-span-12 md:col-span-7",
    },
    {
      title: "Mobile-first",
      description: (
        <p>
          Optimized to look and feel great on all devices, operating systems,
          and screen sizes.
        </p>
      ),
      visual: (
        <div className="min-h-[300px] w-full py-12">
          <MockupMobileIllustration />
        </div>
      ),
      size: "col-span-12 md:col-span-6 lg:col-span-4",
    },
    {
      title: "Top-level performance",
      description:
        "Lightweight and optimized, your website will will feel snappy and load instantly.",
      visual: (
        <div className="h-full w-full">
          <WavesIllustration />
        </div>
      ),
      size: "col-span-12 md:col-span-6 lg:col-span-4",
    },
    {
      title: "Fits right into your stack",
      description: (
        <p className="max-w-[460px]">
          Integrate your landing page directly in the product while using your
          favorite tools.
        </p>
      ),
      visual: (
        <div className="relative -mb-8 min-h-[240px]">
          <BarChartIllustration className="absolute bottom-0 left-1/2 h-auto min-w-[480px] -translate-x-1/2" />
        </div>
      ),
      size: "col-span-12 md:col-span-6 lg:col-span-4",
    },
  ],
  className,
}: BentoGridProps) {
  return (
    <Section className={className}>
      <div className="max-w-container mx-auto flex flex-col items-center gap-6 sm:gap-12">
        <h2 className="text-center text-3xl font-semibold text-balance sm:text-5xl">
          {title}
        </h2>
        <p className="text-md text-muted-foreground max-w-[840px] text-center font-medium text-balance sm:text-xl">
          {description}
        </p>
        {tiles !== false && tiles.length > 0 && (
          <div className="grid grid-cols-12 gap-4">
            {tiles.map((tile, index) => (
              <Card key={index} className={tile.size}>
                <CardLink />
                <CardContent>
                  <CardTitle>{tile.title}</CardTitle>
                  <CardDescription>{tile.description}</CardDescription>
                </CardContent>
                <CardVisual>{tile.visual}</CardVisual>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
