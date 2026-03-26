"use client";

import { useRef } from "react";
import { useGenerateStore } from "@/stores/generate";
import type { PendingVideo } from "@/components/generate/generate-config";

const FALLBACK_PROXY_LIMIT_BYTES = 4 * 1024 * 1024;

export function useVideoUpload(params: {
  onBeforeUpload: () => void;
  onUploaded: (video: PendingVideo) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reset = useGenerateStore((state) => state.reset);
  const setStage = useGenerateStore((state) => state.setStage);
  const addLog = useGenerateStore((state) => state.addLog);
  const setError = useGenerateStore((state) => state.setError);

  async function registerDirectUpload(params: {
    file: File;
    uploadUrl: string;
    apiKey: string;
  }) {
    const directRes = await fetch(params.uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": params.file.type || "video/mp4",
        "X-Upload-Key": params.apiKey,
      },
      body: params.file,
    });
    if (!directRes.ok) {
      throw new Error(`视频上传失败: HTTP ${directRes.status}`);
    }
    const r2Result = await directRes.json();

    const regRes = await fetch("/api/assets/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: r2Result.key,
        url: r2Result.url,
        size: r2Result.size,
        filename: params.file.name,
        contentType: params.file.type,
      }),
    });
    if (!regRes.ok) {
      throw new Error(`注册资源失败: HTTP ${regRes.status}`);
    }
    return await regRes.json();
  }

  async function uploadViaAppProxy(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const proxyRes = await fetch("/api/assets/upload", {
      method: "POST",
      body: formData,
    });
    if (!proxyRes.ok) {
      const data = await proxyRes.json().catch(() => null);
      throw new Error(data?.error ?? `视频上传失败: HTTP ${proxyRes.status}`);
    }

    return await proxyRes.json();
  }

  async function handleVideoFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    params.onBeforeUpload();
    reset();
    setStage("DOWNLOAD");
    addLog("正在上传视频...");

    try {
      const tokenRes = await fetch("/api/assets/upload-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      });
      if (!tokenRes.ok) {
        setError("UPLOAD_FAILED", `获取上传凭证失败: HTTP ${tokenRes.status}`);
        return;
      }
      const { uploadUrl, apiKey } = await tokenRes.json();

      let asset: { url: string };
      try {
        asset = await registerDirectUpload({ file, uploadUrl, apiKey });
      } catch (error) {
        const message = String(error);
        if (file.size <= FALLBACK_PROXY_LIMIT_BYTES) {
          addLog("直传上传失败，正在尝试站内回退上传...");
          asset = await uploadViaAppProxy(file);
        } else {
          setError(
            "UPLOAD_FAILED",
            `视频直传失败，当前网络可能无法连接上传网关（vc-upload.yeadon.top）。原始错误: ${message.slice(0, 120)}`,
          );
          return;
        }
      }

      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      addLog(`视频已上传 (${sizeMB} MB)，现在可以填写创意补充后开始生成`);
      params.onUploaded({ url: asset.url, name: file.name, sizeMB });
      setStage("IDLE");
    } catch (error) {
      setError("UPLOAD_FAILED", String(error));
    }
  }

  return {
    fileInputRef,
    handleVideoFile,
  };
}
