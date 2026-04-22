import { cn } from "@/components/launch-ui/lib/utils";

type MarqueeProps = {
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  playOnHover?: boolean;
  children?: React.ReactNode;
  vertical?: boolean;
  repeat?: number;
  [key: string]: number | boolean | React.ReactNode | undefined;
};

export default function Marquee({
  className,
  reverse,
  pauseOnHover = false,
  playOnHover = false,
  children,
  vertical = false,
  repeat = 4,
  ...props
}: MarqueeProps) {
  return (
    <div
      {...props}
      data-slot="marquee"
      className={cn(
        "group flex [gap:var(--gap)] overflow-hidden p-2 [--duration:40s] [--gap:1rem]",
        {
          "flex-row": !vertical,
          "flex-col": vertical,
        },
        className,
      )}
    >
      {Array(repeat)
        .fill(0)
        .map((_, i) => (
          <div
            key={i}
            data-slot="marquee-item"
            className={cn("flex shrink-0 justify-around [gap:var(--gap)]", {
              "animate-marquee flex-row": !vertical,
              "animate-marquee-vertical flex-col": vertical,
              "group-hover:[animation-play-state:paused]": pauseOnHover,
              "[animation-play-state:paused] group-hover:[animation-play-state:running]":
                playOnHover,
              "[animation-direction:reverse]": reverse,
            })}
          >
            {children}
          </div>
        ))}
    </div>
  );
}
