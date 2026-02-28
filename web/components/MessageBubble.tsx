"use client";

import type { ScriptResult } from "@/lib/gemini";
import ProcessLog from "./ProcessLog";
import ScriptOutput from "./ScriptOutput";
import CopySection from "./CopySection";
import FallbackNotice from "./FallbackNotice";

export type MessageRole = "user" | "ai";

export interface VideoResult {
  urls: string[];
}

export interface ErrorResult {
  code: string;
  message?: string;
  sora_prompt?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  text?: string;
  logs?: string[];
  script?: ScriptResult;
  videos?: VideoResult;
  error?: ErrorResult;
  isLoading?: boolean;
  stage?: string;
}

interface MessageBubbleProps {
  message: Message;
}

const STAGE_LABELS: Record<string, string> = {
  ANALYZE: "Gemini 分析中...",
  GENERATE: "提交 Sora 任务...",
  POLL: "等待视频生成...",
};

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-xs rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white"
          style={{ background: "linear-gradient(135deg, #7C3AED, #2563EB)" }}
        >
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-2xl space-y-3">
        {/* Simple text message */}
        {message.text && (
          <div
            className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-200"
            style={{ background: "#13131A", border: "1px solid #1E1E2E" }}
          >
            {message.text}
          </div>
        )}

        {/* Stage indicator */}
        {message.isLoading && message.stage && STAGE_LABELS[message.stage] && (
          <div className="flex items-center gap-2 text-sm text-purple-light">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{
                background: "#A78BFA",
                animation: "blink 1s step-end infinite",
              }}
            />
            {STAGE_LABELS[message.stage]}
          </div>
        )}

        {/* Process logs */}
        {(message.logs?.length ?? 0) > 0 && (
          <ProcessLog logs={message.logs!} isLoading={message.isLoading} />
        )}

        {/* Script output */}
        {message.script && <ScriptOutput data={message.script} />}

        {/* Copy section */}
        {message.script?.copy && (
          <CopySection
            title={message.script.copy.title}
            caption={message.script.copy.caption}
            firstComment={message.script.copy.first_comment}
          />
        )}

        {/* Video results */}
        {message.videos && message.videos.urls.length > 0 && (
          <div className="space-y-2">
            {message.videos.urls.map((url, i) => (
              <div key={i} className="rounded-xl overflow-hidden">
                <video
                  src={url}
                  controls
                  className="w-full rounded-xl"
                  style={{ maxHeight: "480px" }}
                />
                <div className="flex justify-end mt-1">
                  <a
                    href={url}
                    download
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    下载视频 →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Fallback notice */}
        {message.error?.code === "SORA_UNAVAILABLE" && message.error.sora_prompt && (
          <FallbackNotice
            soraPrompt={message.error.sora_prompt}
            message={message.error.message}
          />
        )}

        {/* Generic error */}
        {message.error && message.error.code !== "SORA_UNAVAILABLE" && (
          <div
            className="rounded-xl p-4 text-sm text-red-400"
            style={{ background: "#EF444411", border: "1px solid #EF444433" }}
          >
            {message.error.message ?? "发生未知错误"}
          </div>
        )}
      </div>
    </div>
  );
}
