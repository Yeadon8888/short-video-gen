"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check, Sparkles, Film, Palette } from "lucide-react";

const R2 = "https://vc-upload.yeadon.top/files/vidclaw-assets/showcase";

type Mode = "url" | "video" | "theme";

type ModeConfig = {
  id: Mode;
  label: string;
  inputs: { label: string; value: string; typing?: boolean; monospace?: boolean }[];
  tags: string[];
  video: string;
  poster: string;
  caption: string;
  progressSteps: { key: string; label: string; details: string[] }[];
};

const MODES: ModeConfig[] = [
  {
    id: "url",
    label: "URL 模式",
    inputs: [
      {
        label: "",
        value: "https://v.douyin.com/iY7xK9Pn/",
        typing: true,
        monospace: true,
      },
      { label: "修改:", value: "把产品换成我们的护肤精华", typing: true },
    ],
    tags: ["9:16", "15s", "VEO 3.1"],
    video: `${R2}/skincare.mp4`,
    poster: "/showcase/skincare.jpg",
    caption: "护肤精华液 · AI 生成",
    progressSteps: [
      {
        key: "analyzing",
        label: "分析视频内容",
        details: [
          "识别主角：女性 · 特写",
          "光线：暖黄 · 情绪：轻松",
          "时长 15s · 分镜 4 段",
        ],
      },
      {
        key: "scripting",
        label: "拆解分镜脚本",
        details: [
          "钩子 0-2s：产品入镜",
          "卖点 3-8s：上脸特写",
          "CTA 13-15s：品牌露出",
        ],
      },
      {
        key: "rendering",
        label: "调用 VEO 3.1 渲染",
        details: ["替换产品：护肤精华", "保持镜头运动一致", "输出 1080×1920"],
      },
    ],
  },
  {
    id: "video",
    label: "视频模式",
    inputs: [
      {
        label: "参考视频:",
        value: "sneakers_reference_v2.mp4 · 00:12",
        typing: true,
      },
      { label: "替换产品:", value: "我们的小红鞋跑步鞋", typing: true },
    ],
    tags: ["9:16", "12s", "Sora 2"],
    video: `${R2}/sneakers.mp4`,
    poster: "/showcase/sneakers.jpg",
    caption: "运动鞋 · AI 生成",
    progressSteps: [
      {
        key: "analyzing",
        label: "解析参考视频",
        details: [
          "检测 4 个镜头切换点",
          "主体：跑步 · 路面 · 城市",
          "节奏：快切 BPM 128",
        ],
      },
      {
        key: "scripting",
        label: "产品素材对齐",
        details: [
          "去背 + 3D 姿态估计",
          "匹配原视频中鞋子位置",
          "保留原镜头运动曲线",
        ],
      },
      {
        key: "rendering",
        label: "Sora 2 渲染合成",
        details: ["多帧一致性校验", "色调匹配原片 ΔE<3", "输出 9:16 · 12s"],
      },
    ],
  },
  {
    id: "theme",
    label: "主题模式",
    inputs: [
      { label: "主题:", value: "清晨咖啡馆 · 手冲倾倒特写", typing: true },
      { label: "产品:", value: "精品手冲咖啡豆 250g", typing: true },
    ],
    tags: ["9:16", "10s", "Seedance 2.0"],
    video: `${R2}/coffee.mp4`,
    poster: "/showcase/coffee.jpg",
    caption: "手冲咖啡 · AI 生成",
    progressSteps: [
      {
        key: "analyzing",
        label: "解析主题意图",
        details: [
          "场景：咖啡馆 · 木质吧台",
          "氛围：晨光 · 蒸汽 · 慢镜头",
          "受众：25-35 都市白领",
        ],
      },
      {
        key: "scripting",
        label: "生成分镜脚本",
        details: [
          "镜头 1：豆子倾入磨豆机",
          "镜头 2：手冲注水涟漪",
          "镜头 3：杯中金色液面",
        ],
      },
      {
        key: "rendering",
        label: "Seedance 2.0 渲染",
        details: ["4K 粒子细节（蒸汽）", "柔焦景深 f/1.4", "输出 9:16 · 10s"],
      },
    ],
  },
];

type Phase =
  | "idle"
  | "typing-1"
  | "typing-2"
  | "clicking"
  | "analyzing"
  | "scripting"
  | "rendering"
  | "result";

const TAB_ICON: Record<Mode, React.ComponentType<{ className?: string }>> = {
  url: Sparkles,
  video: Film,
  theme: Palette,
};

export function HeroDemoAnimation() {
  const [modeId, setModeId] = useState<Mode>("url");
  const [phase, setPhase] = useState<Phase>("idle");
  const [text1, setText1] = useState("");
  const [text2, setText2] = useState("");
  const [btnPressed, setBtnPressed] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [userInteracted, setUserInteracted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modeRef = useRef<Mode>(modeId);

  const mode = MODES.find((m) => m.id === modeId)!;

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  /* Keep latest mode in ref so advanceMode reads fresh value */
  useEffect(() => {
    modeRef.current = modeId;
  }, [modeId]);

  /* Pause animation when page is hidden */
  useEffect(() => {
    const handler = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  /* Cleanup */
  useEffect(() => () => clearTimer(), []);

  /* Preload strategy: active mode now, others when browser is idle.
     Avoids 3 parallel MP4 downloads competing with hydration. */
  useEffect(() => {
    const now = document.createElement("video");
    now.preload = "auto";
    now.src = mode.video;

    const idleCb = (cb: () => void) => {
      if (typeof window.requestIdleCallback === "function") {
        return window.requestIdleCallback(cb, { timeout: 3000 });
      }
      return window.setTimeout(cb, 1500);
    };

    const id = idleCb(() => {
      for (const m of MODES) {
        if (m.id === mode.id) continue;
        const v = document.createElement("video");
        v.preload = "auto";
        v.src = m.video;
      }
    });
    return () => {
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(id as number);
      } else {
        window.clearTimeout(id as number);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchMode = useCallback((next: Mode) => {
    clearTimer();
    setUserInteracted(true);
    /* Pre-fill inputs immediately on manual tab click — no blank state */
    const nextMode = MODES.find((m) => m.id === next)!;
    setText1(nextMode.inputs[0].value);
    setText2(nextMode.inputs[1].value);
    setBtnPressed(false);
    setModeId(next);
    /* Jump straight to clicking → generating → result (skip the typing) */
    setPhase("clicking");
  }, []);

  /* ── State machine (per mode) ── */
  useEffect(() => {
    clearTimer();
    if (!pageVisible) return;

    switch (phase) {
      case "idle":
        setText1("");
        setText2("");
        setBtnPressed(false);
        timerRef.current = setTimeout(() => setPhase("typing-1"), 900);
        break;

      case "typing-1": {
        const target = mode.inputs[0].value;
        let i = 0;
        const tick = () => {
          if (i < target.length) {
            const jump = Math.random() > 0.7 ? 3 : 2;
            const next = Math.min(i + jump, target.length);
            setText1(target.slice(0, next));
            i = next;
            timerRef.current = setTimeout(tick, 30 + Math.random() * 25);
          } else {
            timerRef.current = setTimeout(() => setPhase("typing-2"), 450);
          }
        };
        tick();
        break;
      }

      case "typing-2": {
        const target = mode.inputs[1].value;
        let i = 0;
        const tick = () => {
          if (i < target.length) {
            setText2(target.slice(0, ++i));
            timerRef.current = setTimeout(tick, 60 + Math.random() * 50);
          } else {
            timerRef.current = setTimeout(() => setPhase("clicking"), 600);
          }
        };
        tick();
        break;
      }

      case "clicking":
        setBtnPressed(true);
        timerRef.current = setTimeout(() => {
          setBtnPressed(false);
          setPhase("analyzing");
        }, 380);
        break;

      case "analyzing":
        timerRef.current = setTimeout(() => setPhase("scripting"), 1300);
        break;

      case "scripting":
        timerRef.current = setTimeout(() => setPhase("rendering"), 1300);
        break;

      case "rendering":
        timerRef.current = setTimeout(() => setPhase("result"), 1800);
        break;

      case "result":
        /* Auto-advance to next mode if user hasn't manually switched yet.
           If user clicked a tab, just stay here (full cycle mode). */
        if (!userInteracted) {
          timerRef.current = setTimeout(() => {
            const i = MODES.findIndex((m) => m.id === modeRef.current);
            const next = MODES[(i + 1) % MODES.length].id;
            setModeId(next);
            setPhase("idle");
          }, 4800);
        } else {
          /* Looping same mode every 7s */
          timerRef.current = setTimeout(() => setPhase("idle"), 7000);
        }
        break;
    }
    return () => clearTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pageVisible, modeId]);

  const isGenerating = ["analyzing", "scripting", "rendering"].includes(phase);
  const showResult = phase === "result";

  const stepStatus = (key: string) => {
    const order = ["analyzing", "scripting", "rendering", "result"];
    const ci = order.indexOf(phase);
    const si = order.indexOf(key);
    if (ci < 0) return "pending";
    return si < ci ? "done" : si === ci ? "active" : "pending";
  };

  return (
    <div className="relative w-full">
      {/* Glow */}
      <div className="absolute -inset-4 rounded-3xl bg-[var(--vc-accent)]/8 blur-2xl" />

      {/* FIXED-HEIGHT frame — no layout shift between phases */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--vc-accent)]/15 bg-[var(--vc-bg-surface)]/80 shadow-2xl shadow-[var(--vc-accent)]/5 backdrop-blur-sm">
        {/* ── Clickable tabs ── */}
        <div className="flex gap-1 border-b border-[var(--vc-border)]/50 px-4 pt-3 pb-2.5">
          {MODES.map((m) => {
            const Icon = TAB_ICON[m.id];
            const active = m.id === modeId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => switchMode(m.id)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-[var(--vc-accent)]/15 text-[var(--vc-accent)]"
                    : "text-[var(--vc-text-secondary)] hover:bg-white/5 hover:text-white"
                }`}
                aria-pressed={active}
              >
                <Icon className="h-3 w-3" />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Fixed-height content area — keeps frame size stable across phases */}
        <div className="relative min-h-[440px]">
          <AnimatePresence mode="wait">
            {showResult ? (
              <motion.div
                key={`result-${modeId}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 flex flex-col"
              >
                <div className="flex items-center gap-2 px-4 pt-4">
                  <Sparkles className="h-4 w-4 text-[var(--vc-success)]" />
                  <span className="text-sm font-semibold text-[var(--vc-success)]">
                    生成完成
                  </span>
                  <span className="ml-auto text-[10px] text-slate-500">
                    {mode.tags.join(" · ")}
                  </span>
                </div>

                <div className="flex flex-1 items-center justify-center px-4 py-2">
                  <div className="w-full max-w-[175px]">
                    <div
                      className="overflow-hidden rounded-xl shadow-lg shadow-black/30"
                      style={{ aspectRatio: "9/16" }}
                    >
                      <video
                        key={mode.video}
                        src={mode.video}
                        poster={mode.poster}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="mt-2 text-center text-xs text-[var(--vc-text-secondary)]">
                      {mode.caption}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`inputs-${modeId}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0"
              >
                <div className="space-y-2.5 px-4 pt-4 pb-3">
                  {/* Input 1 */}
                  <div className="flex items-center rounded-lg border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2.5 min-h-[42px]">
                    {mode.inputs[0].label && (
                      <span className="mr-1.5 shrink-0 text-xs text-slate-500">
                        {mode.inputs[0].label}
                      </span>
                    )}
                    {text1 ? (
                      <span
                        className={`truncate text-sm text-white ${
                          mode.inputs[0].monospace ? "font-mono" : ""
                        }`}
                      >
                        {text1}
                      </span>
                    ) : (
                      !mode.inputs[0].label && (
                        <span className="text-sm text-slate-600">
                          等待输入...
                        </span>
                      )
                    )}
                    {(phase === "idle" || phase === "typing-1") && (
                      <span className="ml-0.5 inline-block h-4 w-[2px] shrink-0 animate-pulse bg-[var(--vc-accent)]" />
                    )}
                  </div>

                  {/* Input 2 */}
                  <div className="flex items-center rounded-lg border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2.5 min-h-[42px]">
                    <span className="mr-1.5 shrink-0 text-xs text-slate-500">
                      {mode.inputs[1].label}
                    </span>
                    {text2 && (
                      <span className="truncate text-sm text-white">
                        {text2}
                      </span>
                    )}
                    {phase === "typing-2" && (
                      <span className="ml-0.5 inline-block h-4 w-[2px] shrink-0 animate-pulse bg-[var(--vc-accent)]" />
                    )}
                  </div>

                  {/* Tags + generate button — wraps on narrow screens */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap gap-1.5">
                      {mode.tags.map((tag) => (
                        <span
                          key={tag}
                          className="whitespace-nowrap rounded-full border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-2 py-0.5 text-[10px] font-semibold text-slate-500"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <button
                      className={`rounded-full px-5 py-2 text-sm font-bold transition-all duration-150 ${
                        btnPressed
                          ? "scale-90 bg-[var(--vc-accent)]/70 text-[var(--vc-bg-root)]"
                          : isGenerating
                            ? "bg-[var(--vc-accent)]/40 text-[var(--vc-bg-root)]"
                            : "bg-[var(--vc-accent)] text-[var(--vc-bg-root)] shadow-[0_0_16px_rgba(13,204,242,0.3)]"
                      }`}
                    >
                      {isGenerating ? (
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          生成中
                        </span>
                      ) : (
                        "生成"
                      )}
                    </button>
                  </div>
                </div>

                {/* Progress steps + streaming details */}
                {isGenerating && (
                  <div className="space-y-2.5 border-t border-[var(--vc-border)]/50 px-4 py-3">
                    {mode.progressSteps.map(({ key, label, details }) => {
                      const st = stepStatus(key);
                      return (
                        <div key={key}>
                          <div className="flex items-center gap-2.5 text-sm">
                            {st === "done" ? (
                              <Check className="h-4 w-4 text-[var(--vc-success)]" />
                            ) : st === "active" ? (
                              <Loader2 className="h-4 w-4 animate-spin text-[var(--vc-accent)]" />
                            ) : (
                              <div className="h-4 w-4 rounded-full border border-[var(--vc-border)]" />
                            )}
                            <span
                              className={
                                st === "done"
                                  ? "text-slate-300"
                                  : st === "active"
                                    ? "text-[var(--vc-accent)]"
                                    : "text-slate-600"
                              }
                            >
                              {label}
                              {st === "active" && "..."}
                            </span>
                          </div>
                          {/* Streaming detail lines — appear staggered under the active step */}
                          {st === "active" && (
                            <div className="mt-1 ml-6 space-y-0.5">
                              {details.map((d, i) => (
                                <motion.div
                                  key={d}
                                  initial={{ opacity: 0, x: -4 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{
                                    delay: 0.1 + i * 0.32,
                                    duration: 0.25,
                                  }}
                                  className="flex items-center gap-1.5 text-[11px] text-slate-500"
                                >
                                  <span className="text-[var(--vc-accent)]/70">
                                    ›
                                  </span>
                                  {d}
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mode dots below — subtle hint you can click */}
      <div className="mt-4 flex items-center justify-center gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => switchMode(m.id)}
            aria-label={m.label}
            className={`h-1.5 rounded-full transition-all ${
              m.id === modeId
                ? "w-8 bg-[var(--vc-accent)]"
                : "w-1.5 bg-white/20 hover:bg-white/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
