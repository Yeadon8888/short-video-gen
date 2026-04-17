"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClock, RefreshCw, Zap, Loader2 } from "lucide-react";
import { useGenerateStore } from "@/stores/generate";
import type { FulfillmentMode } from "@/lib/video/types";
import { GenerateFormPanels } from "@/components/generate/GenerateFormPanels";
import { ParamBar } from "@/components/generate/ParamBar";
import { ProcessLog } from "@/components/generate/ProcessLog";
import { ScriptOutput } from "@/components/generate/ScriptOutput";
import { VideoResults } from "@/components/generate/VideoResults";
import {
  GENERATE_SOURCE_LABELS,
  GENERATE_TABS,
  type BatchSummary,
  type GenerateTab,
  type PendingVideo,
} from "@/components/generate/generate-config";
import { GenerateTabs } from "@/components/generate/GenerateTabs";
import { useGeneratePreset } from "@/components/generate/useGeneratePreset";
import { useGenerateRunner } from "@/components/generate/useGenerateRunner";
import { useVideoUpload } from "@/components/generate/useVideoUpload";
import type {
  BatchGenerateRequest,
  GenerateRequest,
} from "@/lib/video/types";
import { computeBatchTotalVideoCount } from "@/lib/tasks/batch-math";

export default function GeneratePage() {
  const [activeTab, setActiveTab] = useState<GenerateTab>("theme");
  const [themeInput, setThemeInput] = useState("");
  const [themeBrief, setThemeBrief] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlBrief, setUrlBrief] = useState("");
  const [uploadBrief, setUploadBrief] = useState("");
  const [batchTheme, setBatchTheme] = useState("");
  const [batchUnitsPerProduct, setBatchUnitsPerProduct] = useState(1);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [batchImageIds, setBatchImageIds] = useState<string[]>([]);
  const [scheduled, setScheduled] = useState(false);
  const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode>("standard");
  const [pendingVideo, setPendingVideo] = useState<PendingVideo | null>(null);
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null);

  const stage = useGenerateStore((s) => s.stage);
  const errorMessage = useGenerateStore((s) => s.errorMessage);
  const deliveryProgress = useGenerateStore((s) => s.deliveryProgress);
  const reset = useGenerateStore((s) => s.reset);
  const params = useGenerateStore((s) => s.params);
  const setParams = useGenerateStore((s) => s.setParams);

  useGeneratePreset({
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
  });

  const { isLoading, startBatchGenerate, startStreamGenerate } = useGenerateRunner({
    onBatchSummaryChange: setBatchSummary,
  });
  const { fileInputRef, handleVideoFile } = useVideoUpload({
    onBeforeUpload: () => setBatchSummary(null),
    onUploaded: setPendingVideo,
  });

  function handleSubmit() {
    if (isLoading) return;

    if (activeTab === "theme") {
      if (!themeInput.trim()) return;
      void startStreamGenerate({
        type: "theme",
        input: themeInput.trim(),
        creativeBrief: themeBrief.trim() || undefined,
        sourceMode: "theme",
        selectedImageIds,
        params,
        scheduled,
        fulfillmentMode: scheduled ? "standard" : fulfillmentMode,
      });
      return;
    }

    if (activeTab === "url") {
      if (!urlInput.trim()) return;
      void startStreamGenerate({
        type: "url",
        input: urlInput.trim(),
        creativeBrief: urlBrief.trim() || undefined,
        sourceMode: "url",
        selectedImageIds,
        params,
        scheduled,
        fulfillmentMode: scheduled ? "standard" : fulfillmentMode,
      });
      return;
    }

    if (activeTab === "upload") {
      if (!pendingVideo) return;
      void startStreamGenerate({
        type: "video_key",
        input: pendingVideo.url,
        creativeBrief: uploadBrief.trim() || undefined,
        sourceMode: "upload",
        selectedImageIds,
        params,
        scheduled,
        fulfillmentMode: scheduled ? "standard" : fulfillmentMode,
      });
      return;
    }

    if (!batchTheme.trim()) return;
    void startBatchGenerate({
      sourceMode: "batch",
      batchTheme: batchTheme.trim(),
      selectedImageIds: batchImageIds,
      unitsPerProduct: batchUnitsPerProduct,
      selectionMode: "sequence",
      fulfillmentMode,
      params: { ...params },
    });
  }

  function isSubmitDisabled() {
    if (isLoading) return true;
    if (activeTab === "theme") return !themeInput.trim();
    if (activeTab === "url") return !urlInput.trim();
    if (activeTab === "upload") return !pendingVideo;
    return !batchTheme.trim() || batchImageIds.length === 0;
  }

  const activeSourceLabel = GENERATE_SOURCE_LABELS[activeTab];
  const batchTotalVideos = computeBatchTotalVideoCount(
    batchImageIds.length,
    batchUnitsPerProduct,
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white">AI 视频生成</h1>
        <p className="mt-1 text-sm text-slate-400">
          选择工作流模式，输入创意描述，AI 自动生成带货短视频。
        </p>
      </div>

      {/* Step ① Mode Selection */}
      <div className="rounded-xl border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-5">
        <h3 className="mb-3 text-sm font-semibold text-white">① 选择模式</h3>
        <GenerateTabs tabs={GENERATE_TABS} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* Step ② Input + Materials */}
      <div className="rounded-xl border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-5">
        <h3 className="mb-3 text-sm font-semibold text-white">② 输入内容 & 上传素材</h3>
        <GenerateFormPanels
          activeTab={activeTab}
          isLoading={isLoading}
          fileInputRef={fileInputRef}
          pendingVideo={pendingVideo}
          themeInput={themeInput}
          themeBrief={themeBrief}
          urlInput={urlInput}
          urlBrief={urlBrief}
          uploadBrief={uploadBrief}
          batchTheme={batchTheme}
          batchUnitsPerProduct={batchUnitsPerProduct}
          selectedImageIds={selectedImageIds}
          batchImageIds={batchImageIds}
          onThemeInputChange={setThemeInput}
          onThemeBriefChange={setThemeBrief}
          onUrlInputChange={setUrlInput}
          onUrlBriefChange={setUrlBrief}
          onUploadBriefChange={setUploadBrief}
          onBatchThemeChange={setBatchTheme}
          onBatchUnitsPerProductChange={setBatchUnitsPerProduct}
          onSelectedImageIdsChange={setSelectedImageIds}
          onBatchImageIdsChange={setBatchImageIds}
          onVideoFileChange={handleVideoFile}
          onPendingVideoClear={() => setPendingVideo(null)}
        />
      </div>

      {/* Step ③ Generation Settings */}
      <div className="rounded-xl border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-5">
        <h3 className="mb-3 text-sm font-semibold text-white">③ 生成设置</h3>
        <ParamBar
          activeTab={activeTab}
          batchProductCount={batchImageIds.length}
          batchUnitsPerProduct={batchUnitsPerProduct}
        />

        {/* Mode toggles */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--vc-border)]/40 pt-4">
          {!scheduled && (
            <button
              onClick={() =>
                setFulfillmentMode((m) =>
                  m === "backfill_until_target" ? "standard" : "backfill_until_target",
                )
              }
              disabled={isLoading}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-all ${
                fulfillmentMode === "backfill_until_target"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-[var(--vc-border)] text-slate-500 hover:border-emerald-500/30 hover:text-emerald-300"
              }`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              失败自动补齐
            </button>
          )}
          {activeTab !== "batch" && (
            <button
              onClick={() => setScheduled((value) => !value)}
              disabled={isLoading}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-all ${
                scheduled
                  ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
                  : "border-[var(--vc-border)] text-slate-500 hover:border-purple-500/30 hover:text-purple-300"
              }`}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              次日 02:00 执行
            </button>
          )}

          {/* Hint text */}
          {fulfillmentMode === "backfill_until_target" && !scheduled && (
            <span className="text-xs text-slate-500">
              {activeTab === "batch"
                ? `共 ${batchImageIds.length || 0} 个商品，计划 ${batchTotalVideos} 条，3 小时内自动补齐`
                : "失败视频 3 小时内自动补发"}
            </span>
          )}
          {activeTab !== "batch" && scheduled && (
            <span className="text-xs text-slate-500">
              先保存脚本并扣积分，北京时间次日 02:00 自动提交
            </span>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitDisabled()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--vc-accent)] px-6 py-3.5 text-sm font-medium text-white shadow-lg shadow-[var(--vc-accent)]/10 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Zap className="h-4 w-4" />
        )}
        {isLoading
          ? "生成中..."
          : activeTab === "batch"
            ? `创建批量任务 · ${batchTotalVideos} 条`
            : scheduled
              ? "定时生成"
              : `生成 · ${params.count * (params.model ? 1 : 1)} 条视频`}
      </button>

      {/* ── Results Area ── */}

      {errorMessage && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <span>{errorMessage}</span>
          <button
            onClick={reset}
            className="rounded-lg bg-red-500/10 px-3 py-1 text-xs transition-colors hover:bg-red-500/20"
          >
            清除
          </button>
        </div>
      )}

      {batchSummary && (
        <div className="rounded-xl border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">{activeSourceLabel}已创建</h2>
              <p className="text-xs text-slate-400">
                成功 {batchSummary.createdCount} 条，失败 {batchSummary.failedCount} 条
              </p>
            </div>
            <Link
              href={batchSummary.taskGroupId ? `/tasks/groups/${batchSummary.taskGroupId}` : "/tasks"}
              className="rounded-lg border border-[var(--vc-border)] px-4 py-2 text-xs text-slate-400 transition-colors hover:text-white"
            >
              查看任务组
            </Link>
          </div>
          {batchSummary.errors.length > 0 && (
            <div className="mt-3 space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
              {batchSummary.errors.map((error) => (
                <p key={`${error.index}-${error.message}`}>
                  第 {error.index} 条：{error.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {deliveryProgress && stage === "POLL" && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-emerald-300">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>
                目标补齐：{deliveryProgress.successfulCount}/{deliveryProgress.requestedCount} 成功
                {deliveryProgress.pendingCount > 0 && `，${deliveryProgress.pendingCount} 进行中`}
                {deliveryProgress.failedCount > 0 && `，${deliveryProgress.failedCount} 失败`}
              </span>
            </div>
            {deliveryProgress.deliveryDeadlineAt && (
              <span className="shrink-0 text-xs text-slate-500">
                截止{" "}
                {new Intl.DateTimeFormat("zh-CN", {
                  timeZone: "Asia/Shanghai",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(deliveryProgress.deliveryDeadlineAt))}
              </span>
            )}
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--vc-border)]">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{
                width: `${Math.round(
                  (deliveryProgress.successfulCount / Math.max(deliveryProgress.requestedCount, 1)) * 100,
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      <ProcessLog />
      <ScriptOutput />
      <VideoResults />
    </div>
  );
}
