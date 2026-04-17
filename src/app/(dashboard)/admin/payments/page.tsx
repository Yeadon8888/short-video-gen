"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminTabs } from "@/components/admin/AdminTabs";

interface AlipayConfig {
  enabled: boolean;
  appId: string;
  privateKey: string;
  alipayPublicKey: string;
  gateway: string;
  siteUrl: string;
  returnPath: string;
  notifyPath: string;
}

interface CreditPackage {
  id: string;
  name: string;
  amountFen: number;
  credits: number;
  expiresInDays: number;
  description?: string;
  badge?: string;
  disabled?: boolean;
}

const EMPTY_CONFIG: AlipayConfig = {
  enabled: false,
  appId: "",
  privateKey: "",
  alipayPublicKey: "",
  gateway: "https://openapi.alipay.com/gateway.do",
  siteUrl: "https://video.yeadon.top",
  returnPath: "/pricing/result",
  notifyPath: "/api/payments/alipay/notify",
};

export default function AdminPaymentsPage() {
  const [config, setConfig] = useState<AlipayConfig>(EMPTY_CONFIG);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/payments/config");
    const data = await res.json();
    setConfig(data.config ?? EMPTY_CONFIG);
    setPackages(data.packages ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateConfig<K extends keyof AlipayConfig>(key: K, value: AlipayConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function updatePackage(index: number, patch: Partial<CreditPackage>) {
    setPackages((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    )));
  }

  function addPackage() {
    setPackages((current) => [
      ...current,
      {
        id: `pkg-${Date.now()}`,
        name: "",
        amountFen: 1000,
        credits: 100,
        expiresInDays: 30,
      },
    ]);
  }

  function removePackage(index: number) {
    setPackages((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/payments/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config, packages }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error ?? "保存失败");
      return;
    }
    setMessage("支付配置已保存");
    void load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">管理后台</h1>
        <p className="text-sm text-[var(--vc-text-muted)]">管理用户、积分、模型、支付和任务</p>
      </div>

      <AdminTabs />

      {loading ? (
        <div className="rounded-[var(--vc-radius-lg)] border border-[var(--vc-border)] p-6 text-sm text-[var(--vc-text-muted)]">
          加载中...
        </div>
      ) : (
        <>
          <section className="vc-card space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">支付宝配置</h2>
                <p className="mt-1 text-sm text-[var(--vc-text-muted)]">
                  使用电脑网站支付和手机网站支付，到账后自动充值积分。
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-white">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(event) => updateConfig("enabled", event.target.checked)}
                />
                启用支付
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="App ID" value={config.appId} onChange={(value) => updateConfig("appId", value)} />
              <Field label="网关" value={config.gateway} onChange={(value) => updateConfig("gateway", value)} />
              <Field label="站点地址" value={config.siteUrl} onChange={(value) => updateConfig("siteUrl", value)} />
              <Field label="支付返回路径" value={config.returnPath} onChange={(value) => updateConfig("returnPath", value)} />
              <Field label="异步通知路径" value={config.notifyPath} onChange={(value) => updateConfig("notifyPath", value)} />
            </div>

            <TextAreaField
              label="应用私钥"
              value={config.privateKey}
              onChange={(value) => updateConfig("privateKey", value)}
            />
            <TextAreaField
              label="支付宝公钥"
              value={config.alipayPublicKey}
              onChange={(value) => updateConfig("alipayPublicKey", value)}
            />
          </section>

          <section className="vc-card space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">充值套餐</h2>
                <p className="mt-1 text-sm text-[var(--vc-text-muted)]">
                  前台显示和实际到账积分都以这里为准。
                </p>
              </div>
              <button
                onClick={addPackage}
                className="rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] px-3 py-2 text-sm text-white transition-colors hover:bg-white/[0.08]"
              >
                新增套餐
              </button>
            </div>

            <div className="space-y-4">
              {packages.map((pkg, index) => (
                <div key={`${pkg.id}-${index}`} className="rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-white">套餐 {index + 1}</span>
                    <button
                      onClick={() => removePackage(index)}
                      className="text-sm text-red-400 transition-colors hover:text-red-300"
                    >
                      删除
                    </button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="ID" value={pkg.id} onChange={(value) => updatePackage(index, { id: value })} />
                    <Field label="名称" value={pkg.name} onChange={(value) => updatePackage(index, { name: value })} />
                    <Field
                      label="价格（分）"
                      value={String(pkg.amountFen)}
                      onChange={(value) => updatePackage(index, { amountFen: Number(value) || 0 })}
                    />
                    <Field
                      label="积分"
                      value={String(pkg.credits)}
                      onChange={(value) => updatePackage(index, { credits: Number(value) || 0 })}
                    />
                    <Field
                      label="有效期（天）"
                      value={String(pkg.expiresInDays)}
                      onChange={(value) => updatePackage(index, { expiresInDays: Number(value) || 0 })}
                    />
                    <Field label="角标" value={pkg.badge ?? ""} onChange={(value) => updatePackage(index, { badge: value || undefined })} />
                  </div>
                  <TextAreaField
                    label="描述"
                    value={pkg.description ?? ""}
                    onChange={(value) => updatePackage(index, { description: value || undefined })}
                    rows={2}
                  />
                </div>
              ))}
            </div>
          </section>

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="vc-gradient-btn rounded-[var(--vc-radius-md)] px-4 py-2 text-sm"
            >
              {saving ? "保存中..." : "保存支付配置"}
            </button>
            {message && <span className="text-sm text-[var(--vc-text-muted)]">{message}</span>}
          </div>
        </>
      )}
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-medium text-zinc-400">{props.label}</span>
      <input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 text-sm text-white focus:border-[var(--vc-accent)] focus:outline-none"
      />
    </label>
  );
}

function TextAreaField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-medium text-zinc-400">{props.label}</span>
      <textarea
        rows={props.rows ?? 5}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 text-sm text-white focus:border-[var(--vc-accent)] focus:outline-none"
      />
    </label>
  );
}
