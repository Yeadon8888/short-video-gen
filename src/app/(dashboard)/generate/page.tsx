"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClock, RefreshCw, Zap } from "lucide-react";
import { useGenerateStore } from "@/stores/generate";
import type { FulfillmentMode } from "@/lib/video/types";
import { GenerateFormPanels } from "@/components/generate/GenerateFormPanels";
import { GenerateIdleCards } from "@/components/generate/GenerateIdleCards";
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

export default function GeneratePage() {
  const [activeTab, setActiveTab] = useState<GenerateTab>("theme");
  const [themeInput, setThemeInput] = useState("");
  const [themeBrief, setThemeBrief] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlBrief, setUrlBrief] = useState("");
  const [uploadBrief, setUploadBrief] = useState("");
  const [batchTheme, setBatchTheme] = useState("");
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
      const request: GenerateRequest = {
        type: "theme",
        input: themeInput.trim(),
        creativeBrief: themeBrief.trim() || undefined,
        sourceMode: "theme",
        selectedImageIds,
        params,
        scheduled,
        fulfillmentMode: scheduled ? "standard" : fulfillmentMode,
      };
      void startStreamGenerate(request);
      return;
    }

    if (activeTab === "url") {
      if (!urlInput.trim()) return;
      const request: GenerateRequest = {
        type: "url",
        input: urlInput.trim(),
        creativeBrief: urlBrief.trim() || undefined,
        sourceMode: "url",
        selectedImageIds,
        params,
        scheduled,
        fulfillmentMode: scheduled ? "standard" : fulfillmentMode,
      };
      void startStreamGenerate(request);
      return;
    }

    if (activeTab === "upload") {
      if (!pendingVideo) return;
      const request: GenerateRequest = {
        type: "video_key",
        input: pendingVideo.url,
        creativeBrief: uploadBrief.trim() || undefined,
        sourceMode: "upload",
        selectedImageIds,
        params,
        scheduled,
        fulfillmentMode: scheduled ? "standard" : fulfillmentMode,
      };
      void startStreamGenerate(request);
      return;
    }

    if (!batchTheme.trim()) return;
    const request: BatchGenerateRequest = {
      sourceMode: "batch",
      batchTheme: batchTheme.trim(),
      selectedImageIds: batchImageIds,
      selectionMode: "sequence",
      params,
    };
    void startBatchGenerate(request);
  }

  function isSubmitDisabled() {
    if (isLoading) return true;
    if (activeTab === "theme") return !themeInput.trim();
    if (activeTab === "url") return !urlInput.trim();
    if (activeTab === "upload") return !pendingVideo;
    return !batchTheme.trim() || batchImageIds.length === 0;
  }

  const activeSourceLabel = GENERATE_SOURCE_LABELS[activeTab];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-4 pt-4 text-center sm:pt-8">
        <h1 className="text-4xl font-black tracking-tight md:text-6xl">
          <span className="bg-gradient-to-r from-white via-slate-200 to-[var(--vc-accent)] bg-clip-text text-transparent">
            AI 驱动的带货短视频
          </span>
        </h1>
        <p className="text-lg text-slate-400">四种工作流，一页切换，直接对应真实带货场景</p>
      </div>

      <div className="space-y-4 rounded-[var(--vc-radius-xl)] border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-4 shadow-2xl">
        <GenerateTabs tabs={GENERATE_TABS} activeTab={activeTab} onChange={setActiveTab} />

        <div className="border-t border-[var(--vc-border)]/60 pt-4">
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
            selectedImageIds={selectedImageIds}
            batchImageIds={batchImageIds}
            onThemeInputChange={setThemeInput}
            onThemeBriefChange={setThemeBrief}
            onUrlInputChange={setUrlInput}
            onUrlBriefChange={setUrlBrief}
            onUploadBriefChange={setUploadBrief}
            onBatchThemeChange={setBatchTheme}
            onSelectedImageIdsChange={setSelectedImageIds}
            onBatchImageIdsChange={setBatchImageIds}
            onVideoFileChange={handleVideoFile}
            onPendingVideoClear={() => setPendingVideo(null)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--vc-border)]/60 pt-4">
          <ParamBar />
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              {activeTab !== "batch" && !scheduled && (
                <button
                  onClick={() =>
                    setFulfillmentMode((m) =>
                      m === "backfill_until_target" ? "standard" : "backfill_until_target",
                    )
                  }
                  disabled={isLoading}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all ${
                    fulfillmentMode === "backfill_until_target"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-[var(--vc-border)] text-[var(--vc-text-muted)] hover:border-emerald-500/30 hover:text-emerald-300"
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
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all ${
                    scheduled
                      ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
                      : "border-[var(--vc-border)] text-[var(--vc-text-muted)] hover:border-purple-500/30 hover:text-purple-300"
                  }`}
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  次日 02:00 自动执行
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={isSubmitDisabled()}
                className="vc-glow-btn inline-flex items-center gap-2 px-8 py-3 text-sm"
              >
                <Zap className="h-4 w-4" />
                {activeTab === "batch" ? "创建批量任务" : scheduled ? "定时生成" : "生成"}
              </button>
            </div>
            {activeTab !== "batch" && fulfillmentMode === "backfill_until_target" && !scheduled && (
              <p className="text-right text-xs text-[var(--vc-text-muted)]">
                开启后，失败的视频将在 3 小时内自动补发，直到达到目标数量。建议保持页面打开。
              </p>
            )}
            {activeTab !== "batch" && scheduled && (
              <p className="text-right text-xs text-[var(--vc-text-muted)]">
                会先保存脚本并扣除积分，随后在北京时间次日凌晨 02:00 自动提交生成。
              </p>
            )}
          </div>
        </div>
      </div>

      {stage === "IDLE" && !errorMessage && !batchSummary && (
        <GenerateIdleCards tabs={GENERATE_TABS} />
      )}

      {errorMessage && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {errorMessage}
          <button
            onClick={reset}
            className="ml-3 rounded-full bg-red-500/10 px-3 py-1 text-xs transition-colors hover:bg-red-500/20"
          >
            清除
          </button>
        </div>
      )}

      {batchSummary && (
        <div className="vc-card space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">{activeSourceLabel}已创建</h2>
              <p className="text-sm text-[var(--vc-text-muted)]">
                成功 {batchSummary.createdCount} 条，失败 {batchSummary.failedCount} 条
              </p>
            </div>
            <Link
              href={batchSummary.taskGroupId ? `/tasks/groups/${batchSummary.taskGroupId}` : "/tasks"}
              className="rounded-full border border-[var(--vc-border)] px-4 py-2 text-sm text-[var(--vc-text-secondary)]"
            >
              查看任务组
            </Link>
          </div>
          {batchSummary.errors.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
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
                目标补齐中：{deliveryProgress.successfulCount}/{deliveryProgress.requestedCount} 成功
                {deliveryProgress.pendingCount > 0 && `，${deliveryProgress.pendingCount} 进行中`}
                {deliveryProgress.failedCount > 0 && `，${deliveryProgress.failedCount} 失败`}
              </span>
            </div>
            {deliveryProgress.deliveryDeadlineAt && (
              <span className="shrink-0 text-xs text-[var(--vc-text-muted)]">
                补齐截止{" "}
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
