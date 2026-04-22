import { ReactNode } from "react";

import { Section } from "../../ui/section";
import {
  Card,
  CardContent,
  CardDescription,
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
  title = "Section title",
  description,
  tiles = [
    {
      title: "Card title",
      description: "Card description",
      visual: <></>, // Empty placeholder for illustration
      size: "col-span-12",
    },
    // Add more default tiles here if needed
  ],
  className,
}: BentoGridProps) {
  return (
    <Section className={className}>
      <div className="max-w-container mx-auto flex flex-col items-center gap-6 sm:gap-12">
        <h2 className="text-3xl font-semibold sm:text-5xl">{title}</h2>
        {description && (
          <p className="text-md text-muted-foreground max-w-[720px] text-center font-medium text-balance sm:text-xl">
            {description}
          </p>
        )}
        {tiles !== false && tiles.length > 0 && (
          <div className="grid grid-cols-12 gap-4">
            {tiles.map((tile, index) => (
              <Card key={index} className={tile.size}>
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
