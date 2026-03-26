import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { taskGroups, taskItems, tasks } from "@/lib/db/schema";
import type { TaskParamsSnapshot } from "@/lib/video/types";
import { fetchAssetBuffer, loadUserPrompts } from "@/lib/storage/gateway";
import { generateCopy, generateScript } from "@/lib/gemini";
import { buildFinalVideoPrompt } from "@/lib/video/prompt";
import { failTaskAndRefund } from "@/lib/tasks/reconciliation";
import { recomputeTaskGroupSummary } from "@/lib/tasks/groups";
import { createVideoTasksForModelId } from "@/lib/video/service";

export async function processPendingBatchTasks(params: {
  taskGroupId: string;
  limit?: number;
}): Promise<{ processed: number; failed: number }> {
  const limit = Math.max(1, Math.min(params.limit ?? 10, 10));

  const [group] = await db
    .select()
    .from(taskGroups)
    .where(eq(taskGroups.id, params.taskGroupId))
    .limit(1);

  if (!group) {
    return { processed: 0, failed: 0 };
  }

  const customPrompts = await loadUserPrompts(group.userId);
  const queuedTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.taskGroupId, group.id), eq(tasks.status, "pending")))
    .orderBy(asc(tasks.createdAt))
    .limit(limit);

  let processed = 0;
  let failed = 0;

  for (const queuedTask of queuedTasks) {
    const [claimedTask] = await db
      .update(tasks)
      .set({ status: "analyzing", errorMessage: null })
      .where(and(eq(tasks.id, queuedTask.id), eq(tasks.status, "pending")))
      .returning();

    if (!claimedTask) continue;

    try {
      const taskParams = (claimedTask.paramsJson ?? {}) as TaskParamsSnapshot;
      const imageUrl = taskParams.imageUrls?.[0];
      if (!imageUrl) {
        throw new Error("批量任务缺少产品图 URL。");
      }

      const imageAsset = await fetchAssetBuffer(imageUrl);
      const scriptResult = await generateScript({
        type: "theme",
        theme: taskParams.batchTheme ?? claimedTask.inputText ?? "",
        imageBuffers: [imageAsset],
        promptTemplate: customPrompts.theme_to_video,
        platform: taskParams.platform,
      });

      if (customPrompts.copy_generation) {
        try {
          scriptResult.copy = await generateCopy(
            scriptResult.full_sora_prompt,
            customPrompts.copy_generation,
            taskParams.platform,
          );
        } catch {
          // Fall back to the original Gemini copy if custom regeneration fails.
        }
      }

      const soraPrompt = buildFinalVideoPrompt({
        scriptPrompt: scriptResult.full_sora_prompt,
        referenceImageCount: 1,
      });

      await db
        .update(tasks)
        .set({
          status: "generating",
          soraPrompt,
          scriptJson: scriptResult,
        })
        .where(eq(tasks.id, claimedTask.id));

      const submitted = await createVideoTasksForModelId({
        modelId: claimedTask.modelId,
        request: {
          prompt: soraPrompt,
          imageUrls: [imageUrl],
          orientation: taskParams.orientation,
          duration: taskParams.duration,
          count: 1,
          model: taskParams.model,
        },
      });

      for (const providerTaskId of submitted.providerTaskIds) {
        await db.insert(taskItems).values({
          taskId: claimedTask.id,
          providerTaskId,
          status: "PENDING",
        });
      }

      processed += 1;
    } catch (error) {
      failed += 1;
      await failTaskAndRefund({
        taskId: claimedTask.id,
        userId: claimedTask.userId,
        refundAmount: claimedTask.creditsCost,
        errorMessage: String(error).slice(0, 500),
        refundReason: "批量任务处理失败自动退款",
        allowedStatuses: ["pending", "analyzing"],
      });
    }
  }

  await recomputeTaskGroupSummary(group.id);
  return { processed, failed };
}
