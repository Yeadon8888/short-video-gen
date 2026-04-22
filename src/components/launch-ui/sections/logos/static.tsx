import { ReactNode } from "react";

import Logo from "../../ui/logo";
import { Section } from "../../ui/section";
import AxionLabs from "../../logos/axionlabs";
import Driftbase from "../../logos/driftbase";
import Flowrate from "../../logos/flowrate";
import Orbitra from "../../logos/orbitra";
import Quantify from "../../logos/quantify";
import Synthetikai from "../../logos/synthetikai";

interface LogosProps {
  title?: string;
  logos?: ReactNode[] | false;
  className?: string;
}

export default function Logos({
  title = "Trusted by world's leading companies",
  logos = [
    <Logo
      key="axionlabs"
      image={AxionLabs}
      name="AxionLabs"
      width={114}
      height={36}
      showName={false}
    />,
    <Logo
      key="synthetikai"
      image={Synthetikai}
      name="Synthetikai"
      width={123}
      height={36}
      showName={false}
    />,
    <Logo
      key="driftbase"
      image={Driftbase}
      name="Driftbase"
      width={110}
      height={36}
      showName={false}
    />,
    <Logo
      key="flowrate"
      image={Flowrate}
      name="Flowrate"
      width={120}
      height={36}
      showName={false}
    />,
    <Logo
      key="quantify"
      image={Quantify}
      name="Quantify"
      width={123}
      height={36}
      showName={false}
    />,
    <Logo
      key="orbitra"
      image={Orbitra}
      name="Orbitra"
      width={123}
      height={36}
      showName={false}
    />,
  ],
  className,
}: LogosProps) {
  return (
    <Section className={className}>
      <div className="max-w-container mx-auto flex flex-col items-center gap-8 text-center">
        <h2 className="text-md text-muted-foreground font-semibold">{title}</h2>
        {logos !== false && logos.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-8">
            {logos}
          </div>
        )}
      </div>
    </Section>
  );
}
