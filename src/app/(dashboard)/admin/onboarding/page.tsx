"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminTabs } from "@/components/admin/AdminTabs";

const DEFAULT_CREDITS = 10;
const MAX_CREDITS = 10_000;

export default function AdminOnboardingPage() {
  const [credits, setCredits] = useState(DEFAULT_CREDITS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/onboarding", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setCredits(data.newUserFreeCredits ?? DEFAULT_CREDITS);
    } else {
      setMessage(data.error ?? "加载配置失败");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/onboarding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newUserFreeCredits: credits }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error ?? "保存失败");
      return;
    }
    setCredits(data.newUserFreeCredits ?? credits);
    setMessage("新用户免费额度已保存");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">管理后台</h1>
        <p className="text-sm text-[var(--vc-text-muted)]">配置新用户注册后的免费额度</p>
      </div>

      <AdminTabs />

      <section className="vc-card max-w-2xl space-y-5 p-6">
        <div>
          <h2 className="text-lg font-semibold text-white">新用户免费额度</h2>
          <p className="mt-1 text-sm text-[var(--vc-text-muted)]">
            只影响后续新注册用户；已有用户不会自动变化。当前默认值为 {DEFAULT_CREDITS} 积分。
          </p>
        </div>

        {loading ? (
          <div className="rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] p-4 text-sm text-[var(--vc-text-muted)]">
            加载中...
          </div>
        ) : (
          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-zinc-400">赠送积分</span>
            <input
              type="number"
              min={0}
              max={MAX_CREDITS}
              step={1}
              value={credits}
              onChange={(event) => setCredits(Number(event.target.value) || 0)}
              className="w-full rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 text-sm text-white focus:border-[var(--vc-accent)] focus:outline-none"
            />
            <span className="text-xs text-[var(--vc-text-dim)]">
              支持 0 到 {MAX_CREDITS} 的整数；设置为 0 表示不赠送。
            </span>
          </label>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={loading || saving}
            className="vc-gradient-btn rounded-[var(--vc-radius-md)] px-4 py-2 text-sm disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存配置"}
          </button>
          {message && <span className="text-sm text-[var(--vc-text-muted)]">{message}</span>}
        </div>
      </section>
    </div>
  );
}
