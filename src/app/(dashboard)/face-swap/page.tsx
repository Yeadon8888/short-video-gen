"use client";

import { useState, useRef, useEffect } from "react";
import { UserCircle, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";

type Stage = "idle" | "uploading" | "submitting" | "polling" | "error";

// ── Demo showcase ──
const DEMO_RESULT = {
  faceImage: "https://vc-upload.yeadon.top/files/vidclaw-assets/demo/faceswap-face.png",
  videoUrl: "https://vc-upload.yeadon.top/files/vidclaw-assets/demo/faceswap-result.mp4",
  prompt: "character1 showing a dental product in a modern bathroom, natural smile, soft lighting",
};

const PROMPT_EXAMPLES = [
  { label: "护肤推广", prompt: "character1 在高端浴室中展示护肤产品，微笑自然，柔和灯光" },
  { label: "咖啡种草", prompt: "character1 在咖啡馆享用咖啡，温馨氛围，阳光透过窗户" },
  { label: "运动场景", prompt: "character1 在公园慢跑后展示运动水杯，充满活力" },
  { label: "穿搭展示", prompt: "character1 在城市街头走秀，展示时尚穿搭，自信大方" },
];

export default function FaceSwapPage() {
  const [faceImageUrl, setFaceImageUrl] = useState("");
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Upload
  async function handleFaceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFacePreview(URL.createObjectURL(file));
    setStage("uploading");
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/assets/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) { setFaceImageUrl(data.url); setStage("idle"); }
      else { setError("图片上传失败"); setStage("error"); }
    } catch { setError("上传失败"); setStage("error"); }
  }

  // Submit
  async function handleSubmit() {
    if (!faceImageUrl) return;
    setStage("submitting");
    setError(null);
    try {
      const res = await fetch("/api/face-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faceImageUrl, prompt: prompt.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setStage("error"); return; }
      setTaskId(data.taskId);
      setStage("polling");
    } catch { setError("网络错误"); setStage("error"); }
  }

  const isLoading = stage === "uploading" || stage === "submitting" || stage === "polling";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white">视频换人</h1>
        <p className="mt-1 text-sm text-slate-400">
          上传人脸照片，AI 生成该人物的带货视频。基于 Wan2.6 参考人物模型。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Left: Steps */}
        <div className="space-y-5">
          {/* Step 1 */}
          <div className="rounded-xl border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-5">
            <h3 className="mb-1 text-sm font-semibold text-white">① 上传人脸照片</h3>
            <p className="mb-4 text-xs text-slate-400">正面清晰，光线均匀。AI 会保持该人物的面部特征。</p>
            <label className="group flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-4 py-8 transition-colors hover:border-[var(--vc-accent)]/40">
              {facePreview ? (
                <img src={facePreview} alt="Face" className="h-28 w-28 rounded-full object-cover ring-2 ring-[var(--vc-accent)]/30" />
              ) : (
                <>
                  <UserCircle className="h-10 w-10 text-slate-600 transition-colors group-hover:text-[var(--vc-accent)]" />
                  <span className="mt-2 text-sm text-slate-500">点击上传人脸照片</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={handleFaceUpload} className="hidden" />
            </label>
          </div>

          {/* Step 2 */}
          <div className="rounded-xl border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-5">
            <h3 className="mb-1 text-sm font-semibold text-white">② 描述视频场景（可选）</h3>
            <p className="mb-4 text-xs text-slate-400">描述你想要的视频内容，AI 会生成该人物在对应场景中的视频。</p>
            <textarea
              className="w-full resize-none rounded-lg border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[var(--vc-accent)] focus:outline-none"
              rows={3}
              placeholder="例如：一位女性在咖啡店展示护肤产品，微笑自然，氛围温馨..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={isLoading || !faceImageUrl}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--vc-accent)] px-6 py-3.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {stage === "uploading" ? "上传中..." : stage === "submitting" ? "提交中..." : stage === "polling" ? "生成中..." : "生成换人视频 · 25 积分"}
          </button>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
          )}

          {taskId && stage === "polling" && (
            <div className="rounded-xl border border-[var(--vc-accent)]/20 bg-[var(--vc-accent)]/5 p-4 text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-[var(--vc-accent)]" />
              <p className="mt-2 text-sm text-slate-300">视频生成中，通常需要 1-3 分钟</p>
              <Link
                href={`/tasks/${taskId}`}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--vc-border)] px-4 py-2 text-xs text-slate-400 transition-colors hover:text-white"
              >
                查看任务详情
              </Link>
            </div>
          )}
        </div>

        {/* Right: Before/After showcase */}
        <div className="space-y-4">
          {/* Real demo: face → video */}
          <div className="rounded-xl border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-5">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">效果展示</h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Before: face image */}
              <div className="text-center">
                <LazyImage
                  src={DEMO_RESULT.faceImage}
                  alt="参考人脸"
                  className="mx-auto aspect-[3/4] w-full rounded-lg border border-[var(--vc-border)] object-cover"
                />
                <span className="mt-2 block text-xs text-slate-500">参考人脸</span>
              </div>
              {/* After: generated video */}
              <div className="text-center">
                <LazyVideo
                  src={DEMO_RESULT.videoUrl}
                  className="mx-auto aspect-[3/4] w-full rounded-lg border border-[var(--vc-accent)]/30 object-cover"
                />
                <span className="mt-2 block text-xs text-[var(--vc-accent)]">AI 生成视频</span>
              </div>
            </div>
          </div>

          {/* Prompt examples */}
          <div className="rounded-xl border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">场景模板</h3>
            <div className="space-y-2">
              {PROMPT_EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => setPrompt(ex.prompt)}
                  className="flex w-full items-center gap-2 rounded-lg border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2.5 text-left transition-all hover:border-[var(--vc-accent)]/30"
                >
                  <span className="flex-shrink-0 rounded bg-[var(--vc-accent)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--vc-accent)]">
                    {ex.label}
                  </span>
                  <span className="line-clamp-1 text-xs text-slate-400">{ex.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Lazy-loaded image — only loads when in viewport */
function LazyImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { rootMargin: "200px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {visible ? (
        <img src={src} alt={alt} className={className} loading="lazy" />
      ) : (
        <div className={`${className} bg-slate-800 animate-pulse`} />
      )}
    </div>
  );
}

/** Lazy-loaded video — only loads when in viewport, muted autoplay */
function LazyVideo({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { rootMargin: "200px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {visible ? (
        <video src={src} className={className} autoPlay muted loop playsInline />
      ) : (
        <div className={`${className} bg-slate-800 animate-pulse`} />
      )}
    </div>
  );
}
