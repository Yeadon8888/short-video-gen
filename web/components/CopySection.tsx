"use client";

import { useState } from "react";

interface CopySectionProps {
  title: string;
  caption: string;
  firstComment: string;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="text-xs px-2 py-1 rounded-lg transition-all shrink-0"
      style={{
        background: copied ? "#059669" + "33" : "#1E1E2E",
        color: copied ? "#34D399" : "#94A3B8",
      }}
    >
      {copied ? "已复制" : label}
    </button>
  );
}

export default function CopySection({ title, caption, firstComment }: CopySectionProps) {
  const [allCopied, setAllCopied] = useState(false);

  async function copyAll() {
    const text = `${title}\n\n${caption}\n\n首评：${firstComment}`;
    await navigator.clipboard.writeText(text);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: "#13131A", borderColor: "#1E1E2E" }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid #1E1E2E" }}
      >
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">文案</p>
        <button
          onClick={copyAll}
          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
          style={{
            background: allCopied
              ? "#059669" + "33"
              : "linear-gradient(135deg, #7C3AED33, #2563EB33)",
            color: allCopied ? "#34D399" : "#A78BFA",
          }}
        >
          {allCopied ? "全部已复制" : "一键全部复制"}
        </button>
      </div>

      <div className="divide-y" style={{ borderColor: "#1E1E2E" }}>
        {[
          { label: "标题", text: title },
          { label: "文案", text: caption },
          { label: "首评", text: firstComment },
        ].map(({ label, text }) => (
          <div key={label} className="p-4">
            <div className="flex items-start gap-3">
              <span className="text-xs text-slate-500 shrink-0 mt-0.5 w-8">{label}</span>
              <p className="flex-1 text-sm text-slate-200 leading-relaxed">{text}</p>
              <CopyButton text={text} label="复制" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
