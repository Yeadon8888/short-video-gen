"use client";

import type { GenerateTabConfig } from "@/components/generate/generate-config";

export function GenerateIdleCards({ tabs }: { tabs: GenerateTabConfig[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className="rounded-2xl border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-5"
        >
          <p className="text-sm font-semibold text-white">{tab.title}</p>
          <p className="mt-2 text-sm text-[var(--vc-text-muted)]">{tab.description}</p>
        </div>
      ))}
    </div>
  );
}
