"use client";

import type { GenerateTab, GenerateTabConfig } from "@/components/generate/generate-config";

export function GenerateTabs({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: GenerateTabConfig[];
  activeTab: GenerateTab;
  onChange: (tab: GenerateTab) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`rounded-2xl border px-4 py-4 text-left transition ${
            activeTab === tab.id
              ? "border-[var(--vc-accent)] bg-[var(--vc-accent)]/10"
              : "border-[var(--vc-border)] bg-[var(--vc-bg-root)]/60"
          }`}
        >
          <p className="text-sm font-semibold text-white">{tab.title}</p>
          <p className="mt-1 text-xs text-[var(--vc-text-muted)]">{tab.description}</p>
        </button>
      ))}
    </div>
  );
}
