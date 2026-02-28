"use client";

import type { ScriptResult } from "@/lib/gemini";

const CAMERA_LABELS: Record<string, string> = {
  "close-up": "特写",
  wide: "全景",
  medium: "中景",
  overhead: "俯拍",
};

const CAMERA_COLORS: Record<string, string> = {
  "close-up": "#7C3AED",
  wide: "#2563EB",
  medium: "#059669",
  overhead: "#D97706",
};

interface ScriptOutputProps {
  data: ScriptResult;
}

export default function ScriptOutput({ data }: ScriptOutputProps) {
  return (
    <div className="space-y-4">
      {/* Creative points + hook */}
      <div
        className="rounded-xl p-4 border space-y-3"
        style={{ background: "#13131A", borderColor: "#1E1E2E" }}
      >
        <div>
          <p className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wider">爆点</p>
          <p className="text-white font-semibold">{data.hook}</p>
        </div>
        {data.plot_summary && (
          <div>
            <p className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wider">剧情梗概</p>
            <p className="text-slate-300 text-sm leading-relaxed">{data.plot_summary}</p>
          </div>
        )}
        {data.creative_points?.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wider">创意要点</p>
            <ul className="space-y-1">
              {data.creative_points.map((pt, i) => (
                <li key={i} className="text-sm text-slate-300 flex gap-2">
                  <span className="text-purple-light shrink-0">•</span>
                  {pt}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Shot cards */}
      {data.shots?.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">
            分镜脚本 ({data.shots.length} 个镜头)
          </p>
          <div className="space-y-2">
            {data.shots.map((shot) => (
              <div
                key={shot.id}
                className="rounded-xl p-4 border"
                style={{ background: "#0A0A0F", borderColor: "#1E1E2E" }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: CAMERA_COLORS[shot.camera] ?? "#7C3AED" }}
                  >
                    {shot.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: (CAMERA_COLORS[shot.camera] ?? "#7C3AED") + "33",
                          color: CAMERA_COLORS[shot.camera] ?? "#A78BFA",
                        }}
                      >
                        {CAMERA_LABELS[shot.camera] ?? shot.camera}
                      </span>
                      <span className="text-xs text-slate-500">{shot.duration_s}s</span>
                    </div>
                    <p className="text-white text-sm mb-1">{shot.scene_zh}</p>
                    <p className="text-slate-500 text-xs font-mono leading-relaxed">
                      {shot.sora_prompt}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
