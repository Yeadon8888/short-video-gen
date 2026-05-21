import { NextRequest, NextResponse } from "next/server";
import { analyzeLimiter } from "@/lib/rate-limit";
import { generateScript } from "@/lib/gemini";
import { fetchAssetBuffer } from "@/lib/storage/gateway";
import {
  isTikHubEnabled,
  extractUrl,
  downloadVideoFromUrl,
} from "@/lib/tikhub";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks, creditTxns, users } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getActiveModelByCapability } from "@/lib/models/repository";
import { MODEL_CAPABILITIES } from "@/lib/models/capabilities";
import type { OutputLanguage } from "@/lib/video/types";

export const maxDuration = 300;

function sseData(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(req: NextRequest) {
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = analyzeLimiter.check(clientIp);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试。" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  // Auth — need userId to save task
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const body = (await req.json()) as {
    url?: string;
    outputLanguage?: OutputLanguage;
    platform?: "douyin" | "tiktok";
  };

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
        if (!body.url?.trim()) {
          send({ type: "error", message: "请输入视频链接。" });
          send({ type: "done" });
          controller.close();
          return;
        }

        // ── 解析计费模型 + 余额预检(失败则不走分析,不浪费上游成本)──
        const analyzeModel = await getActiveModelByCapability({
          capability: MODEL_CAPABILITIES.scriptGeneration,
        });
        const cost = analyzeModel.creditsPerGen;
        if (user.credits < cost) {
          send({
            type: "error",
            code: "INSUFFICIENT_CREDITS",
            message: `积分不足。视频分析需要 ${cost} 积分,当前余额 ${user.credits}。`,
          });
          send({ type: "done" });
          controller.close();
          return;
        }

        send({ type: "stage", stage: "DOWNLOAD", message: "正在解析视频链接..." });

        let videoBuffer: ArrayBuffer;
        let videoMime: string;

        const rawUrl = body.url.trim();

        const isDirectVideo =
          /\.(mp4|mov|webm)(\?|$)/i.test(rawUrl) &&
          !rawUrl.includes("douyin") &&
          !rawUrl.includes("tiktok");

        if (isDirectVideo) {
          const fetched = await fetchAssetBuffer(rawUrl);
          videoBuffer = fetched.buffer;
          videoMime = fetched.mimeType;
          const sizeMB = videoBuffer.byteLength / (1024 * 1024);
          log(`视频获取完成 (${sizeMB.toFixed(1)} MB)`);
        } else {
          if (!isTikHubEnabled()) {
            send({
              type: "error",
              message: "暂不支持该视频链接，请上传视频文件或使用抖音/TikTok链接。",
            });
            send({ type: "done" });
            controller.close();
            return;
          }
          const parsed = extractUrl(rawUrl);
          if (!parsed) {
            send({
              type: "error",
              message: "未能从输入中提取有效的视频链接。",
            });
            send({ type: "done" });
            controller.close();
            return;
          }
          const dl = await downloadVideoFromUrl(parsed, log);
          videoBuffer = dl.buffer;
          videoMime = dl.mimeType;
        }

        // ── Gemini analysis ──
        send({ type: "stage", stage: "ANALYZE", message: "AI 分析中..." });

        const platform = body.platform ?? "tiktok";
        const outputLanguage = body.outputLanguage ?? "auto";

        const scriptResult = await generateScript({
          type: "video",
          videoBuffer,
          mimeType: videoMime,
          platform,
          outputLanguage,
        });

        log(`分析完成，共 ${scriptResult.shots?.length ?? 0} 个镜头`);

        // ── 保存 task + 扣费(失败不扣:仅在分析成功后执行)──
        // 原子扣减带 `credits >= cost` 守门,防并发超扣;扣减成功才记 creditsCost
        // 与流水。极端并发竞争下扣减失败则按 0 计费,不因此让已交付的分析作废。
        const { taskId } = await db.transaction(async (tx) => {
          const [deducted] = await tx
            .update(users)
            .set({ credits: sql`${users.credits} - ${cost}` })
            .where(and(eq(users.id, user.id), sql`${users.credits} >= ${cost}`))
            .returning({ credits: users.credits });
          const charged = Boolean(deducted);

          const [task] = await tx
            .insert(tasks)
            .values({
              userId: user.id,
              type: "analyze",
              status: "done",
              inputText: rawUrl,
              videoSourceUrl: rawUrl,
              soraPrompt: scriptResult.full_sora_prompt,
              scriptJson: scriptResult,
              creditsCost: charged ? cost : 0,
              modelId: analyzeModel.id,
              completedAt: new Date(),
              paramsJson: {
                orientation: "portrait" as const,
                duration: 8 as const,
                count: 1,
                platform,
                outputLanguage,
                model: analyzeModel.slug,
                sourceMode: "url" as const,
              },
            })
            .returning({ id: tasks.id });

          if (charged) {
            await tx.insert(creditTxns).values({
              userId: user.id,
              type: "consume",
              amount: -cost,
              reason: `视频分析 (${analyzeModel.slug})`,
              modelId: analyzeModel.id,
              taskId: task.id,
              balanceAfter: deducted.credits,
            });
          }

          return { taskId: task.id };
        });

        send({ type: "result", data: scriptResult, taskId });
        send({ type: "done" });
        controller.close();
      } catch (e) {
        console.error("[analyze] error:", e);
        send({
          type: "error",
          message:
            "分析失败，请稍后重试。" +
            (e instanceof Error ? ` (${e.message.slice(0, 100)})` : ""),
        });
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
