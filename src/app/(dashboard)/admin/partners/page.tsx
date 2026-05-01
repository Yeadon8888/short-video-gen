"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminTabs } from "@/components/admin/AdminTabs";

interface PartnerRow {
  id: string;
  code: string;
  displayName: string | null;
  status: "active" | "disabled";
  commissionRateBps: number;
  createdAt: string;
  userId: string;
  email: string;
  name: string | null;
  credits: number;
  stripePaidOrders: number;
  stripePaidAmountFen: number;
  stripePaidCredits: number;
  commissionDueFen: number;
}

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [commissionRate, setCommissionRate] = useState("0");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  const fetchPartners = useCallback(async () => {
    const params = new URLSearchParams({ page: "1", limit: "50" });
    if (search.trim()) params.set("search", search.trim());
    const res = await fetch(`/api/admin/partners?${params}`);
    const data = await res.json();
    setPartners(data.partners ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchPartners(), 150);
    return () => window.clearTimeout(timer);
  }, [fetchPartners]);

  async function createPartner(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/admin/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: userQuery,
        code,
        displayName: displayName || null,
        commissionRateBps: Math.round((Number(commissionRate) || 0) * 100),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "创建失败");
      setLoading(false);
      return;
    }

    setUserQuery("");
    setCode("");
    setDisplayName("");
    setCommissionRate("0");
    setMessage("伙伴已保存");
    await fetchPartners();
  }

  async function toggleStatus(partner: PartnerRow) {
    setLoading(true);
    await fetch("/api/admin/partners", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partnerId: partner.id,
        status: partner.status === "active" ? "disabled" : "active",
      }),
    });
    await fetchPartners();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">伙伴管理</h1>
        <p className="text-sm text-[var(--vc-text-muted)]">
          创建一级伙伴邀请码，伙伴可用自己的积分给名下用户划拨额度。
        </p>
      </div>

      <AdminTabs />

      <form
        onSubmit={createPartner}
        className="grid gap-4 rounded-[var(--vc-radius-lg)] border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-4 md:grid-cols-[1.2fr_1fr_1fr_140px_160px]"
      >
        <Field label="用户">
          <input
            value={userQuery}
            onChange={(event) => setUserQuery(event.target.value)}
            placeholder="邮箱 / 昵称 / 用户 ID"
            required
            className="w-full rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--vc-accent)]"
          />
        </Field>
        <Field label="邀请码">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="如 yeadon2"
            required
            className="w-full rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--vc-accent)]"
          />
        </Field>
        <Field label="伙伴名称">
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="后台展示名"
            className="w-full rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--vc-accent)]"
          />
        </Field>
        <Field label="佣金 %">
          <input
            value={commissionRate}
            onChange={(event) => setCommissionRate(event.target.value)}
            placeholder="0"
            type="number"
            min="0"
            max="100"
            step="0.01"
            className="w-full rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--vc-accent)]"
          />
        </Field>
        <button
          disabled={loading}
          className="vc-gradient-btn self-end rounded-[var(--vc-radius-md)] px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          保存伙伴
        </button>
      </form>

      {message && (
        <div className="rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] bg-white/[0.03] px-4 py-2 text-sm text-zinc-300">
          {message}
        </div>
      )}

      <div className="flex items-center gap-4">
        <input
          value={search}
          onChange={(event) => {
            setLoading(true);
            setSearch(event.target.value);
          }}
          placeholder="搜索邮箱、名称或邀请码..."
          className="w-full rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--vc-accent)] sm:w-80"
        />
        <span className="text-sm text-[var(--vc-text-muted)]">共 {total} 个伙伴</span>
      </div>

      <div className="overflow-x-auto rounded-[var(--vc-radius-lg)] border border-[var(--vc-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--vc-bg-surface)] text-[var(--vc-text-secondary)]">
            <tr>
              <th className="px-4 py-3 text-left">伙伴</th>
              <th className="px-4 py-3 text-left">邀请链接</th>
              <th className="px-4 py-3 text-right">余额</th>
              <th className="px-4 py-3 text-right">Stripe 成交</th>
              <th className="px-4 py-3 text-center">佣金比例</th>
              <th className="px-4 py-3 text-right">应付佣金</th>
              <th className="px-4 py-3 text-center">状态</th>
              <th className="px-4 py-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--vc-border)]">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[var(--vc-text-muted)]">
                  加载中...
                </td>
              </tr>
            ) : partners.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[var(--vc-text-muted)]">
                  暂无伙伴
                </td>
              </tr>
            ) : (
              partners.map((partner) => (
                <tr key={partner.id} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{partner.displayName || partner.name || partner.email}</div>
                    <div className="text-xs text-[var(--vc-text-muted)]">{partner.email}</div>
                    <div className="text-xs text-[var(--vc-text-muted)]">ID: {partner.userId}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-300">
                    {origin}/r/{partner.code}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white">{partner.credits}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-mono text-white">
                      ¥{(partner.stripePaidAmountFen / 100).toFixed(2)}
                    </div>
                    <div className="text-xs text-[var(--vc-text-muted)]">
                      {partner.stripePaidOrders} 单 / {partner.stripePaidCredits} 积分
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-zinc-300">
                    {(partner.commissionRateBps / 100).toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--vc-accent)]">
                    ¥{(partner.commissionDueFen / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      partner.status === "active"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-zinc-700 text-zinc-300"
                    }`}>
                      {partner.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleStatus(partner)}
                      className="rounded border border-[var(--vc-border)] px-2 py-1 text-xs text-zinc-300 transition-colors hover:border-[var(--vc-accent)] hover:text-[var(--vc-accent)]"
                    >
                      {partner.status === "active" ? "停用" : "启用"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="block text-xs font-medium text-[var(--vc-text-muted)]">{label}</span>
      {children}
    </label>
  );
}
