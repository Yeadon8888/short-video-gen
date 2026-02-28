"use client";

import { useState } from "react";

const SORA_URL = "https://sora.yeadon.top";

interface FallbackNoticeProps {
  soraPrompt: string;
  message?: string;
}

export default function FallbackNotice({ soraPrompt, message }: FallbackNoticeProps) {
  const [copied, setCopied] = useState(false);

  async function copyAndOpen() {
    await navigator.clipboard.writeText(soraPrompt);
    setCopied(true);
    window.open(SORA_URL, "_blank", "noopener,noreferrer");
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div
      className="rounded-xl border p-4 space-y-4"
      style={{ background: "#13131A", borderColor: "#D97706" + "44" }}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0">⚠️</span>
        <div>
          <p className="text-amber-400 font-semibold text-sm">Sora 暂时不可用</p>
          <p className="text-slate-400 text-xs mt-1">
            {message ?? "视频生成服务暂时繁忙，请将脚本复制到外部工具使用。"}
          </p>
        </div>
      </div>

      {/* Show prompt */}
      <div
        className="rounded-lg p-3 text-xs font-mono text-slate-400 leading-relaxed max-h-32 overflow-y-auto"
        style={{ background: "#0A0A0F", border: "1px solid #1E1E2E" }}
      >
        {soraPrompt}
      </div>

      <button
        onClick={copyAndOpen}
        className="w-full py-3 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2"
        style={{
          background: copied
            ? "#059669"
            : "linear-gradient(135deg, #D97706, #7C3AED)",
        }}
      >
        <span>{copied ? "已复制，正在跳转..." : "复制脚本并前往 sora.yeadon.top"}</span>
        <span>→</span>
      </button>
    </div>
  );
}
