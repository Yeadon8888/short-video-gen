"use client";

import { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import MessageBubble, { type Message } from "./MessageBubble";
import ParamBar from "./ParamBar";
import ImageManager from "./ImageManager";
import type { ScriptResult } from "@/lib/gemini";

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

interface ChatInterfaceProps {
  userName: string;
}

export default function ChatInterface({ userName }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [imageManagerOpen, setImageManagerOpen] = useState(false);
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

  async function sendRequest(body: {
    type: "video_b64" | "theme";
    input: string;
    mime_type?: string;
    modification?: string;
  }) {
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
        headers: { "Content-Type": "application/json" },
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
          <span className="text-sm text-slate-400">{userName}</span>
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

          {/* Text input + actions */}
          <div
            className="flex items-end gap-2 rounded-xl p-2"
            style={{ background: "#0A0A0F", border: "1px solid #1E1E2E" }}
          >
            {/* Video upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
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
              placeholder="输入创意主题，或上传视频进行二创..."
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none bg-transparent text-white placeholder-slate-500 text-sm outline-none py-2 max-h-32"
              style={{ lineHeight: "1.5" }}
            />

            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
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
      />
    </div>
  );
}
