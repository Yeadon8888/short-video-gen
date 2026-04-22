import { ReactNode } from "react";

import Logo from "../../ui/logo";
import { Section } from "../../ui/section";
import AxionLabs from "../../logos/axionlabs";
import Driftbase from "../../logos/driftbase";
import Flowrate from "../../logos/flowrate";
import Orbitra from "../../logos/orbitra";
import Quantify from "../../logos/quantify";
import Synthetikai from "../../logos/synthetikai";
import Marquee from "../../ui/marquee";

interface LogosProps {
  title?: string;
  logos?: ReactNode[] | false;
  duration?: string;
  gap?: string;
  pauseOnHover?: boolean;
  showGradients?: boolean;
  className?: string;
}

export default function Logos({
  title = "Trusted by world's leading companies",
  logos = [
    <Logo
      key="axionlabs"
      image={AxionLabs}
      name="AxionLabs"
      width={171}
      height={54}
      showName={false}
    />,
    <Logo
      key="synthetikai"
      image={Synthetikai}
      name="Synthetikai"
      width={185}
      height={54}
      showName={false}
    />,
    <Logo
      key="driftbase"
      image={Driftbase}
      name="Driftbase"
      width={165}
      height={54}
      showName={false}
    />,
    <Logo
      key="flowrate"
      image={Flowrate}
      name="Flowrate"
      width={180}
      height={54}
      showName={false}
    />,
    <Logo
      key="quantify"
      image={Quantify}
      name="Quantify"
      width={185}
      height={54}
      showName={false}
    />,
    <Logo
      key="orbitra"
      image={Orbitra}
      name="Orbitra"
      width={185}
      height={54}
      showName={false}
    />,
  ],
  pauseOnHover = true,
  showGradients = true,
  className,
}: LogosProps) {
  return (
    <Section className={className}>
      <div className="max-w-container mx-auto flex flex-col items-center gap-8 text-center">
        <h2 className="text-md text-muted-foreground font-semibold">{title}</h2>
        <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
          <Marquee
            pauseOnHover={pauseOnHover}
            className={`[--duration:20s] [--gap:3rem]`}
          >
            {logos}
          </Marquee>
          {showGradients && (
            <>
              <div className="from-background pointer-events-none absolute inset-y-0 left-0 hidden w-1/3 bg-linear-to-r sm:block" />
              <div className="from-background pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 bg-linear-to-l sm:block" />
            </>
          )}
        </div>
      </div>
    </Section>
  );
}
