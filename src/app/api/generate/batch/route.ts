import { after, NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { creditTxns, taskGroups, tasks, users } from "@/lib/db/schema";
import type { BatchGenerateRequest, TaskParamsSnapshot } from "@/lib/video/types";
import { assignImageSequence, resolveSelectedImageAssets } from "@/lib/generate/assets";
import { processPendingBatchTasks } from "@/lib/tasks/batch-processing";
import { resolveActiveVideoModel } from "@/lib/video/service";

export const maxDuration = 300;

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
  const batchRunId = crypto.randomUUID();
  const creation = await db.transaction(async (tx) => {
    const [deducted] = await tx
      .update(users)
      .set({ credits: sql`${users.credits} - ${totalCost}` })
      .where(and(eq(users.id, user.id), sql`${users.credits} >= ${totalCost}`))
      .returning({ credits: users.credits });

    if (!deducted) {
      return null;
    }

    const [taskGroup] = await tx
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

    const createdTasks = await tx
      .insert(tasks)
      .values(
        assignedAssets.map((assignedAsset, index) => {
          const paramsJson: TaskParamsSnapshot = {
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
          };

          return {
            userId: user.id,
            taskGroupId: taskGroup.id,
            type: "theme" as const,
            status: "pending" as const,
            modelId: modelRow.id,
            inputText: batchTheme,
            creditsCost: modelRow.creditsPerGen,
            paramsJson,
          };
        }),
      )
      .returning({ id: tasks.id });

    await tx.insert(creditTxns).values(
      createdTasks.map((task, index) => ({
        userId: user.id,
        type: "consume" as const,
        amount: -modelRow.creditsPerGen,
        reason: `批量带货生成 (${modelRow.slug} #${index + 1}/${count})`,
        modelId: modelRow.id,
        taskId: task.id,
        balanceAfter: deducted.credits + modelRow.creditsPerGen * (count - index - 1),
      })),
    );

    return {
      taskGroupId: taskGroup.id,
      taskIds: createdTasks.map((task) => task.id),
    };
  });

  if (!creation) {
    return NextResponse.json(
      { error: `积分不足。需要 ${totalCost} 积分，当前余额 ${user.credits}。` },
      { status: 400 },
    );
  }

  after(async () => {
    await processPendingBatchTasks({
      taskGroupId: creation.taskGroupId,
      limit: count,
    });
  });

  return NextResponse.json({
    ok: true,
    taskGroupId: creation.taskGroupId,
    batchRunId,
    createdCount: creation.taskIds.length,
    failedCount: 0,
    taskIds: creation.taskIds,
    errors: [],
  });
}
