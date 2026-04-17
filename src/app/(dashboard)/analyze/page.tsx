"use client";

import { useState, useRef } from "react";
import { Search, Loader2, Copy, Check, Clapperboard, Globe, Languages } from "lucide-react";
import Link from "next/link";
import type { ScriptResult, OutputLanguage } from "@/lib/video/types";

type Stage = "idle" | "downloading" | "analyzing" | "done" | "error";

export default function AnalyzePage() {
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<"tiktok" | "douyin">("tiktok");
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>("auto");
  const [stage, setStage] = useState<Stage>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function handleAnalyze() {
    if (!url.trim()) return;
    setStage("downloading");
    setLogs([]);
    setResult(null);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), platform, outputLanguage }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setError(`请求失败 (${res.status})`);
        setStage("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "log") {
              setLogs((prev) => [...prev, event.message]);
            } else if (event.type === "stage") {
              if (event.stage === "DOWNLOAD") setStage("downloading");
              else if (event.stage === "ANALYZE") setStage("analyzing");
            } else if (event.type === "result") {
              setResult(event.data as ScriptResult);
              setStage("done");
            } else if (event.type === "error") {
              setError(event.message);
              setStage("error");
            }
          } catch {
            // ignore malformed events
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError("网络错误，请重试。");
        setStage("error");
      }
    }
  }

  const isLoading = stage === "downloading" || stage === "analyzing";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white">视频拆解</h1>
        <p className="mt-1 text-sm text-slate-400">
          智能提取视频中的钩子话术、分镜脚本和配套文案，一键复用到你的创作中。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left: Input */}
        <div className="space-y-5">
          {/* Step 1: URL */}
          <div className="rounded-xl border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-5">
            <h3 className="mb-3 text-sm font-semibold text-white">① 输入视频链接</h3>
            <p className="mb-3 text-xs text-slate-400">
              支持抖音、TikTok 分享链接，AI 自动解析脚本、运镜与画面。
            </p>
            <textarea
              className="w-full resize-none rounded-lg border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[var(--vc-accent)] focus:outline-none"
              rows={3}
              placeholder="粘贴抖音/TikTok 视频链接..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isLoading) {
                  e.preventDefault();
                  handleAnalyze();
                }
              }}
            />
          </div>

          {/* Step 2: Settings */}
          <div className="rounded-xl border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-5">
            <h3 className="mb-3 text-sm font-semibold text-white">② 分析设置</h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-slate-500" />
                <select
                  className="rounded-lg border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 text-xs text-white focus:border-[var(--vc-accent)] focus:outline-none"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as "tiktok" | "douyin")}
                >
                  <option value="tiktok">TikTok</option>
                  <option value="douyin">抖音</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Languages className="h-3.5 w-3.5 text-slate-500" />
                <select
                  className="rounded-lg border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 text-xs text-white focus:border-[var(--vc-accent)] focus:outline-none"
                  value={outputLanguage}
                  onChange={(e) => setOutputLanguage(e.target.value as OutputLanguage)}
                >
                  <option value="auto">语言自动</option>
                  <option value="en">英语</option>
                  <option value="es-mx">墨西哥西语</option>
                  <option value="es">西班牙语</option>
                  <option value="ms">马来西亚语</option>
                  <option value="pt-br">巴西葡语</option>
                  <option value="id">印尼语</option>
                  <option value="ar">阿拉伯语</option>
                </select>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleAnalyze}
            disabled={isLoading || !url.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--vc-accent)] px-6 py-3.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {stage === "downloading"
              ? "正在下载视频..."
              : stage === "analyzing"
                ? "AI 分析中..."
                : "开始分析 · 2 积分"}
          </button>
        </div>

        {/* Right: Logs */}
        <div className="space-y-4">
          {logs.length > 0 && (
            <div className="rounded-xl border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                分析日志
              </h3>
              <div className="space-y-1 text-xs text-slate-400">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--vc-accent)]" />
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {result && <AnalysisResults result={result} />}
    </div>
  );
}

function AnalysisResults({ result }: { result: ScriptResult }) {
  return (
    <div className="space-y-5">
      {/* Hook & Summary */}
      <div className="rounded-xl border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-5">
        <h3 className="mb-4 text-sm font-semibold text-white">钩子 & 创意要点</h3>
        <div className="space-y-4">
          <div className="rounded-lg bg-[var(--vc-accent)]/10 px-4 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--vc-accent)]">
              Hook
            </span>
            <p className="mt-1 text-sm font-medium text-white">{result.hook}</p>
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">剧情梗概</span>
            <p className="mt-1 text-sm text-slate-300">{result.plot_summary}</p>
          </div>
          {result.creative_points?.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">创意要点</span>
              <ul className="mt-1 space-y-1">
                {result.creative_points.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--vc-accent)]" />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Shots */}
      <div className="rounded-xl border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-5">
        <h3 className="mb-4 text-sm font-semibold text-white">分镜脚本</h3>
        <div className="space-y-3">
          {result.shots?.map((shot) => (
            <div
              key={shot.id}
              className="rounded-lg border border-[var(--vc-border)] bg-[var(--vc-bg-root)] p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--vc-accent)]">
                  镜头 {shot.id} · {shot.camera} · {shot.duration_s}s
                </span>
                <CopyBtn text={shot.sora_prompt} />
              </div>
              <p className="mt-2 text-sm text-slate-300">{shot.scene_zh}</p>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">{shot.sora_prompt}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Full Sora Prompt */}
      <div className="rounded-xl border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">完整 Sora Prompt</h3>
          <CopyBtn text={result.full_sora_prompt} />
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
          {result.full_sora_prompt}
        </p>
      </div>

      {/* Copy */}
      {result.copy && (
        <div className="rounded-xl border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-5">
          <h3 className="mb-4 text-sm font-semibold text-white">配套文案</h3>
          <div className="space-y-4">
            <CopyField label="标题" text={result.copy.title} />
            <CopyField label="正文" text={result.copy.caption} />
            <CopyField label="首评" text={result.copy.first_comment} />
          </div>
        </div>
      )}

      {/* Action */}
      <div className="flex justify-center">
        <Link
          href={`/generate?prompt=${encodeURIComponent(result.full_sora_prompt)}`}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-8 py-3.5 text-sm font-medium text-white transition-all hover:brightness-110"
        >
          <Clapperboard className="h-4 w-4" />
          用此脚本生成视频
        </Link>
      </div>
    </div>
  );
}

function CopyField({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <CopyBtn text={text} />
      </div>
      <p className="mt-1 text-sm text-slate-300">{text}</p>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "已复制" : "复制"}
    </button>
  );
}
