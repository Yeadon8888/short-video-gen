import { ReactNode } from "react";

import Logo from "../../ui/logo";
import { Section } from "../../ui/section";
import AxionLabs from "../../logos/axionlabs";
import Driftbase from "../../logos/driftbase";
import Flowrate from "../../logos/flowrate";
import Orbitra from "../../logos/orbitra";
import Quantify from "../../logos/quantify";
import Synthetikai from "../../logos/synthetikai";

interface LogoItemProps {
  logo: ReactNode;
}

interface LogosProps {
  title?: string;
  logoItems?: LogoItemProps[];
  showFiller?: boolean;
  className?: string;
}

export default function Logos({
  title = "Trusted by world's leading companies",
  logoItems = [
    {
      logo: (
        <Logo
          image={AxionLabs}
          name="AxionLabs"
          width={171}
          height={54}
          showName={false}
        />
      ),
    },
    {
      logo: (
        <Logo
          image={Synthetikai}
          name="Synthetikai"
          width={185}
          height={54}
          showName={false}
        />
      ),
    },
    {
      logo: (
        <Logo
          image={Driftbase}
          name="Driftbase"
          width={165}
          height={54}
          showName={false}
        />
      ),
    },
    {
      logo: (
        <Logo
          image={Flowrate}
          name="Flowrate"
          width={180}
          height={54}
          showName={false}
        />
      ),
    },
    {
      logo: (
        <Logo
          image={Quantify}
          name="Quantify"
          width={185}
          height={54}
          showName={false}
        />
      ),
    },
    {
      logo: (
        <Logo
          image={Orbitra}
          name="Orbitra"
          width={185}
          height={54}
          showName={false}
        />
      ),
    },
    {
      logo: (
        <Logo
          image={AxionLabs}
          name="AxionLabs"
          width={171}
          height={54}
          showName={false}
        />
      ),
    },
    {
      logo: (
        <Logo
          image={Synthetikai}
          name="Synthetikai"
          width={185}
          height={54}
          showName={false}
        />
      ),
    },
  ],
  showFiller = true,
  className,
}: LogosProps) {
  return (
    <Section className={className}>
      <div className="max-w-container mx-auto flex flex-col items-center gap-8 text-center">
        <h2 className="text-md text-muted-foreground font-semibold">{title}</h2>
        <div className="bg-border dark:bg-border/20 relative grid w-full auto-rows-fr grid-cols-2 gap-[1px] text-center md:grid-cols-3 lg:grid-cols-4">
          {logoItems.map((item, index) => (
            <div
              key={index}
              className="bg-background flex aspect-2/1 items-center justify-center p-6"
            >
              {item.logo}
            </div>
          ))}
          {showFiller && (
            <div className="bg-background hidden aspect-2/1 md:flex lg:hidden" />
          )}
        </div>
      </div>
    </Section>
  );
}
