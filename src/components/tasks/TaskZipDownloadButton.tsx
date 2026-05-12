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

export function TaskZipDownloadButton({
  taskId,
  disabled,
}: {
  taskId: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  async function handleClick() {
    if (loading || disabled) return;

    setLoading(true);
    setProgress(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}/downloads`, { cache: "no-store" });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? `请求失败: HTTP ${response.status}`);
      }

      const data = (await response.json()) as DirectDownloadResponse;
      if (data.mode !== "direct" || data.items.length === 0) {
        throw new Error("没有可下载的视频。");
      }
      const filename = data.filename ?? `task-${taskId.slice(0, 8)}`;
      try {
        await downloadItemsAsZip({
          items: data.items,
          filename,
          onProgress: (done, total) => setProgress(`${done}/${total}`),
        });
      } catch (error) {
        if (!(error instanceof ClientZipFetchError)) throw error;
        setProgress("服务端");
        window.location.href = `/api/tasks/${taskId}/downloads?mode=zip`;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      window.alert(message);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className="inline-flex items-center rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] px-3 py-1 text-xs text-[var(--vc-text-secondary)] transition-colors hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download className="mr-1 h-3 w-3" />
      {loading ? `打包中${progress ? ` ${progress}` : "..."}` : "下载 ZIP"}
    </button>
  );
}
