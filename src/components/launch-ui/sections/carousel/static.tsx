import * as React from "react";

import { cn } from "@/components/launch-ui/lib/utils";

import Glow from "../../ui/glow";
import Screenshot from "../../ui/screenshot";
import { Section } from "../../ui/section";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../../ui/carousel";
import {
  Slide,
  SlideContent,
  SlideDescription,
  SlideTitle,
  SlideVisual,
} from "../../ui/slide";
interface SlideProps {
  tagline: string;
  title: string;
  image: React.ReactNode;
}

interface CarouselStaticProps {
  title?: string;
  description?: string;
  slides?: SlideProps[];
  className?: string;
}

export default function CarouselStatic({
  title = "All the components you need",
  description = "Launch UI provides a comprehensive set of components that includes everything you might need to build an effective, modern landing page.",
  slides = [
    {
      tagline: "Hero sections",
      title: "Start with the right impression",
      image: (
        <Screenshot
          srcLight="/placeholder-light.svg"
          srcDark="/placeholder-dark.svg"
          alt="Hero sections"
          width={900}
          height={600}
        />
      ),
    },
    {
      tagline: "Bento grids",
      title: "Showcase your features",
      image: (
        <Screenshot
          srcLight="/placeholder-light.svg"
          srcDark="/placeholder-dark.svg"
          alt="Bento grids"
          width={900}
          height={600}
        />
      ),
    },
    {
      tagline: "Navbars",
      title: "Guide your users like a pro",
      image: (
        <Screenshot
          srcLight="/placeholder-light.svg"
          srcDark="/placeholder-dark.svg"
          alt="Navbars"
          width={900}
          height={600}
        />
      ),
    },
    {
      tagline: "Testimonials",
      title: "Prove your success",
      image: (
        <Screenshot
          srcLight="/placeholder-light.svg"
          srcDark="/placeholder-dark.svg"
          alt="Testimonials"
          width={900}
          height={600}
        />
      ),
    },
    {
      tagline: "Illustrations",
      title: "Showcase your product",
      image: (
        <Screenshot
          srcLight="/placeholder-portrait-light.svg"
          srcDark="/placeholder-portrait-dark.svg"
          alt="Illustrations"
          width={900}
          height={600}
        />
      ),
    },
  ],
  className,
}: CarouselStaticProps) {
  return (
    <Section className={cn("w-full overflow-hidden", className)}>
      <div className="max-w-container mx-auto flex flex-col items-start gap-6 sm:gap-12">
        <div className="flex flex-col items-start gap-4">
          <h2 className="text-center text-3xl font-semibold text-balance sm:text-5xl">
            {title}
          </h2>
          <p className="text-md text-muted-foreground max-w-[720px] font-medium text-balance sm:text-xl">
            {description}
          </p>
        </div>
        <Carousel
          opts={{
            align: "start",
            startIndex: 0,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {slides.map((slide, index) => (
              <CarouselItem
                key={index}
                className="flex basis-4/5 pl-4 sm:basis-2/3 lg:basis-5/12 xl:basis-1/3"
              >
                <Slide className="grow">
                  <SlideVisual className="fade-bottom-lg min-h-[300px] items-end overflow-hidden">
                    <div className="h-full max-h-[300px] w-full origin-top-left scale-200 object-cover transition-transform duration-300 group-hover:scale-[2.1]">
                      {slide.image}
                    </div>
                    <Glow
                      variant="center"
                      className="scale-[2.5] opacity-20 transition-opacity duration-300 group-hover:opacity-30"
                    />
                  </SlideVisual>
                  <SlideContent>
                    <SlideDescription>{slide.tagline}</SlideDescription>
                    <SlideTitle className="text-balance">
                      {slide.title}
                    </SlideTitle>
                  </SlideContent>
                </Slide>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="mt-12 flex justify-start gap-4">
            <CarouselPrevious className="static" />
            <CarouselNext className="static" />
          </div>
        </Carousel>
      </div>
    </Section>
  );
}
