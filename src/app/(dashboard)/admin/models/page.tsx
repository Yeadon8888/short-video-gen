"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminTabs } from "@/components/admin/AdminTabs";

interface Model {
  id: string;
  name: string;
  slug: string;
  provider: string;
  creditsPerGen: number;
  isActive: boolean;
  apiKey: string | null;
  baseUrl: string | null;
  sortOrder: number;
  defaultParams?: Record<string, unknown> | null;
}

interface ModelFormState {
  name: string;
  slug: string;
  provider: string;
  creditsPerGen: string;
  isActive: boolean;
  apiKey: string;
  baseUrl: string;
  sortOrder: string;
  defaultParamsText: string;
}

const EMPTY_FORM: ModelFormState = {
  name: "",
  slug: "",
  provider: "plato",
  creditsPerGen: "10",
  isActive: true,
  apiKey: "",
  baseUrl: "",
  sortOrder: "0",
  defaultParamsText: "{\n  \"duration\": 10,\n  \"allowedDurations\": [10, 15]\n}",
};

function formatDefaultParams(value: unknown): string {
  return JSON.stringify(value && typeof value === "object" ? value : {}, null, 2);
}

function parseForm(form: ModelFormState): {
  ok: true;
  payload: {
    name: string;
    slug: string;
    provider: string;
    creditsPerGen: number;
    isActive: boolean;
    apiKey: string | null;
    baseUrl: string | null;
    sortOrder: number;
    defaultParams: Record<string, unknown>;
  };
} | { ok: false; error: string } {
  const creditsPerGen = parseInt(form.creditsPerGen, 10);
  if (Number.isNaN(creditsPerGen) || creditsPerGen < 0) {
    return { ok: false, error: "积分配置不合法" };
  }

  const sortOrder = parseInt(form.sortOrder, 10);
  if (Number.isNaN(sortOrder)) {
    return { ok: false, error: "排序值不合法" };
  }

  let defaultParams: Record<string, unknown> = {};
  try {
    defaultParams = JSON.parse(form.defaultParamsText || "{}") as Record<string, unknown>;
  } catch {
    return { ok: false, error: "defaultParams 不是合法 JSON" };
  }

  if (!form.name.trim() || !form.slug.trim() || !form.provider.trim()) {
    return { ok: false, error: "名称、slug、provider 都必填" };
  }

  return {
    ok: true,
    payload: {
      name: form.name.trim(),
      slug: form.slug.trim(),
      provider: form.provider.trim(),
      creditsPerGen,
      isActive: form.isActive,
      apiKey: form.apiKey.trim() || null,
      baseUrl: form.baseUrl.trim() || null,
      sortOrder,
      defaultParams,
    },
  };
}

export default function AdminModelsPage() {
  const [modelList, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Model | null>(null);
  const [form, setForm] = useState<ModelFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/models");
    const data = await res.json();
    setModels(data.models ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  function updateForm<K extends keyof ModelFormState>(key: K, value: ModelFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openEdit(model: Model) {
    setCreating(false);
    setEditing(model);
    setError(null);
    setForm({
      name: model.name,
      slug: model.slug,
      provider: model.provider,
      creditsPerGen: String(model.creditsPerGen),
      isActive: model.isActive,
      apiKey: model.apiKey ?? "",
      baseUrl: model.baseUrl ?? "",
      sortOrder: String(model.sortOrder),
      defaultParamsText: formatDefaultParams(model.defaultParams),
    });
  }

  function openCreate() {
    setCreating(true);
    setEditing(null);
    setError(null);
    setForm(EMPTY_FORM);
  }

  function closeModal() {
    setCreating(false);
    setEditing(null);
    setError(null);
  }

  async function submitForm() {
    const parsed = parseForm(form);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/models", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editing
            ? { id: editing.id, ...parsed.payload }
            : parsed.payload,
        ),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `保存失败 (HTTP ${res.status})`);
        return;
      }

      closeModal();
      await fetchModels();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(model: Model) {
    await fetch("/api/admin/models", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: model.id, isActive: !model.isActive }),
    });
    fetchModels();
  }

  async function deleteModel(model: Model) {
    if (!confirm(`确定删除模型「${model.name}」？此操作不可恢复。`)) return;
    await fetch("/api/admin/models", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: model.id }),
    });
    fetchModels();
  }

  function maskKey(key: string | null): string {
    if (!key) return "—";
    if (key.length <= 8) return "••••••••";
    return key.slice(0, 4) + "••••" + key.slice(-4);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">管理后台</h1>
        <p className="text-sm text-[var(--vc-text-muted)]">模型服务配置现在由后台统一管理</p>
      </div>

      <AdminTabs />

      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--vc-text-muted)]">
          共 {modelList.length} 个模型配置
        </span>
        <button
          onClick={openCreate}
          className="vc-gradient-btn rounded-[var(--vc-radius-md)] px-4 py-2 text-sm"
        >
          + 新增模型
        </button>
      </div>

      <div className="overflow-x-auto rounded-[var(--vc-radius-lg)] border border-[var(--vc-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--vc-bg-surface)] text-[var(--vc-text-secondary)]">
            <tr>
              <th className="px-4 py-3 text-left">名称</th>
              <th className="px-4 py-3 text-left">Slug</th>
              <th className="px-4 py-3 text-left">Provider</th>
              <th className="px-4 py-3 text-right">积分/次</th>
              <th className="px-4 py-3 text-right">排序</th>
              <th className="px-4 py-3 text-left">Base URL</th>
              <th className="px-4 py-3 text-left">API Key</th>
              <th className="px-4 py-3 text-center">状态</th>
              <th className="px-4 py-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--vc-border)]">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[var(--vc-text-muted)]">
                  加载中...
                </td>
              </tr>
            ) : modelList.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[var(--vc-text-muted)]">
                  暂无模型配置，请添加
                </td>
              </tr>
            ) : (
              modelList.map((model) => (
                <tr key={model.id} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white">{model.name}</td>
                  <td className="px-4 py-3 font-mono text-zinc-300">{model.slug}</td>
                  <td className="px-4 py-3 text-zinc-300">{model.provider}</td>
                  <td className="px-4 py-3 text-right font-mono text-white">
                    {model.creditsPerGen}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-300">
                    {model.sortOrder}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                    {model.baseUrl || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                    {maskKey(model.apiKey)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        model.isActive
                          ? "bg-green-500/20 text-green-400"
                          : "bg-zinc-700 text-zinc-400"
                      }`}
                    >
                      {model.isActive ? "启用" : "停用"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEdit(model)}
                        className="rounded-[var(--vc-radius-sm)] bg-[var(--vc-bg-elevated)] px-2 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-600"
                      >
                        配置
                      </button>
                      <button
                        onClick={() => toggleActive(model)}
                        className={`rounded px-2 py-1 text-xs ${
                          model.isActive
                            ? "bg-red-600/80 text-white hover:bg-red-500"
                            : "bg-green-600/80 text-white hover:bg-green-500"
                        }`}
                      >
                        {model.isActive ? "停用" : "启用"}
                      </button>
                      <button
                        onClick={() => deleteModel(model)}
                        className="rounded bg-red-900/60 px-2 py-1 text-xs text-red-300 hover:bg-red-800"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(editing !== null || creating) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={closeModal}
        >
          <div
            className="vc-glass w-full max-w-2xl space-y-4 rounded-2xl p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white">
              {editing ? `配置模型：${editing.name}` : "新增模型"}
            </h2>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-zinc-400">显示名</label>
                <input
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--vc-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400">Slug</label>
                <input
                  value={form.slug}
                  onChange={(event) => updateForm("slug", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 font-mono text-sm text-white outline-none focus:border-[var(--vc-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400">Provider</label>
                <input
                  value={form.provider}
                  onChange={(event) => updateForm("provider", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 font-mono text-sm text-white outline-none focus:border-[var(--vc-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400">积分/次</label>
                <input
                  type="number"
                  min={0}
                  value={form.creditsPerGen}
                  onChange={(event) => updateForm("creditsPerGen", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--vc-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400">Base URL</label>
                <input
                  value={form.baseUrl}
                  onChange={(event) => updateForm("baseUrl", event.target.value)}
                  placeholder="https://api.bltcy.ai"
                  className="mt-1 w-full rounded-lg border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--vc-accent)] placeholder-zinc-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400">API Key</label>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={(event) => updateForm("apiKey", event.target.value)}
                  placeholder="sk-..."
                  className="mt-1 w-full rounded-lg border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--vc-accent)] placeholder-zinc-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400">排序</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) => updateForm("sortOrder", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--vc-accent)]"
                />
              </div>
              <label className="flex items-center gap-2 pt-6 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => updateForm("isActive", event.target.checked)}
                />
                启用该模型
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400">
                defaultParams(JSON)
              </label>
              <textarea
                value={form.defaultParamsText}
                onChange={(event) => updateForm("defaultParamsText", event.target.value)}
                rows={10}
                className="mt-1 w-full rounded-lg border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 font-mono text-sm text-white outline-none focus:border-[var(--vc-accent)]"
              />
              <p className="mt-2 text-xs text-zinc-500">
                可配置如 `orientation`、`duration`、`count`、`allowedDurations`
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeModal}
                className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white"
              >
                取消
              </button>
              <button
                onClick={submitForm}
                disabled={submitting}
                className="vc-gradient-btn rounded-lg px-4 py-2 text-sm disabled:opacity-50"
              >
                {submitting ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
