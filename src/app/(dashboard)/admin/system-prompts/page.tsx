"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCcw, Save, Settings2 } from "lucide-react";
import { AdminTabs } from "@/components/admin/AdminTabs";

type SystemPromptKey = string;

interface SystemPromptDefinition {
  key: SystemPromptKey;
  label: string;
  group: string;
  description: string;
}

type PromptMap = Record<SystemPromptKey, string>;

interface SystemPromptsResponse {
  definitions: SystemPromptDefinition[];
  prompts: PromptMap;
  defaults: PromptMap;
}

export default function AdminSystemPromptsPage() {
  const [definitions, setDefinitions] = useState<SystemPromptDefinition[]>([]);
  const [prompts, setPrompts] = useState<PromptMap>({});
  const [defaults, setDefaults] = useState<PromptMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const groupedDefinitions = useMemo(() => {
    const groups = new Map<string, SystemPromptDefinition[]>();
    for (const definition of definitions) {
      const list = groups.get(definition.group) ?? [];
      list.push(definition);
      groups.set(definition.group, list);
    }
    return Array.from(groups.entries());
  }, [definitions]);

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/system-prompts", { cache: "no-store" });
      if (!res.ok) throw new Error("加载失败");
      const data = (await res.json()) as SystemPromptsResponse;
      setDefinitions(data.definitions);
      setPrompts(data.prompts);
      setDefaults(data.defaults);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPrompts();
  }, [fetchPrompts]);

  function updatePrompt(key: SystemPromptKey, value: string) {
    setPrompts((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/system-prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts }),
      });
      if (!res.ok) throw new Error("保存失败");
      const data = (await res.json()) as Pick<SystemPromptsResponse, "prompts">;
      setPrompts(data.prompts);
      setMessage("已保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  function resetToCodeDefaults() {
    setPrompts(defaults);
    setMessage("已恢复为代码默认值，保存后生效");
  }

  return (
    <div className="space-y-6">
      <AdminTabs />

      <div className="px-4 md:px-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
              <Settings2 className="h-5 w-5 text-[var(--vc-accent)]" />
              系统 Prompt
            </h1>
            <p className="mt-1 text-sm text-[var(--vc-text-muted)]">
              这里展示的内容默认等于代码内置 Prompt。用户设置里的自定义 Prompt 仍会优先覆盖。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetToCodeDefaults}
              disabled={loading || saving}
              className="inline-flex items-center gap-1.5 rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] px-3 py-2 text-sm text-[var(--vc-text-secondary)] transition-colors hover:border-[var(--vc-accent)] hover:text-white disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              恢复代码默认值
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saving}
              className="vc-gradient-btn inline-flex items-center gap-1.5 rounded-[var(--vc-radius-md)] px-4 py-2 text-sm disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-4 rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] px-3 py-2 text-sm text-[var(--vc-text-secondary)]">
            {message}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-[var(--vc-text-muted)]">加载中...</div>
        ) : (
          <div className="space-y-6">
            {groupedDefinitions.map(([group, items]) => (
              <section key={group} className="space-y-3">
                <h2 className="text-sm font-semibold text-[var(--vc-accent)]">{group}</h2>
                <div className="grid gap-4">
                  {items.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-[var(--vc-radius-lg)] border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-4"
                    >
                      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <label
                            htmlFor={`prompt-${item.key}`}
                            className="text-sm font-medium text-white"
                          >
                            {item.label}
                          </label>
                          <p className="mt-1 text-xs text-[var(--vc-text-muted)]">
                            {item.description}
                          </p>
                        </div>
                        <span className="font-mono text-xs text-[var(--vc-text-dim)]">
                          {item.key}
                        </span>
                      </div>
                      <textarea
                        id={`prompt-${item.key}`}
                        value={prompts[item.key] ?? ""}
                        onChange={(event) => updatePrompt(item.key, event.target.value)}
                        rows={item.key.startsWith("scene_") ? 5 : 10}
                        className="min-h-32 w-full resize-y rounded-[var(--vc-radius-md)] border border-[var(--vc-border)] bg-[var(--vc-bg-root)] px-3 py-2 font-mono text-xs leading-relaxed text-zinc-200 outline-none transition-colors placeholder:text-[var(--vc-text-dim)] focus:border-[var(--vc-accent)]"
                        placeholder="留空保存后将回到代码默认值"
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
