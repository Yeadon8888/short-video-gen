"use client";

import { useRef } from "react";
import { useGenerateStore } from "@/stores/generate";
import type { PendingVideo } from "@/components/generate/generate-config";

export function useVideoUpload(params: {
  onBeforeUpload: () => void;
  onUploaded: (video: PendingVideo) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reset = useGenerateStore((state) => state.reset);
  const setStage = useGenerateStore((state) => state.setStage);
  const addLog = useGenerateStore((state) => state.addLog);
  const setError = useGenerateStore((state) => state.setError);

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

      const directRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": file.type || "video/mp4",
          "X-Upload-Key": apiKey,
        },
        body: file,
      });
      if (!directRes.ok) {
        setError("UPLOAD_FAILED", `视频上传失败: HTTP ${directRes.status}`);
        return;
      }
      const r2Result = await directRes.json();

      const regRes = await fetch("/api/assets/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: r2Result.key,
          url: r2Result.url,
          size: r2Result.size,
          filename: file.name,
          contentType: file.type,
        }),
      });
      if (!regRes.ok) {
        setError("UPLOAD_FAILED", `注册资源失败: HTTP ${regRes.status}`);
        return;
      }
      const asset = await regRes.json();
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
