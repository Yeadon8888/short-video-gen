"use client";

import { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import MessageBubble, { type Message } from "./MessageBubble";
import ParamBar from "./ParamBar";
import ImageManager from "./ImageManager";
import type { ScriptResult } from "@/lib/gemini";
import { getBrowserWorkspaceId, WORKSPACE_HEADER } from "@/lib/workspace";

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "ai",
  text: "你好！我可以帮你生成短视频。告诉我一个创意主题，或上传视频文件进行二创。",
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
}

const INVITE_CODE = "1214";
const INVITE_STORAGE_KEY = "vidclaw_invite_verified";

export default function ChatInterface() {
  const [authorized, setAuthorized] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [imageManagerOpen, setImageManagerOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState("");
  const [imageCount, setImageCount] = useState(0);
  const [gatewayEnabled, setGatewayEnabled] = useState(true);
  const [params, setParams] = useState<Params>({
    orientation: "portrait",
    duration: 15,
    count: 1,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(INVITE_STORAGE_KEY) === "true") {
      setAuthorized(true);
    }
  }, []);

  useEffect(() => {
    setWorkspaceId(getBrowserWorkspaceId());
  }, []);

  function handleInviteSubmit() {
    if (inviteInput.trim() === INVITE_CODE) {
      localStorage.setItem(INVITE_STORAGE_KEY, "true");
      setAuthorized(true);
      setInviteError("");
    } else {
      setInviteError("邀请码不正确，请重新输入");
    }
  }

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
    type: "video_b64" | "theme";
    input: string;
    mime_type?: string;
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
            updateLastAiMessage((msg) => ({ ...msg, isLoading: false }));
          }
        }
      }
    } catch (e) {
      updateLastAiMessage((msg) => ({
        ...msg,
        isLoading: false,
        error: { code: "NETWORK", message: String(e) },
      }));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");

    // Add user message
    setMessages((prev) => [
      ...prev,
      { id: uuidv4(), role: "user", text },
    ]);

    await sendRequest({ type: "theme", input: text });
  }

  async function handleVideoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    // Add user message
    setMessages((prev) => [
      ...prev,
      { id: uuidv4(), role: "user", text: `📎 ${file.name}` },
    ]);

    // Encode to base64
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);

    await sendRequest({
      type: "video_b64",
      input: b64,
      mime_type: file.type || "video/mp4",
      modification: input.trim() || undefined,
    });
    setInput("");
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
        <div
          className="flex flex-col items-center gap-6 p-8 rounded-2xl w-full max-w-sm"
          style={{ background: "#13131A", border: "1px solid #1E1E2E" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <span className="text-xl font-semibold gradient-text">VidClaw</span>
          </div>
          <p className="text-slate-400 text-sm text-center">
            请输入邀请码以继续使用
          </p>
          <input
            type="text"
            value={inviteInput}
            onChange={(e) => {
              setInviteInput(e.target.value);
              setInviteError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleInviteSubmit();
            }}
            placeholder="请输入邀请码"
            className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-purple-500"
            style={{ background: "#0A0A0F", border: "1px solid #2A2A3E" }}
          />
          {inviteError && (
            <p className="text-red-400 text-xs">{inviteError}</p>
          )}
          <button
            onClick={handleInviteSubmit}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #7C3AED, #3B82F6)",
            }}
          >
            验证
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
            {workspaceId ? `工作区 ${workspaceId.slice(0, 8)}` : "初始化中..."}
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
            <div className="text-white font-semibold">输入主题或上传原视频</div>
            <div className="text-sm text-slate-400 mt-2">
              Gemini 先拆脚本，再交给柏拉图 Sora2 生成。
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
              disabled={isLoading || !workspaceId || imageCount === 0}
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
              placeholder={imageCount === 0 ? "先上传参考图，再输入创意主题或上传视频..." : "输入创意主题，或上传视频进行二创..."}
              rows={1}
              disabled={isLoading || !workspaceId || imageCount === 0}
              className="flex-1 resize-none bg-transparent text-white placeholder-slate-500 text-sm outline-none py-2 max-h-32"
              style={{ lineHeight: "1.5" }}
            />

            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || !workspaceId || imageCount === 0}
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
    </div>
  );
}
