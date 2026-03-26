import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { creditTxns, taskGroups, taskItems, tasks, users } from "@/lib/db/schema";
import type { BatchGenerateRequest } from "@/lib/video/types";
import { assignImageSequence, resolveSelectedImageAssets } from "@/lib/generate/assets";
import { fetchAssetBuffer, loadUserPrompts } from "@/lib/storage/gateway";
import { generateCopy, generateScript } from "@/lib/gemini";
import { buildFinalVideoPrompt } from "@/lib/video/prompt";
import { failTaskAndRefund } from "@/lib/tasks/reconciliation";
import { recomputeTaskGroupSummary } from "@/lib/tasks/groups";
import { createVideoTasks, resolveActiveVideoModel } from "@/lib/video/service";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const body = (await req.json()) as BatchGenerateRequest;
  const batchTheme = body.batchTheme?.trim();
  const count = Math.min(Math.max(body.params.count, 1), 10);
  const selectionMode = body.selectionMode ?? "sequence";

  if (!batchTheme) {
    return NextResponse.json({ error: "请输入批量创意主题。" }, { status: 400 });
  }

  const selectedAssets = await resolveSelectedImageAssets({
    userId: user.id,
    selectedImageIds: body.selectedImageIds,
    fallbackLimit: 0,
  });

  if (selectedAssets.length === 0) {
    return NextResponse.json({ error: "请至少选择 1 张产品图。" }, { status: 400 });
  }

  const modelRow = await resolveActiveVideoModel(body.params.model);
  const totalCost = modelRow.creditsPerGen * count;
  if (user.credits < totalCost) {
    return NextResponse.json(
      { error: `积分不足。需要 ${totalCost} 积分，当前余额 ${user.credits}。` },
      { status: 400 },
    );
  }

  const assignedAssets = assignImageSequence({
    assets: selectedAssets,
    count,
    selectionMode,
  });
  const customPrompts = await loadUserPrompts(user.id);
  const batchRunId = crypto.randomUUID();
  const [taskGroup] = await db
    .insert(taskGroups)
    .values({
      userId: user.id,
      sourceMode: "batch",
      status: "generating",
      title: batchTheme,
      batchTheme,
      selectionMode,
      paramsJson: {
        orientation: body.params.orientation,
        duration: body.params.duration,
        count,
        platform: body.params.platform ?? "douyin",
        model: modelRow.slug,
        selectedImageIds: selectedAssets.map((asset) => asset.id),
        selectedAssets,
      },
      requestedCount: count,
      creditsCost: totalCost,
    })
    .returning();

  const createdTaskIds: string[] = [];
  const errors: Array<{ index: number; message: string }> = [];

  for (const [index, assignedAsset] of assignedAssets.entries()) {
    let currentTaskId: string | null = null;
    try {
      const imageAsset = await fetchAssetBuffer(assignedAsset.url);
      const scriptResult = await generateScript({
        type: "theme",
        theme: batchTheme,
        imageBuffers: [imageAsset],
        promptTemplate: customPrompts.theme_to_video,
        platform: body.params.platform,
      });

      if (customPrompts.copy_generation) {
        try {
          scriptResult.copy = await generateCopy(
            scriptResult.full_sora_prompt,
            customPrompts.copy_generation,
            body.params.platform,
          );
        } catch {
          // Keep Gemini-built copy if custom copy regeneration fails.
        }
      }

      const soraPrompt = buildFinalVideoPrompt({
        scriptPrompt: scriptResult.full_sora_prompt,
        referenceImageCount: 1,
      });

      const immediateResult = await db.transaction(async (tx) => {
        const [deducted] = await tx
          .update(users)
          .set({ credits: sql`${users.credits} - ${modelRow.creditsPerGen}` })
          .where(and(eq(users.id, user.id), sql`${users.credits} >= ${modelRow.creditsPerGen}`))
          .returning({ credits: users.credits });

        if (!deducted) return null;

        const [task] = await tx
          .insert(tasks)
          .values({
            userId: user.id,
            taskGroupId: taskGroup.id,
            type: "theme",
            status: "generating",
            modelId: modelRow.id,
            inputText: batchTheme,
            soraPrompt,
            scriptJson: scriptResult,
            creditsCost: modelRow.creditsPerGen,
            paramsJson: {
              orientation: body.params.orientation,
              duration: body.params.duration,
              count: 1,
              platform: body.params.platform ?? "douyin",
              model: modelRow.slug,
              imageUrls: [assignedAsset.url],
              sourceMode: "batch",
              batchTheme,
              selectionMode,
              selectedImageIds: selectedAssets.map((asset) => asset.id),
              selectedAssets,
              assignedAssetId: assignedAsset.id,
              assignedAssetIndex: index,
              batchRunId,
              batchIndex: index + 1,
              batchTotal: count,
            },
          })
          .returning();

        await tx.insert(creditTxns).values({
          userId: user.id,
          type: "consume",
          amount: -modelRow.creditsPerGen,
          reason: `批量带货生成 (${modelRow.slug} #${index + 1}/${count})`,
          modelId: modelRow.id,
          taskId: task.id,
          balanceAfter: deducted.credits,
        });

        return task;
      });

      if (!immediateResult) {
        errors.push({
          index: index + 1,
          message: "积分不足，批量任务已提前停止。",
        });
        break;
      }
      currentTaskId = immediateResult.id;

      const submitted = await createVideoTasks({
        model: modelRow,
        request: {
          prompt: soraPrompt,
          imageUrls: [assignedAsset.url],
          orientation: body.params.orientation,
          duration: body.params.duration,
          count: 1,
          model: modelRow.slug,
        },
      });

      for (const providerTaskId of submitted.providerTaskIds) {
        await db.insert(taskItems).values({
          taskId: immediateResult.id,
          providerTaskId,
          status: "PENDING",
        });
      }

      createdTaskIds.push(immediateResult.id);
    } catch (error) {
      const message = String(error).slice(0, 300);
      errors.push({ index: index + 1, message });

      if (currentTaskId) {
        await failTaskAndRefund({
          taskId: currentTaskId,
          userId: user.id,
          refundAmount: modelRow.creditsPerGen,
          errorMessage: message,
          refundReason: "批量任务提交失败自动退款",
          allowedStatuses: ["generating"],
        });
      }
    }
  }

  if (errors.length > 0) {
    await db
      .update(taskGroups)
      .set({
        errorMessage: errors.map((error) => `#${error.index} ${error.message}`).join(" | ").slice(0, 1000),
      })
      .where(eq(taskGroups.id, taskGroup.id));
  }

  if (createdTaskIds.length === 0 && errors.length > 0) {
    await db
      .update(taskGroups)
      .set({
        status: "failed",
        failedCount: errors.length,
        completedAt: new Date(),
      })
      .where(eq(taskGroups.id, taskGroup.id));
  }

  await recomputeTaskGroupSummary(taskGroup.id);

  return NextResponse.json({
    ok: errors.length === 0,
    taskGroupId: taskGroup.id,
    batchRunId,
    createdCount: createdTaskIds.length,
    failedCount: errors.length,
    taskIds: createdTaskIds,
    errors,
  });
}
