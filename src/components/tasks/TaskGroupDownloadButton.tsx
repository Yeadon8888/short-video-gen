"use client";

import { useState } from "react";
import { Download } from "lucide-react";

function triggerBrowserDownload(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.download = "";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
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
      const res = await fetch(`/api/tasks/groups/${groupId}/downloads`);
      const data = (await res.json().catch(() => null)) as
        | { urls?: string[]; error?: string }
        | null;

      if (!res.ok) {
        throw new Error(data?.error ?? `请求失败: HTTP ${res.status}`);
      }

      const urls = data?.urls ?? [];
      if (urls.length === 0) {
        throw new Error("这个任务组里还没有可下载的视频。");
      }

      urls.forEach((url, index) => {
        window.setTimeout(() => triggerBrowserDownload(url), index * 180);
      });
    } catch (error) {
      window.alert(String(error));
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
      {downloading ? "下载中..." : "批量下载"}
    </button>
  );
}
