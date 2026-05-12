"use client";

import JSZip from "jszip";

export interface DirectDownloadItem {
  url: string;
  filename: string;
}

export class ClientZipFetchError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ClientZipFetchError";
  }
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function uniqueFilename(filename: string, used: Set<string>) {
  if (!used.has(filename)) {
    used.add(filename);
    return filename;
  }

  const dotIndex = filename.lastIndexOf(".");
  const stem = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  const ext = dotIndex > 0 ? filename.slice(dotIndex) : "";
  let index = 2;
  while (used.has(`${stem}-${index}${ext}`)) index += 1;
  const next = `${stem}-${index}${ext}`;
  used.add(next);
  return next;
}

export async function downloadItemsAsZip(params: {
  items: DirectDownloadItem[];
  filename: string;
  onProgress?: (done: number, total: number) => void;
}) {
  const zip = new JSZip();
  const used = new Set<string>();
  let done = 0;

  for (const item of params.items) {
    let response: Response;
    try {
      response = await fetch(item.url, { cache: "no-store" });
    } catch (error) {
      throw new ClientZipFetchError(
        `浏览器无法直接读取文件：${item.filename}`,
        { cause: error },
      );
    }
    if (!response.ok) {
      throw new ClientZipFetchError(`下载失败: ${item.filename} (HTTP ${response.status})`);
    }
    const blob = await response.blob();
    zip.file(uniqueFilename(item.filename, used), blob);
    done += 1;
    params.onProgress?.(done, params.items.length);
  }

  const archive = await zip.generateAsync({
    type: "blob",
    compression: "STORE",
  });
  triggerBlobDownload(archive, params.filename.endsWith(".zip") ? params.filename : `${params.filename}.zip`);
}
