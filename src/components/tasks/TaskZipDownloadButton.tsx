"use client";

import { useState } from "react";
import { Download } from "lucide-react";

function triggerDownload(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function TaskZipDownloadButton({
  taskId,
  disabled,
}: {
  taskId: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading || disabled) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}/downloads`, { cache: "no-store" });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? `请求失败: HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `task-${taskId.slice(0, 8)}.zip`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      window.alert(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className="inline-flex items-center rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] px-3 py-1 text-xs text-[var(--vc-text-secondary)] transition-colors hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download className="mr-1 h-3 w-3" />
      {loading ? "打包中..." : "下载 ZIP"}
    </button>
  );
}
