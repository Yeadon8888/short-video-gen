import { NextRequest } from "next/server";
import { generateScript, generateCopy } from "@/lib/gemini";
import { listAssets, isUploadGatewayEnabled, fetchAssetBuffer, loadWorkspacePrompts } from "@/lib/storage/gateway";
import { createTasks } from "@/lib/video/plato";
import type { VideoParams } from "@/lib/video/types";
import { getWorkspaceIdFromHeaders } from "@/lib/workspace";
import {
  isTikHubEnabled,
  looksLikeVideoUrl,
  extractUrl,
  downloadVideoFromUrl,
} from "@/lib/tikhub";

export const maxDuration = 300; // Vercel max

interface GenerateRequest {
  /** "theme" = 主题模式, "video_key" = 已上传视频 key, "url" = 抖音/TikTok 链接 */
  type: "theme" | "video_key" | "url";
  input: string;
  modification?: string;
  params: {
    orientation: "portrait" | "landscape";
    duration: 10 | 15;
    count: number;
    platform?: "douyin" | "tiktok";
    model?: string;
  };
}

function sseData(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as GenerateRequest;
  const { type, input, modification, params } = body;
  const workspaceId = getWorkspaceIdFromHeaders(req.headers);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: unknown) {
        controller.enqueue(encoder.encode(sseData(obj)));
      }
      function log(message: string) {
        send({ type: "log", message });
      }

      try {
        // ── Step 1: Get workspace reference images from upload gateway ──
        let imageUrls: string[] = [];
        if (isUploadGatewayEnabled()) {
          const assets = await listAssets(workspaceId);
          imageUrls = assets
            .filter((a) => /\.(jpe?g|png|gif|webp|bmp|tiff?)$/i.test(a.url))
            .map((a) => a.url);
          log(`工作区 ${workspaceId.slice(0, 8)} 参考图 ${imageUrls.length} 张`);
        }
        if (imageUrls.length === 0) {
          send({
            type: "error",
            code: "REFERENCE_IMAGE_REQUIRED",
            message: "请先上传至少 1 张参考图片，再开始生成视频。",
          });
          send({ type: "done" });
          controller.close();
          return;
        }

        // ── Step 2: Resolve video source (if applicable) ──
        let videoBuffer: ArrayBuffer | undefined;
        let videoMime: string | undefined;

        if (type === "url") {
          // URL mode: TikHub download
          send({ type: "stage", stage: "DOWNLOAD", message: "正在下载视频..." });
          if (!isTikHubEnabled()) {
            send({
              type: "error",
              code: "TIKHUB_NOT_CONFIGURED",
              message: "TIKHUB_API_KEY 未配置，无法解析视频链接。",
            });
            send({ type: "done" });
            controller.close();
            return;
          }
          const url = extractUrl(input);
          if (!url) {
            send({
              type: "error",
              code: "INVALID_URL",
              message: "未能从输入中提取有效的抖音/TikTok 链接。",
            });
            send({ type: "done" });
            controller.close();
            return;
          }
          const dl = await downloadVideoFromUrl(url, log);
          videoBuffer = dl.buffer;
          videoMime = dl.mimeType;
          log(`视频下载完成 (${dl.sizeMB.toFixed(1)} MB)`);
        } else if (type === "video_key") {
          // Video key mode: fetch from R2
          send({ type: "stage", stage: "DOWNLOAD", message: "正在获取视频..." });
          const fetched = await fetchAssetBuffer(input);
          videoBuffer = fetched.buffer;
          videoMime = fetched.mimeType;
          const sizeMB = fetched.buffer.byteLength / (1024 * 1024);
          log(`视频获取完成 (${sizeMB.toFixed(1)} MB)`);
        }

        // ── Step 3: Gemini analysis ──
        send({ type: "stage", stage: "ANALYZE", message: "Gemini 分析中，请稍候..." });

        // Fetch reference images as buffers for Gemini inline_data
        const imageBuffers: { buffer: ArrayBuffer; mimeType: string }[] = [];
        for (const url of imageUrls.slice(0, 1)) {
          try {
            const fetched = await fetchAssetBuffer(url);
            imageBuffers.push({ buffer: fetched.buffer, mimeType: fetched.mimeType });
          } catch (e) {
            log(`获取参考图片失败: ${String(e).slice(0, 100)}`);
          }
        }

        // Load per-workspace custom prompts (if any)
        const customPrompts = await loadWorkspacePrompts(workspaceId);
        const isVideoMode = type === "url" || type === "video_key";
        let promptTemplate: string | undefined;
        if (isVideoMode) {
          promptTemplate = modification
            ? customPrompts.video_remix_with_modification
            : customPrompts.video_remix_base;
        } else {
          promptTemplate = customPrompts.theme_to_video;
        }
        if (promptTemplate) {
          log("使用自定义 Prompt 模板");
        }

        const scriptResult = await generateScript({
          type: isVideoMode ? "video" : "theme",
          videoBuffer: isVideoMode ? videoBuffer : undefined,
          mimeType: isVideoMode ? videoMime : undefined,
          theme: type === "theme" ? input : undefined,
          modification,
          imageBuffers,
          promptTemplate,
          platform: params.platform,
        });

        log(`Gemini 生成完成，共 ${scriptResult.shots?.length ?? 0} 个镜头`);

        // If custom copy_generation prompt exists, regenerate copy separately
        if (customPrompts.copy_generation) {
          try {
            log("使用自定义文案 Prompt 重新生成文案...");
            const copy = await generateCopy(
              scriptResult.full_sora_prompt,
              customPrompts.copy_generation,
              params.platform
            );
            scriptResult.copy = copy;
            log("自定义文案生成完成");
          } catch (e) {
            log(`自定义文案生成失败，使用脚本自带文案: ${String(e).slice(0, 100)}`);
          }
        }

        send({ type: "script", data: scriptResult });

        // ── Step 4: Sora submission ──
        const soraPrompt =
          scriptResult.full_sora_prompt +
          " The product shown in the reference image must appear clearly and prominently in the video.";

        const videoParams: VideoParams = {
          prompt: soraPrompt,
          imageUrls: imageUrls.slice(0, 1),
          orientation: params.orientation,
          duration: params.duration,
          count: Math.min(Math.max(params.count, 1), 10),
          model: params.model,
        };

        send({ type: "stage", stage: "GENERATE", message: "提交 Sora 任务..." });

        let taskIds: string[];
        try {
          taskIds = await createTasks(videoParams);
          log(`任务已提交: ${taskIds.join(", ")}`);
        } catch (e) {
          send({
            type: "error",
            code: "SORA_UNAVAILABLE",
            message: String(e).slice(0, 200),
            sora_prompt: scriptResult.full_sora_prompt,
          });
          send({ type: "done" });
          controller.close();
          return;
        }

        // ── Step 5: Return task IDs (client polls /api/generate/status) ──
        send({
          type: "tasks",
          taskIds,
          sora_prompt: soraPrompt,
        });

        send({ type: "done" });
        controller.close();
      } catch (e) {
        send({ type: "error", code: "INTERNAL", message: String(e).slice(0, 300) });
        send({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
