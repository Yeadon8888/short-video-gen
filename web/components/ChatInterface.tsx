"use client";

import { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import MessageBubble, { type Message } from "./MessageBubble";
import ParamBar from "./ParamBar";
import ImageManager from "./ImageManager";
import PromptEditor from "./PromptEditor";
import type { ScriptResult } from "@/lib/gemini";
import {
  WORKSPACE_HEADER,
  isValidInviteCode,
  getSavedInviteCode,
  saveInviteCode,
  workspaceIdFromInvite,
} from "@/lib/workspace";

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "ai",
  text: "你好！我可以帮你生成短视频。\n\n• 输入创意主题 → 直接生成\n• 粘贴抖音/TikTok 链接 → 二创视频\n• 上传本地视频文件 → 二创视频",
};

interface Params {
  orientation: "portrait" | "landscape";
  duration: 10 | 15;
  count: number;
}

interface SSEEvent {
  type: string;
  message?: string;
  stage?: string;
  data?: ScriptResult;
  urls?: string[];
  code?: string;
  sora_prompt?: string;
  taskIds?: string[];
}

/** Detect Douyin / TikTok share URLs */
const VIDEO_URL_PATTERN =
  /https?:\/\/[^\s<>"']*(?:douyin|tiktok|v\.douyin)[^\s<>"']*/i;

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [imageManagerOpen, setImageManagerOpen] = useState(false);
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState("");
  const [imageCount, setImageCount] = useState(0);
  const [gatewayEnabled, setGatewayEnabled] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [params, setParams] = useState<Params>({
    orientation: "portrait",
    duration: 15,
    count: 1,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const saved = getSavedInviteCode();
    if (saved) {
      setAuthorized(true);
      setWorkspaceId(workspaceIdFromInvite(saved));
    }
  }, []);

  useEffect(() => {
    if (workspaceId) {
      void refreshImageState(workspaceId);
    }
  }, [workspaceId]);

  function updateLastAiMessage(updater: (msg: Message) => Message) {
    setMessages((prev) => {
      const copy = [...prev];
      const lastIdx = copy.findLastIndex((m) => m.role === "ai" && m.id !== "welcome");
      if (lastIdx !== -1) {
        copy[lastIdx] = updater(copy[lastIdx]);
      }
      return copy;
    });
  }

  async function refreshImageState(activeWorkspaceId: string) {
    const res = await fetch("/api/images", {
      headers: {
        [WORKSPACE_HEADER]: activeWorkspaceId,
      },
    });
    const data = await res.json();
    setImageCount((data.urls ?? []).length);
    setGatewayEnabled(data.gateway_enabled ?? false);
  }

  async function sendRequest(body: {
    type: "theme" | "video_key" | "url";
    input: string;
    modification?: string;
  }) {
    if (!workspaceId) return;
    setIsLoading(true);

    // Add AI placeholder message
    const aiMsgId = uuidv4();
    setMessages((prev) => [
      ...prev,
      {
        id: aiMsgId,
        role: "ai",
        logs: [],
        isLoading: true,
        stage: "ANALYZE",
      },
    ]);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [WORKSPACE_HEADER]: workspaceId,
        },
        body: JSON.stringify({ ...body, params }),
      });

      if (!res.ok) {
        updateLastAiMessage((msg) => ({
          ...msg,
          isLoading: false,
          error: { code: "HTTP_ERROR", message: `请求失败: HTTP ${res.status}` },
        }));
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json) continue;

          let event: SSEEvent;
          try {
            event = JSON.parse(json);
          } catch {
            continue;
          }

          if (event.type === "stage") {
            updateLastAiMessage((msg) => ({ ...msg, stage: event.stage }));
          } else if (event.type === "log") {
            updateLastAiMessage((msg) => ({
              ...msg,
              logs: [...(msg.logs ?? []), event.message ?? ""],
            }));
          } else if (event.type === "script") {
            updateLastAiMessage((msg) => ({ ...msg, script: event.data }));
          } else if (event.type === "videos") {
            updateLastAiMessage((msg) => ({
              ...msg,
              videos: { urls: event.urls ?? [] },
            }));
          } else if (event.type === "tasks") {
            // Server submitted Sora tasks; start client-side polling
            const taskIds = event.taskIds ?? [];
            const soraPrompt = event.sora_prompt;
            if (taskIds.length > 0) {
              pollingRef.current = true;
              updateLastAiMessage((msg) => ({
                ...msg,
                stage: "POLL",
                logs: [...(msg.logs ?? []), `任务已提交: ${taskIds.join(", ").slice(0, 60)}`],
              }));
              pollSoraTasks(taskIds, soraPrompt);
            }
          } else if (event.type === "error") {
            updateLastAiMessage((msg) => ({
              ...msg,
              error: {
                code: event.code ?? "UNKNOWN",
                message: event.message,
                sora_prompt: event.sora_prompt,
              },
            }));
          } else if (event.type === "done") {
            // If polling is active, keep loading state for client-side polling
            if (!pollingRef.current) {
              updateLastAiMessage((msg) => ({ ...msg, isLoading: false }));
            }
          }
        }
      }
    } catch (e) {
      updateLastAiMessage((msg) => ({
        ...msg,
        isLoading: false,
        error: { code: "NETWORK", message: String(e) },
      }));
      pollingRef.current = false;
    } finally {
      if (!pollingRef.current) {
        setIsLoading(false);
      }
    }
  }

  async function pollSoraTasks(taskIds: string[], soraPrompt?: string) {
    const POLL_INTERVAL = 15_000;
    const MAX_POLLS = 40; // 40 × 15s = 10 min
    const STALE_LIMIT = 5; // give up after 5 consecutive polls with no progress change

    let lastProgressKey = "";
    let staleCount = 0;

    for (let poll = 0; poll < MAX_POLLS; poll++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));

      try {
        const res = await fetch(
          `/api/generate/status?taskIds=${encodeURIComponent(taskIds.join(","))}`
        );
        if (!res.ok) {
          updateLastAiMessage((msg) => ({
            ...msg,
            logs: [...(msg.logs ?? []), `[轮询] #${poll + 1} 失败: HTTP ${res.status}`],
          }));
          continue;
        }

        const data = await res.json();
        const results = data.results as Array<{
          taskId: string;
          status: string;
          progress: string;
          url?: string;
          failReason?: string;
        }>;

        // Build progress summary log
        const progressParts = results.map(
          (r) => `${r.taskId.slice(0, 14)}... 状态=${r.status} 进度=${r.progress}`
        );
        for (const part of progressParts) {
          updateLastAiMessage((msg) => ({
            ...msg,
            logs: [...(msg.logs ?? []), `[轮询] ${part}`],
          }));
        }

        // Check if all tasks are done
        if (data.allDone) {
          const successUrls = results
            .filter((r) => r.status === "SUCCESS" && r.url)
            .map((r) => r.url!);

          if (successUrls.length > 0) {
            updateLastAiMessage((msg) => ({
              ...msg,
              isLoading: false,
              videos: { urls: successUrls },
            }));
          } else {
            const failReasons = results
              .filter((r) => r.status === "FAILED")
              .map((r) => r.failReason ?? "未知原因")
              .join("; ");
            updateLastAiMessage((msg) => ({
              ...msg,
              isLoading: false,
              error: {
                code: "SORA_FAILED",
                message: `视频生成失败: ${failReasons}`,
                sora_prompt: soraPrompt,
              },
            }));
          }

          pollingRef.current = false;
          setIsLoading(false);
          return;
        }

        // Stale progress detection: give up only when progress stops moving
        const currentProgressKey = results
          .map((r) => `${r.taskId}:${r.status}:${r.progress}`)
          .join("|");

        if (currentProgressKey === lastProgressKey) {
          staleCount++;
          if (staleCount >= STALE_LIMIT) {
            updateLastAiMessage((msg) => ({
              ...msg,
              isLoading: false,
              error: {
                code: "POLL_STALE",
                message: `视频生成进度停滞（连续 ${STALE_LIMIT} 次无变化），请检查任务后台或稍后重试。`,
                sora_prompt: soraPrompt,
              },
            }));
            pollingRef.current = false;
            setIsLoading(false);
            return;
          }
        } else {
          staleCount = 0;
          lastProgressKey = currentProgressKey;
        }
      } catch (e) {
        updateLastAiMessage((msg) => ({
          ...msg,
          logs: [...(msg.logs ?? []), `[轮询] 异常: ${String(e).slice(0, 100)}`],
        }));
      }
    }

    // Hard timeout after 10 minutes
    updateLastAiMessage((msg) => ({
      ...msg,
      isLoading: false,
      error: {
        code: "POLL_TIMEOUT",
        message: "视频生成超时（已等待 10 分钟），请检查任务后台。",
        sora_prompt: soraPrompt,
      },
    }));
    pollingRef.current = false;
    setIsLoading(false);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");

    // Detect if user pasted a video URL
    const isUrl = VIDEO_URL_PATTERN.test(text);

    setMessages((prev) => [
      ...prev,
      { id: uuidv4(), role: "user", text: isUrl ? `🔗 ${text}` : text },
    ]);

    await sendRequest({
      type: isUrl ? "url" : "theme",
      input: text,
    });
  }

  async function handleVideoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    const modification = input.trim() || undefined;
    setInput("");

    setMessages((prev) => [
      ...prev,
      { id: uuidv4(), role: "user", text: `📎 ${file.name}` },
    ]);

    // Upload video to R2 gateway instead of base64-encoding on client
    const aiMsgId = uuidv4();
    setMessages((prev) => [
      ...prev,
      { id: aiMsgId, role: "ai", logs: ["正在上传视频..."], isLoading: true, stage: "DOWNLOAD" },
    ]);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/images", {
        method: "POST",
        headers: { [WORKSPACE_HEADER]: workspaceId },
        body: formData,
      });
      if (!uploadRes.ok) {
        updateLastAiMessage((msg) => ({
          ...msg,
          isLoading: false,
          error: { code: "UPLOAD_FAILED", message: `视频上传失败: HTTP ${uploadRes.status}` },
        }));
        return;
      }

      const asset = await uploadRes.json();
      const videoUrl = asset.url as string;
      updateLastAiMessage((msg) => ({
        ...msg,
        logs: [...(msg.logs ?? []), `视频已上传 (${(file.size / 1024 / 1024).toFixed(1)} MB)`],
      }));

      // Remove the upload placeholder and send the real request
      setMessages((prev) => prev.filter((m) => m.id !== aiMsgId));
      setIsLoading(false);

      await sendRequest({
        type: "video_key",
        input: videoUrl,
        modification,
      });
    } catch (err) {
      updateLastAiMessage((msg) => ({
        ...msg,
        isLoading: false,
        error: { code: "UPLOAD_FAILED", message: String(err) },
      }));
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!authorized) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: "#0A0A0F" }}
      >
        <div className="w-80 space-y-4 text-center">
          <div className="text-lg font-semibold gradient-text">VidClaw 内测</div>
          <input
            type="text"
            value={inviteInput}
            onChange={(e) => { setInviteInput(e.target.value); setInviteError(""); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const code = inviteInput.trim();
                if (isValidInviteCode(code)) {
                  saveInviteCode(code);
                  setAuthorized(true);
                  setWorkspaceId(workspaceIdFromInvite(code));
                } else {
                  setInviteError("邀请码无效");
                }
              }
            }}
            placeholder="请输入邀请码"
            className="w-full px-4 py-3 rounded-xl text-white text-center text-sm outline-none"
            style={{ background: "#1E1E2E", border: "1px solid #2D2D44" }}
          />
          {inviteError && <div className="text-red-400 text-sm">{inviteError}</div>}
          <button
            onClick={() => {
              const code = inviteInput.trim();
              if (isValidInviteCode(code)) {
                saveInviteCode(code);
                setAuthorized(true);
                setWorkspaceId(workspaceIdFromInvite(code));
              } else {
                setInviteError("邀请码无效");
              }
            }}
            className="w-full px-4 py-3 rounded-xl text-white font-medium text-sm"
            style={{ background: "linear-gradient(135deg, #7C3AED, #2563EB)" }}
          >
            进入
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: "#0A0A0F" }}>
      {/* Nav */}
      <nav
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid #1E1E2E", background: "#13131A" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <span className="font-semibold gradient-text">VidClaw</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">
            {workspaceId ? `工作区 ${workspaceId}` : "初始化中..."}
          </span>
          <button
            onClick={() => setImageManagerOpen(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-all hover:text-white text-slate-400"
            style={{ background: "#1E1E2E" }}
            title="参考图片管理"
          >
            <span>🖼</span>
            <span>参考图</span>
          </button>
          <button
            onClick={() => setPromptEditorOpen(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-all hover:text-white text-slate-400"
            style={{ background: "#1E1E2E" }}
            title="自定义 Prompt"
          >
            <span>✏️</span>
            <span>Prompt</span>
          </button>
        </div>
      </nav>

      <div className="px-4 py-4 shrink-0" style={{ background: "#101018", borderBottom: "1px solid #1E1E2E" }}>
        <div className="max-w-5xl mx-auto grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl p-4" style={{ background: "#161622", border: "1px solid #242438" }}>
            <div className="text-xs text-slate-400 mb-2">Step 1</div>
            <div className="text-white font-semibold">先上传参考图</div>
            <div className="text-sm text-slate-400 mt-2">
              当前 {imageCount} 张。柏拉图这条链路不再支持无参考图直出。
            </div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "#161622", border: "1px solid #242438" }}>
            <div className="text-xs text-slate-400 mb-2">Step 2</div>
            <div className="text-white font-semibold">输入主题、链接或上传视频</div>
            <div className="text-sm text-slate-400 mt-2">
              支持粘贴抖音/TikTok 链接二创，Gemini 拆脚本，柏拉图 Sora2 生成。
            </div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "#161622", border: "1px solid #242438" }}>
            <div className="text-xs text-slate-400 mb-2">Step 3</div>
            <div className="text-white font-semibold">等任务回片并下载</div>
            <div className="text-sm text-slate-400 mt-2">
              默认模型 `sora-2`，更稳。失败时会保留脚本方便重试。
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div
        className="shrink-0 px-4 py-4"
        style={{ borderTop: "1px solid #1E1E2E", background: "#13131A" }}
      >
        <div className="max-w-2xl mx-auto space-y-3">
          {/* Param bar */}
          <ParamBar params={params} onChange={setParams} />

          {!gatewayEnabled && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ background: "#D9770611", border: "1px solid #D9770644", color: "#FBBF24" }}
            >
              上传网关还没配置好，先完成 Cloudflare Worker 和 `UPLOAD_API_URL` / `UPLOAD_API_KEY`。
            </div>
          )}

          {gatewayEnabled && imageCount === 0 && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ background: "#2563EB11", border: "1px solid #2563EB44", color: "#BFDBFE" }}
            >
              先点右上角“参考图”上传至少 1 张产品图或风格图，之后再发主题或视频。
            </div>
          )}

          {/* Text input + actions */}
          <div
            className="flex items-end gap-2 rounded-xl p-2"
            style={{ background: "#0A0A0F", border: "1px solid #1E1E2E" }}
          >
            {/* Video upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || !authorized || imageCount === 0}
              className="p-2 rounded-lg text-slate-400 hover:text-white transition-colors shrink-0 disabled:opacity-40"
              title="上传视频进行二创"
            >
              📎
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleVideoFile}
            />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={imageCount === 0 ? "先上传参考图，再输入主题、粘贴链接或上传视频..." : "输入创意主题，粘贴抖音/TikTok 链接，或上传视频..."}
              rows={1}
              disabled={isLoading || !authorized || imageCount === 0}
              className="flex-1 resize-none bg-transparent text-white placeholder-slate-500 text-sm outline-none py-2 max-h-32"
              style={{ lineHeight: "1.5" }}
            />

            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || !authorized || imageCount === 0}
              className="shrink-0 px-4 py-2 rounded-lg font-medium text-sm text-white transition-all disabled:opacity-40"
              style={{
                background: isLoading
                  ? "#5B21B6"
                  : "linear-gradient(135deg, #7C3AED, #2563EB)",
              }}
            >
              {isLoading ? "生成中..." : "发送"}
            </button>
          </div>
        </div>
      </div>

      {/* Image manager drawer */}
      <ImageManager
        isOpen={imageManagerOpen}
        onClose={() => setImageManagerOpen(false)}
        workspaceId={workspaceId}
        onImagesChange={(count, enabled) => {
          setImageCount(count);
          setGatewayEnabled(enabled);
        }}
      />

      {/* Prompt editor */}
      <PromptEditor
        isOpen={promptEditorOpen}
        onClose={() => setPromptEditorOpen(false)}
        workspaceId={workspaceId}
      />
    </div>
  );
}
