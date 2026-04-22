import { CheckCircleIcon, GitBranch, RocketIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/components/launch-ui/lib/utils";

import Glow from "../ui/glow";

interface CardData {
  id: string;
  date: string;
  value: string;
  footer: string;
  icon: React.ReactNode;
}

const cardsData: CardData[] = [
  {
    id: "2",
    date: "Sep 15 2025 12:34 PM",
    value: "Changes committed and pushed",
    footer: "Cursor • contact@mikolajdobrucki.com",
    icon: <GitBranch className="size-4 stroke-1" />,
  },
  {
    id: "3",
    date: "Sep 20 2025 2:43 PM",
    value: "Pull Request #2121 merged",
    footer: "Github • contact@mikolajdobrucki.com",
    icon: <CheckCircleIcon className="size-4 stroke-1" />,
  },
  {
    id: "1",
    date: "Aug 23 2025 6:34 PM",
    value: "Deployed to production",
    footer: "Vercel • contact@mikolajdobrucki.com",
    icon: <RocketIcon className="size-4 stroke-1" />,
  },
];

function CardsIllustration() {
  return (
    <div className="relative flex w-full items-center justify-center">
      <div className="flex flex-col">
        {cardsData.map((card, index) => (
          <article
            key={card.id}
            className={cn(
              "group flex w-sm flex-col overflow-hidden",
              "glass-3 rounded-xl border shadow-xl backdrop-blur-sm",
              "origin-center",
              "hover:!bg-raised transition-transform duration-300 first:!mt-0 not-last:hover:-translate-y-7 last:hover:-translate-y-4",
            )}
            style={{
              transform: `scale(${1 - 0.1 * cardsData.length + index * 0.1})`,
              marginTop: `-${72 - 8 * index}px`,
            }}
          >
            <div
              className="flex items-center gap-4 p-5 group-hover:!opacity-100"
              style={{
                opacity: `${1 - 0.2 * cardsData.length + index * 0.15}`,
              }}
            >
              <div className="bg-brand/5 dark:bg-background border-brand/20 dark:border-border/15 text-brand relative flex size-12 items-center justify-center rounded-full border">
                {card.icon}
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-muted-foreground text-xs">
                  {card.date}
                </span>
                <div className="font-sm flex gap-0.5 text-base">
                  {card.value}
                </div>
              </div>
            </div>
            <div className="border-border dark:border-border/15 text-muted-foreground/50 flex items-center gap-4 border-t px-6 py-3 text-xs">
              {card.footer}
            </div>
          </article>
        ))}
      </div>
      <Glow
        variant="center"
        className="pointer-events-none scale-x-[1.5] opacity-20 transition-all duration-300 group-hover:opacity-30"
      />
    </div>
  );
}

export default CardsIllustration;
