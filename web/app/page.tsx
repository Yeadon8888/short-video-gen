"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        router.push("/chat");
      } else {
        const data = await res.json();
        setError(data.error ?? "验证失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple mb-4"
            style={{ background: "linear-gradient(135deg, #7C3AED, #2563EB)" }}>
            <span className="text-2xl">⚡</span>
          </div>
          <h1 className="text-2xl font-bold gradient-text">VidClaw</h1>
          <p className="text-slate-400 mt-2 text-sm">Gemini × Sora · AI 短视频生成</p>
        </div>

        {/* Login card */}
        <div
          className="rounded-2xl p-8 border"
          style={{ background: "#13131A", borderColor: "#1E1E2E" }}
        >
          <h2 className="text-lg font-semibold mb-6 text-white">输入邀请码</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="XXXXXX"
                className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-500 text-lg font-mono tracking-widest outline-none focus:ring-2 transition-all"
                style={{
                  background: "#0A0A0F",
                  borderColor: "#1E1E2E",
                  border: "1px solid #1E1E2E",
                  // @ts-expect-error CSS variable
                  "--tw-ring-color": "#7C3AED",
                }}
                autoComplete="off"
                spellCheck="false"
              />
            </div>
            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}
            <button
              type="submit"
              disabled={!code.trim() || loading}
              className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: loading
                  ? "#5B21B6"
                  : "linear-gradient(135deg, #7C3AED, #2563EB)",
              }}
            >
              {loading ? "验证中..." : "进入"}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          仅限受邀用户使用
        </p>
      </div>
    </div>
  );
}
