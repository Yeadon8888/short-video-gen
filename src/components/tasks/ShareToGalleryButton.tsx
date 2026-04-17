"use client";

import { useState } from "react";
import { Share2, Check, Loader2 } from "lucide-react";

export function ShareToGalleryButton({ taskId }: { taskId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleShare() {
    setState("loading");
    try {
      const res = await fetch("/api/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "分享失败");
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setErrorMsg("网络错误");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
        <Check className="h-3 w-3" />
        已分享到广场
      </span>
    );
  }

  return (
    <button
      onClick={handleShare}
      disabled={state === "loading"}
      className="inline-flex items-center gap-1 rounded-full border border-[var(--vc-border)] px-3 py-1 text-xs text-[var(--vc-text-secondary)] transition-colors hover:border-[var(--vc-accent)]/40 hover:text-[var(--vc-accent)] disabled:opacity-50"
      title={state === "error" ? errorMsg : "分享到灵感广场"}
    >
      {state === "loading" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Share2 className="h-3 w-3" />
      )}
      {state === "error" ? errorMsg : "分享到广场"}
    </button>
  );
}
