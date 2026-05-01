"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface PartnerDashboard {
  partner: {
    id: string;
    code: string;
    displayName: string | null;
    status: "active" | "disabled";
    commissionRateBps: number;
  };
  credits: number;
  customerCount: number;
  paidOrders: number;
  paidAmountFen: number;
  paidCredits: number;
  customers: Array<{
    userId: string;
    email: string;
    name: string | null;
    credits: number;
    status: "active" | "suspended";
    registeredAt: string;
  }>;
  transfers: Array<{
    id: string;
    amount: number;
    reason: string | null;
    createdAt: string;
    toUserId: string;
    toEmail: string;
    toName: string | null;
  }>;
}

export default function PartnerPage() {
  const [dashboard, setDashboard] = useState<PartnerDashboard | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const partnerLink = useMemo(() => {
    if (!dashboard || typeof window === "undefined") return "";
    return `${window.location.origin}/r/${dashboard.partner.code}`;
  }, [dashboard]);

  const fetchDashboard = useCallback(async () => {
    const res = await fetch("/api/partner", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) {
      setDashboard(data);
      setSelectedUserId((current) => current || data.customers?.[0]?.userId || "");
    } else {
      setMessage(data.error ?? "伙伴中心加载失败");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchDashboard();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchDashboard]);

  async function transferCredits(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/partner/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toUserId: selectedUserId,
        amount: Number(amount),
        reason: reason || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "划拨失败");
      setLoading(false);
      return;
    }

    setAmount("");
    setReason("");
    setMessage("积分已划拨");
    await fetchDashboard();
  }

  if (loading && !dashboard) {
    return <div className="text-sm text-[var(--vc-text-muted)]">加载伙伴中心...</div>;
  }

  if (!dashboard) {
    return (
      <div className="rounded-[var(--vc-radius-lg)] border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-6">
        <h1 className="text-xl font-semibold text-white">伙伴中心暂不可用</h1>
        <p className="mt-2 text-sm text-[var(--vc-text-muted)]">{message ?? "请联系管理员开通伙伴资料。"}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">伙伴中心</h1>
        <p className="text-sm text-[var(--vc-text-muted)]">
          管理邀请客户和积分划拨。伙伴只能从自己的余额中划拨积分。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="伙伴余额" value={dashboard.credits.toLocaleString()} />
        <MetricCard label="邀请用户" value={dashboard.customerCount.toLocaleString()} />
        <MetricCard label="已支付订单" value={dashboard.paidOrders.toLocaleString()} />
        <MetricCard label="归因支付金额" value={`¥${(dashboard.paidAmountFen / 100).toFixed(2)}`} />
      </div>

      <div className="rounded-[var(--vc-radius-lg)] border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-4">
        <div className="text-sm font-medium text-white">专属邀请链接</div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            readOnly
            value={partnerLink}
            className="flex-1 rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 font-mono text-xs text-zinc-300 outline-none"
          />
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(partnerLink)}
            className="rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-[var(--vc-accent)] hover:text-[var(--vc-accent)]"
          >
            复制
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] bg-white/[0.03] px-4 py-2 text-sm text-zinc-300">
          {message}
        </div>
      )}

      <form
        onSubmit={transferCredits}
        className="grid gap-3 rounded-[var(--vc-radius-lg)] border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-4 md:grid-cols-[1fr_160px_1fr_auto]"
      >
        <select
          value={selectedUserId}
          onChange={(event) => setSelectedUserId(event.target.value)}
          required
          className="rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--vc-accent)]"
        >
          {dashboard.customers.length === 0 ? (
            <option value="">暂无可划拨用户</option>
          ) : (
            dashboard.customers.map((customer) => (
              <option key={customer.userId} value={customer.userId}>
                {customer.email} · {customer.credits} 积分
              </option>
            ))
          )}
        </select>
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          type="number"
          min="1"
          step="1"
          required
          placeholder="积分数量"
          className="rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--vc-accent)]"
        />
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="备注"
          className="rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--vc-accent)]"
        />
        <button
          disabled={loading || dashboard.customers.length === 0}
          className="vc-gradient-btn rounded-[var(--vc-radius-md)] px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          划拨积分
        </button>
      </form>

      <div className="grid gap-6 xl:grid-cols-2">
        <DataPanel title="邀请用户">
          <table className="w-full text-sm">
            <thead className="text-[var(--vc-text-secondary)]">
              <tr>
                <th className="px-3 py-2 text-left">用户</th>
                <th className="px-3 py-2 text-right">余额</th>
                <th className="px-3 py-2 text-center">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--vc-border)]">
              {dashboard.customers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-[var(--vc-text-muted)]">暂无邀请用户</td>
                </tr>
              ) : (
                dashboard.customers.map((customer) => (
                  <tr key={customer.userId}>
                    <td className="px-3 py-3">
                      <div className="text-white">{customer.email}</div>
                      <div className="text-xs text-[var(--vc-text-muted)]">{customer.name || "未设置昵称"}</div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-white">{customer.credits}</td>
                    <td className="px-3 py-3 text-center text-xs text-zinc-300">{customer.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DataPanel>

        <DataPanel title="最近划拨">
          <table className="w-full text-sm">
            <thead className="text-[var(--vc-text-secondary)]">
              <tr>
                <th className="px-3 py-2 text-left">用户</th>
                <th className="px-3 py-2 text-right">积分</th>
                <th className="px-3 py-2 text-left">备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--vc-border)]">
              {dashboard.transfers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-[var(--vc-text-muted)]">暂无划拨记录</td>
                </tr>
              ) : (
                dashboard.transfers.map((transfer) => (
                  <tr key={transfer.id}>
                    <td className="px-3 py-3 text-white">{transfer.toEmail}</td>
                    <td className="px-3 py-3 text-right font-mono text-white">{transfer.amount}</td>
                    <td className="px-3 py-3 text-zinc-300">{transfer.reason || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DataPanel>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--vc-radius-lg)] border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--vc-text-muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}

function DataPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[var(--vc-radius-lg)] border border-[var(--vc-border)] bg-[var(--vc-bg-surface)]">
      <div className="border-b border-[var(--vc-border)] px-4 py-3 text-sm font-medium text-white">{title}</div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
