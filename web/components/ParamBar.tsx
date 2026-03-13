"use client";

interface Params {
  orientation: "portrait" | "landscape";
  duration: 10 | 15;
  count: number;
  platform: "douyin" | "tiktok";
  model: string;
}

interface ParamBarProps {
  params: Params;
  onChange: (params: Params) => void;
}

function Select<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => {
        const raw = e.target.value;
        const typed = (typeof value === "number" ? Number(raw) : raw) as T;
        onChange(typed);
      }}
      className="px-3 py-1.5 rounded-lg text-sm text-white outline-none cursor-pointer appearance-none pr-7"
      style={{
        background: "#1E1E2E",
        border: "1px solid #2E2E3E",
      }}
    >
      {options.map((opt) => (
        <option key={String(opt.value)} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export default function ParamBar({ params, onChange }: ParamBarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">生成参数</div>
      <Select
        value={params.orientation}
        options={[
          { value: "portrait", label: "竖屏 9:16" },
          { value: "landscape", label: "横屏 16:9" },
        ]}
        onChange={(v) => onChange({ ...params, orientation: v as "portrait" | "landscape" })}
      />
      <Select
        value={params.duration}
        options={[
          { value: 10, label: "10 秒" },
          { value: 15, label: "15 秒" },
        ]}
        onChange={(v) => onChange({ ...params, duration: v as 10 | 15 })}
      />
      <Select
        value={params.count}
        options={[1, 2, 3, 5, 10].map((n) => ({ value: n, label: `×${n}` }))}
        onChange={(v) => onChange({ ...params, count: v as number })}
      />
      <Select
        value={params.platform}
        options={[
          { value: "douyin", label: "抖音" },
          { value: "tiktok", label: "TikTok" },
        ]}
        onChange={(v) => onChange({ ...params, platform: v as "douyin" | "tiktok" })}
      />
      <Select
        value={params.model}
        options={[
          { value: "veo3.1-fast", label: "VEO 3.1 Fast" },
          { value: "veo3.1", label: "VEO 3.1" },
          { value: "veo3.1-pro", label: "VEO 3.1 Pro" },
          { value: "sora-2", label: "Sora 2" },
        ]}
        onChange={(v) => onChange({ ...params, model: v })}
      />
    </div>
  );
}
