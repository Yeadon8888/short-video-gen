"use client";

import { useState } from "react";

interface FallbackNoticeProps {
  soraPrompt: string;
  message?: string;
}

export default function FallbackNotice({ soraPrompt, message }: FallbackNoticeProps) {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    await navigator.clipboard.writeText(soraPrompt);
    setCopied(true);
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
          <p className="text-amber-400 font-semibold text-sm">视频生成暂时不可用</p>
          <p className="text-slate-400 text-xs mt-1">
            {message ?? "当前视频 provider 暂时繁忙，你可以先复制脚本，稍后重试。"}
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
        onClick={copyPrompt}
        className="w-full py-3 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2"
        style={{
          background: copied
            ? "#059669"
            : "linear-gradient(135deg, #D97706, #7C3AED)",
        }}
      >
        <span>{copied ? "脚本已复制" : "复制脚本"}</span>
      </button>
    </div>
  );
}
