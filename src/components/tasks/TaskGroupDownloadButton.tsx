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

export function TaskGroupDownloadButton({
  groupId,
  disabled,
}: {
  groupId: string;
  disabled?: boolean;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (disabled || downloading) return;

    setDownloading(true);
    try {
      const res = await fetch(`/api/tasks/groups/${groupId}/downloads`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? `请求失败: HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `task-group-${groupId.slice(0, 8)}.zip`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      window.alert(message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={disabled || downloading}
      className="inline-flex items-center rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] px-3 py-1 text-xs text-[var(--vc-text-secondary)] transition-colors hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download className="mr-1 h-3 w-3" />
      {downloading ? "打包中..." : "下载 ZIP"}
    </button>
  );
}
