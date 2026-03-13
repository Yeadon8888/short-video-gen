"use client";

import { useState, useEffect } from "react";

interface PromptEditorProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

interface Prompts {
  video_remix_base?: string;
  video_remix_with_modification?: string;
  theme_to_video?: string;
  copy_generation?: string;
}

const SECTIONS: {
  key: keyof Prompts;
  label: string;
  description: string;
  placeholder: string;
}[] = [
  {
    key: "theme_to_video",
    label: "主题原创",
    description: "用户只输入主题文字时使用。占位符 {{THEME}} 会被替换为主题内容。",
    placeholder: "留空使用默认 Prompt…",
  },
  {
    key: "video_remix_base",
    label: "视频二创（无修改建议）",
    description: "用户上传视频/链接、没有修改建议时使用。",
    placeholder: "留空使用默认 Prompt…",
  },
  {
    key: "video_remix_with_modification",
    label: "视频二创（有修改建议）",
    description:
      "用户上传视频/链接、带修改建议时使用。占位符 {{MODIFICATION_PROMPT}} 会被替换为修改内容。",
    placeholder: "留空使用默认 Prompt…",
  },
  {
    key: "copy_generation",
    label: "文案生成",
    description:
      "根据 Sora 脚本独立生成标题/文案/首评。占位符 {{SORA_PROMPT}} 会被替换为生成的 Sora 提示词。留空则使用脚本中自带的文案。",
    placeholder: "留空使用脚本自带文案…",
  },
];

export default function PromptEditor({ isOpen, onClose, workspaceId }: PromptEditorProps) {
  const [prompts, setPrompts] = useState<Prompts>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen && workspaceId) void fetchPrompts();
  }, [isOpen, workspaceId]);

  async function fetchPrompts() {
    setLoading(true);
    try {
      const res = await fetch("/api/prompts", {
        headers: { "x-workspace-id": workspaceId },
      });
      if (res.ok) {
        const data = await res.json();
        setPrompts(data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/prompts", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceId,
        },
        body: JSON.stringify(prompts),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleChange(key: keyof Prompts, value: string) {
    setPrompts((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#1a1a2e] text-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold">自定义 Prompt</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {loading ? (
            <p className="text-gray-400 text-center py-8">加载中...</p>
          ) : (
            <>
              <p className="text-sm text-gray-400">
                每个区块可以单独定制。留空则使用系统默认 Prompt。只需写创意指令和风格要求，系统会自动追加 JSON 输出格式。
              </p>
              {SECTIONS.map((section) => (
                <div key={section.key}>
                  <label className="block text-sm font-medium text-purple-300 mb-1">
                    {section.label}
                  </label>
                  <p className="text-xs text-gray-500 mb-2">{section.description}</p>
                  <textarea
                    className="w-full bg-[#0f0f23] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500 resize-y"
                    rows={6}
                    value={prompts[section.key] ?? ""}
                    onChange={(e) => handleChange(section.key, e.target.value)}
                    placeholder={section.placeholder}
                  />
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          {saved && (
            <span className="text-sm text-green-400">已保存 ✓</span>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
          >
            关闭
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg transition"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
