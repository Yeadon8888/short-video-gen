"use client";

import type { RefObject } from "react";
import { Film, Upload, X } from "lucide-react";
import { ProductImagePicker } from "@/components/generate/ProductImagePicker";
import type { GenerateTab, PendingVideo } from "@/components/generate/generate-config";

interface GenerateFormPanelsProps {
  activeTab: GenerateTab;
  isLoading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  pendingVideo: PendingVideo | null;
  themeInput: string;
  themeBrief: string;
  urlInput: string;
  urlBrief: string;
  uploadBrief: string;
  batchTheme: string;
  selectedImageIds: string[];
  batchImageIds: string[];
  onThemeInputChange: (value: string) => void;
  onThemeBriefChange: (value: string) => void;
  onUrlInputChange: (value: string) => void;
  onUrlBriefChange: (value: string) => void;
  onUploadBriefChange: (value: string) => void;
  onBatchThemeChange: (value: string) => void;
  onSelectedImageIdsChange: (ids: string[]) => void;
  onBatchImageIdsChange: (ids: string[]) => void;
  onVideoFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPendingVideoClear: () => void;
}

export function GenerateFormPanels({
  activeTab,
  isLoading,
  fileInputRef,
  pendingVideo,
  themeInput,
  themeBrief,
  urlInput,
  urlBrief,
  uploadBrief,
  batchTheme,
  selectedImageIds,
  batchImageIds,
  onThemeInputChange,
  onThemeBriefChange,
  onUrlInputChange,
  onUrlBriefChange,
  onUploadBriefChange,
  onBatchThemeChange,
  onSelectedImageIdsChange,
  onBatchImageIdsChange,
  onVideoFileChange,
  onPendingVideoClear,
}: GenerateFormPanelsProps) {
  if (activeTab === "theme") {
    return (
      <div className="space-y-4">
        <textarea
          value={themeInput}
          onChange={(event) => onThemeInputChange(event.target.value)}
          rows={4}
          placeholder="比如：把这款护肤产品拍成马来西亚都市感的生活方式短视频"
          className="w-full rounded-2xl border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-4 py-3 text-base text-white outline-none"
        />
        <textarea
          value={themeBrief}
          onChange={(event) => onThemeBriefChange(event.target.value)}
          rows={3}
          placeholder="补充限制词（可选）：比如前三秒强钩子、突出开箱感、整体更高级"
          className="w-full rounded-2xl border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-4 py-3 text-sm text-white outline-none"
        />
        <ProductImagePicker
          selectedIds={selectedImageIds}
          onChange={onSelectedImageIdsChange}
          maxSelectable={1}
          description="主题原创模式只参考 1 张产品图，用来确定这条视频里的具体商品。"
        />
      </div>
    );
  }

  if (activeTab === "url") {
    return (
      <div className="space-y-4">
        <textarea
          value={urlInput}
          onChange={(event) => onUrlInputChange(event.target.value)}
          rows={3}
          placeholder="粘贴抖音 / TikTok 链接"
          className="w-full rounded-2xl border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-4 py-3 text-base text-white outline-none"
        />
        <textarea
          value={urlBrief}
          onChange={(event) => onUrlBriefChange(event.target.value)}
          rows={3}
          placeholder="创意补充：比如保留爆款节奏，但换成更强带货感，前三秒就出现产品"
          className="w-full rounded-2xl border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-4 py-3 text-sm text-white outline-none"
        />
        <ProductImagePicker
          selectedIds={selectedImageIds}
          onChange={onSelectedImageIdsChange}
          maxSelectable={1}
          description="链接二创模式只参考 1 张产品图。参考视频学结构，产品图决定最终商品。"
        />
      </div>
    );
  }

  if (activeTab === "upload") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-dashed border-[var(--vc-border)] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--vc-border)] px-4 py-2 text-sm text-[var(--vc-text-secondary)]"
            >
              <Upload className="h-4 w-4" />
              上传参考视频
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={onVideoFileChange}
            />
            {pendingVideo ? (
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-[var(--vc-accent)]/10 px-3 py-1.5">
                <Film className="h-4 w-4 shrink-0 text-[var(--vc-accent)]" />
                <span className="truncate text-sm text-[var(--vc-accent)]">
                  {pendingVideo.name} ({pendingVideo.sizeMB} MB)
                </span>
                <button
                  onClick={onPendingVideoClear}
                  className="ml-auto rounded-full p-1 text-[var(--vc-accent)]/70"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <p className="text-sm text-[var(--vc-text-muted)]">先上传本地视频，再填写创意补充。</p>
            )}
          </div>
        </div>
        <textarea
          value={uploadBrief}
          onChange={(event) => onUploadBriefChange(event.target.value)}
          rows={3}
          placeholder="创意补充：比如保持节奏，但改成更强促单、强调材质和使用场景"
          className="w-full rounded-2xl border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-4 py-3 text-sm text-white outline-none"
        />
        <ProductImagePicker
          selectedIds={selectedImageIds}
          onChange={onSelectedImageIdsChange}
          maxSelectable={1}
          description="上传视频二创模式只参考 1 张产品图，避免多个商品混入同一条视频。"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <textarea
        value={batchTheme}
        onChange={(event) => onBatchThemeChange(event.target.value)}
        rows={4}
        placeholder="比如：把这个产品做成马来西亚风格的带货短视频，前三秒强钩子，突出生活场景和购买欲"
        className="w-full rounded-2xl border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-4 py-3 text-base text-white outline-none"
      />
      <ProductImagePicker
        selectedIds={batchImageIds}
        onChange={onBatchImageIdsChange}
        title="批量产品图片"
        description="批量带货模式会按你勾选的顺序循环复用产品图，直到凑满生成数量。"
      />
    </div>
  );
}
