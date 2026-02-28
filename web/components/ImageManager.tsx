"use client";

import { useState, useEffect, useRef } from "react";

interface ImageItem {
  key: string;
  url: string;
}

interface ImageManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImageManager({ isOpen, onClose }: ImageManagerProps) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [r2Enabled, setR2Enabled] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) fetchImages();
  }, [isOpen]);

  async function fetchImages() {
    setLoading(true);
    try {
      const res = await fetch("/api/images");
      const data = await res.json();
      setImages(data.urls ?? []);
      setR2Enabled(data.r2_enabled ?? false);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/images", { method: "POST", body: formData });
      if (res.ok) {
        await fetchImages();
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(key: string) {
    const res = await fetch("/api/images", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    if (res.ok) {
      setImages((prev) => prev.filter((img) => img.key !== key));
    }
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 w-80 z-50 flex flex-col"
        style={{ background: "#13131A", borderLeft: "1px solid #1E1E2E" }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid #1E1E2E" }}
        >
          <h3 className="font-semibold text-white">参考图片</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!r2Enabled && (
            <div
              className="rounded-xl p-4 text-sm text-amber-400"
              style={{ background: "#D97706" + "11", border: "1px solid #D97706" + "44" }}
            >
              R2 存储未配置，图片功能不可用。请在 .env.local 中设置 R2 相关变量。
            </div>
          )}

          {r2Enabled && (
            <>
              <p className="text-xs text-slate-400">
                上传的图片会作为视频生成的视觉参考，建议上传产品图或风格参考图。
              </p>

              {loading ? (
                <div className="text-center py-8 text-slate-500 text-sm">加载中...</div>
              ) : images.length === 0 ? (
                <div
                  className="rounded-xl p-6 text-center border-2 border-dashed text-slate-500 text-sm"
                  style={{ borderColor: "#1E1E2E" }}
                >
                  还没有上传图片
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {images.map((img) => (
                    <div
                      key={img.key}
                      className="relative group rounded-xl overflow-hidden aspect-square"
                      style={{ background: "#0A0A0F" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => handleDelete(img.key)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold"
                        style={{ background: "rgba(239,68,68,0.9)" }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {r2Enabled && (
          <div className="p-4" style={{ borderTop: "1px solid #1E1E2E" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full py-3 rounded-xl font-medium text-white transition-all disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #7C3AED, #2563EB)",
              }}
            >
              {uploading ? "上传中..." : "+ 上传图片"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
