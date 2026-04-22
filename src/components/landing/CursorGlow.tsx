"use client";

import { useEffect, useRef } from "react";

type Props = {
  color?: string;
  size?: number;
  opacity?: number;
};

export function CursorGlow({
  color = "13, 204, 242",
  size = 600,
  opacity = 0.12,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Skip on touch-only devices — no cursor to follow, listeners
    // just waste cycles and the visual effect doesn't read right.
    if (window.matchMedia("(hover: none)").matches) return;

    let raf = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 3;
    let tx = x;
    let ty = y;

    function onMove(e: MouseEvent) {
      tx = e.clientX;
      ty = e.clientY;
    }

    function tick() {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      if (el) {
        el.style.setProperty("--cx", `${x}px`);
        el.style.setProperty("--cy", `${y}px`);
      }
      raf = requestAnimationFrame(tick);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background: `radial-gradient(${size}px circle at var(--cx) var(--cy), rgba(${color}, ${opacity}), transparent 70%)`,
      }}
    />
  );
}
