"use client";

import { useEffect, useState } from "react";
import { useGenerateStore, type GenerateParams } from "@/stores/generate";

interface ModelOption {
  slug: string;
  name: string;
  provider: string;
  creditsPerGen: number;
  allowedDurations: Array<8 | 10 | 15>;
  defaultDuration: 8 | 10 | 15;
}

const FALLBACK_MODELS: ModelOption[] = [
  {
    slug: "veo3.1-fast",
    name: "VEO 3.1 Fast",
    provider: "plato",
    creditsPerGen: 10,
    allowedDurations: [8],
    defaultDuration: 8,
  },
  {
    slug: "veo3.1-components",
    name: "VEO 3.1 Components",
    provider: "plato",
    creditsPerGen: 10,
    allowedDurations: [8],
    defaultDuration: 8,
  },
  {
    slug: "veo3.1-pro-4k",
    name: "VEO 3.1 Pro 4K",
    provider: "plato",
    creditsPerGen: 20,
    allowedDurations: [8],
    defaultDuration: 8,
  },
  {
    slug: "sora",
    name: "Sora",
    provider: "plato",
    creditsPerGen: 15,
    allowedDurations: [10, 15],
    defaultDuration: 10,
  },
];

const selectClass =
  "rounded-full bg-[var(--vc-bg-root)] border border-[var(--vc-border)] px-3 py-2 text-xs text-white outline-none cursor-pointer transition-all duration-150 hover:border-[var(--vc-accent)]/50 focus:border-[var(--vc-accent)] sm:text-sm sm:px-4";

export function ParamBar() {
  const params = useGenerateStore((s) => s.params);
  const setParams = useGenerateStore((s) => s.setParams);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>(FALLBACK_MODELS);

  useEffect(() => {
    fetch("/api/generate/models")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.models?.length) setModelOptions(data.models);
      })
      .catch(() => {});
  }, []);

  const currentModel =
    modelOptions.find((m) => m.slug === params.model) ?? modelOptions[0];
  const allowedDurations = currentModel?.allowedDurations ?? [8, 10, 15];

  useEffect(() => {
    if (!currentModel) return;

    if (!modelOptions.some((m) => m.slug === params.model)) {
      setParams({
        model: currentModel.slug,
        duration: currentModel.defaultDuration,
      });
      return;
    }

    if (!allowedDurations.includes(params.duration)) {
      setParams({ duration: currentModel.defaultDuration });
    }
  }, [allowedDurations, currentModel, modelOptions, params.duration, params.model, setParams]);

  const totalCredits = (currentModel?.creditsPerGen ?? 10) * params.count;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="hidden text-xs uppercase tracking-widest text-[var(--vc-text-dim)] sm:inline">
        参数
      </span>

      <select
        value={params.orientation}
        onChange={(e) =>
          setParams({ orientation: e.target.value as GenerateParams["orientation"] })
        }
        className={selectClass}
      >
        <option value="portrait">竖屏 9:16</option>
        <option value="landscape">横屏 16:9</option>
      </select>

      {allowedDurations.length === 1 ? (
        <span className={`${selectClass} opacity-60 cursor-default`}>
          {allowedDurations[0]} 秒
        </span>
      ) : (
        <select
          value={params.duration}
          onChange={(e) => setParams({ duration: Number(e.target.value) as 8 | 10 | 15 })}
          className={selectClass}
        >
          {allowedDurations.map((duration) => (
            <option key={duration} value={duration}>
              {duration} 秒
            </option>
          ))}
        </select>
      )}

      <select
        value={params.count}
        onChange={(e) => setParams({ count: Number(e.target.value) })}
        className={selectClass}
      >
        {[1, 2, 3, 5, 10].map((n) => (
          <option key={n} value={n}>
            ×{n}
          </option>
        ))}
      </select>

      <select
        value={params.platform}
        onChange={(e) =>
          setParams({ platform: e.target.value as GenerateParams["platform"] })
        }
        className={selectClass}
      >
        <option value="douyin">抖音</option>
        <option value="tiktok">TikTok</option>
      </select>

      <select
        value={params.model}
        onChange={(e) => setParams({ model: e.target.value })}
        className={selectClass}
      >
        {modelOptions.map((m) => (
          <option key={m.slug} value={m.slug}>
            {m.name} ({m.creditsPerGen} 积分)
          </option>
        ))}
      </select>

      <span className="text-xs tabular-nums text-[var(--vc-accent)]">
        消耗 {totalCredits} 积分
      </span>
    </div>
  );
}
