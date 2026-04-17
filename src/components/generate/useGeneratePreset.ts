"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { parseGenerateReplayPreset } from "@/lib/generate/preset";
import type { GenerateTab, PendingVideo } from "@/components/generate/generate-config";
import type { GenerateParams } from "@/stores/generate";

interface UseGeneratePresetParams {
  setActiveTab: (tab: GenerateTab) => void;
  setThemeInput: (value: string) => void;
  setThemeBrief: (value: string) => void;
  setUrlInput: (value: string) => void;
  setUrlBrief: (value: string) => void;
  setUploadBrief: (value: string) => void;
  setBatchTheme: (value: string) => void;
  setBatchUnitsPerProduct: (value: number) => void;
  setSelectedImageIds: (value: string[]) => void;
  setBatchImageIds: (value: string[]) => void;
  setPendingVideo: (value: PendingVideo | null) => void;
  setParams: (params: Partial<GenerateParams>) => void;
}

export function useGeneratePreset({
  setActiveTab,
  setThemeInput,
  setThemeBrief,
  setUrlInput,
  setUrlBrief,
  setUploadBrief,
  setBatchTheme,
  setBatchUnitsPerProduct,
  setSelectedImageIds,
  setBatchImageIds,
  setPendingVideo,
  setParams,
}: UseGeneratePresetParams) {
  const searchParams = useSearchParams();
  const appliedPresetKeyRef = useRef("");

  useEffect(() => {
    const key = searchParams.toString();
    if (!key || key === appliedPresetKeyRef.current) return;

    const preset = parseGenerateReplayPreset(searchParams);
    appliedPresetKeyRef.current = key;
    const timer = window.setTimeout(() => {
      if (preset.tab) setActiveTab(preset.tab);
      if (typeof preset.themeInput === "string") setThemeInput(preset.themeInput);
      if (typeof preset.themeBrief === "string") setThemeBrief(preset.themeBrief);
      if (typeof preset.urlInput === "string") setUrlInput(preset.urlInput);
      if (typeof preset.urlBrief === "string") setUrlBrief(preset.urlBrief);
      if (typeof preset.uploadUrl === "string") {
        setPendingVideo({
          url: preset.uploadUrl,
          name: preset.uploadName || "历史上传视频",
          sizeMB: "已保存",
        });
      }
      if (typeof preset.uploadBrief === "string") setUploadBrief(preset.uploadBrief);
      if (typeof preset.batchTheme === "string") setBatchTheme(preset.batchTheme);
      if (typeof preset.batchUnitsPerProduct === "number") {
        setBatchUnitsPerProduct(preset.batchUnitsPerProduct);
      }
      if (preset.selectedImageIds) setSelectedImageIds(preset.selectedImageIds);
      if (preset.batchImageIds) setBatchImageIds(preset.batchImageIds);
      if (preset.params) setParams(preset.params);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    searchParams,
    setActiveTab,
    setBatchImageIds,
    setBatchTheme,
    setBatchUnitsPerProduct,
    setParams,
    setPendingVideo,
    setSelectedImageIds,
    setThemeBrief,
    setThemeInput,
    setUploadBrief,
    setUrlBrief,
    setUrlInput,
  ]);
}
