"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock3, Loader2, XCircle } from "lucide-react";

interface OrderView {
  id: string;
  outTradeNo: string;
  status: "pending" | "paid" | "failed" | "closed";
  subject: string;
  credits: number;
  amountFen: number;
}

export default function PricingResultPage() {
  const searchParams = useSearchParams();
  const outTradeNo = searchParams.get("outTradeNo");
  const [order, setOrder] = useState<OrderView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function run() {
      if (!outTradeNo) {
        setError("缺少支付订单号");
        setLoading(false);
        return;
      }

      const tasksRes = await fetch("/api/tasks/refresh", { method: "POST" }).catch(() => null);
      void tasksRes;

      const sessionOrderRes = await fetch(`/api/payments/orders/by-out-trade-no?outTradeNo=${encodeURIComponent(outTradeNo)}`).catch(() => null);
      if (!sessionOrderRes || !sessionOrderRes.ok) {
        setError("暂时无法查询订单状态");
        setLoading(false);
        return;
      }

      const sessionOrderData = await sessionOrderRes.json();
      const orderId = sessionOrderData.order?.id as string | undefined;
      if (!orderId) {
        setError("订单不存在");
        setLoading(false);
        return;
      }

      const syncRes = await fetch(`/api/payments/orders/${orderId}`, { method: "POST" });
      const syncData = await syncRes.json();
      if (!active) return;

      if (!syncRes.ok) {
        setError(syncData.error ?? "同步订单状态失败");
        setLoading(false);
        return;
      }

      setOrder(syncData.order ?? null);
      setLoading(false);
    }

    void run();
    return () => {
      active = false;
    };
  }, [outTradeNo]);

  return (
    <div className="mx-auto max-w-xl space-y-6 pt-6">
      <a href="/pricing" className="inline-flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-white">← 返回充值</a>
      <h1 className="text-3xl font-black text-white">支付结果</h1>
      <div className="vc-card space-y-4 p-6">
        {loading ? (
          <div className="flex items-center gap-3 text-sm text-[var(--vc-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在核对支付状态...
          </div>
        ) : error ? (
          <StatusBlock
            icon={<XCircle className="h-6 w-6 text-red-400" />}
            title="查询失败"
            description={error}
          />
        ) : order?.status === "paid" ? (
          <StatusBlock
            icon={<CheckCircle2 className="h-6 w-6 text-emerald-400" />}
            title="充值成功"
            description={`已到账 ${order.credits} 积分，当前可以直接继续生成视频。`}
          />
        ) : (
          <StatusBlock
            icon={<Clock3 className="h-6 w-6 text-amber-400" />}
            title="支付确认中"
            description="支付宝正在回传最终结果。如果你已经付款，稍等片刻后刷新本页即可。"
          />
        )}

        {order && (
          <div className="rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] bg-[var(--vc-bg-root)]/50 p-4 text-sm text-zinc-300">
            <div>订单号：{order.outTradeNo}</div>
            <div>标题：{order.subject}</div>
            <div>金额：¥{(order.amountFen / 100).toFixed(2)}</div>
            <div>积分：{order.credits}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBlock(props: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {props.icon}
        <h2 className="text-lg font-semibold text-white">{props.title}</h2>
      </div>
      <p className="text-sm text-[var(--vc-text-muted)]">{props.description}</p>
    </div>
  );
}
