"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import {
  ClientZipFetchError,
  downloadItemsAsZip,
} from "@/components/tasks/client-zip-download";

interface DirectDownloadResponse {
  mode: "direct";
  filename?: string;
  items: Array<{ url: string; filename: string }>;
}

export function TaskGroupDownloadButton({
  groupId,
  disabled,
}: {
  groupId: string;
  disabled?: boolean;
}) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  async function handleDownload() {
    if (disabled || downloading) return;

    setDownloading(true);
    setProgress(null);
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

      const data = (await res.json()) as DirectDownloadResponse;
      if (data.mode !== "direct" || data.items.length === 0) {
        throw new Error("没有可下载的视频。");
      }
      const filename = data.filename ?? `task-group-${groupId.slice(0, 8)}`;
      try {
        await downloadItemsAsZip({
          items: data.items,
          filename,
          onProgress: (done, total) => setProgress(`${done}/${total}`),
        });
      } catch (error) {
        if (!(error instanceof ClientZipFetchError)) throw error;
        setProgress("服务端");
        window.location.href = `/api/tasks/groups/${groupId}/downloads?mode=zip`;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      window.alert(message);
    } finally {
      setDownloading(false);
      setProgress(null);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={disabled || downloading}
      className="inline-flex items-center rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] px-3 py-1 text-xs text-[var(--vc-text-secondary)] transition-colors hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download className="mr-1 h-3 w-3" />
      {downloading ? `打包中${progress ? ` ${progress}` : "..."}` : "下载 ZIP"}
    </button>
  );
}
