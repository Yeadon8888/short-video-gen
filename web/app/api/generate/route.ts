import { NextRequest } from "next/server";
import { generateScript } from "@/lib/gemini";
import { listAssets, isUploadGatewayEnabled } from "@/lib/storage/gateway";
import { createTasks, pollTasks } from "@/lib/video/plato";
import type { VideoParams } from "@/lib/video/types";
import { getWorkspaceIdFromHeaders } from "@/lib/workspace";

export const maxDuration = 300; // Vercel max

interface GenerateRequest {
  type: "video_b64" | "theme";
  input: string; // base64 video or theme text
  mime_type?: string;
  modification?: string;
  params: {
    orientation: "portrait" | "landscape";
    duration: 10 | 15;
    count: number;
  };
}

function sseData(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as GenerateRequest;
  const { type, input, mime_type, modification, params } = body;
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
          imageUrls = assets.map((asset) => asset.url);
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

        // ── Step 2: Gemini analysis ──
        send({ type: "stage", stage: "ANALYZE", message: "Gemini 分析中，请稍候..." });

        const scriptResult = await generateScript({
          type: type === "video_b64" ? "video" : "theme",
          videoB64: type === "video_b64" ? input : undefined,
          mimeType: mime_type,
          theme: type === "theme" ? input : undefined,
          modification,
          imageUrls: imageUrls.slice(0, 1), // Use first image
        });

        log(`Gemini 生成完成，共 ${scriptResult.shots?.length ?? 0} 个镜头`);
        send({ type: "script", data: scriptResult });

        // ── Step 3: Sora submission ──
        const videoParams: VideoParams = {
          prompt: scriptResult.full_sora_prompt,
          imageUrls: imageUrls.slice(0, 1),
          orientation: params.orientation,
          duration: params.duration,
          count: Math.min(Math.max(params.count, 1), 10),
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

        // ── Step 4: Poll ──
        send({ type: "stage", stage: "POLL", message: "等待视频生成..." });

        const results = await pollTasks(taskIds, log);

        // Check if all failed
        const allFailed = [...results.values()].every((r) => !r.success);
        if (allFailed) {
          send({
            type: "error",
            code: "SORA_UNAVAILABLE",
            message: "所有任务均失败",
            sora_prompt: scriptResult.full_sora_prompt,
          });
        } else {
          const videos = [...results.values()]
            .filter((r) => r.success)
            .map((r) => r.url);
          send({ type: "videos", urls: videos });
        }

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
