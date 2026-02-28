"use client";

import { useState } from "react";

interface ProcessLogProps {
  logs: string[];
  isLoading?: boolean;
}

export default function ProcessLog({ logs, isLoading }: ProcessLogProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (logs.length === 0 && !isLoading) return null;

  return (
    <div
      className="rounded-xl border overflow-hidden text-xs font-mono"
      style={{ background: "#0A0A0F", borderColor: "#1E1E2E" }}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/5 transition-colors"
        style={{ borderBottom: collapsed ? "none" : "1px solid #1E1E2E" }}
      >
        <span className="text-slate-500">
          {collapsed ? "▶" : "▼"}
        </span>
        <span className="text-slate-400">进度日志</span>
        {isLoading && (
          <span className="ml-auto flex items-center gap-1 text-purple-light">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-purple-light"
              style={{ animation: "blink 1s step-end infinite" }}
            />
            运行中
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="p-4 space-y-1 max-h-48 overflow-y-auto">
          {logs.map((log, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-slate-600 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-slate-300">{log}</span>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2 items-center">
              <span className="text-slate-600 shrink-0">--</span>
              <span className="text-purple-light cursor-blink">█</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
