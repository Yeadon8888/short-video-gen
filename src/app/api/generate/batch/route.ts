import { after, NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { creditTxns, taskGroups, tasks, users } from "@/lib/db/schema";
import type { BatchGenerateRequest, TaskParamsSnapshot } from "@/lib/video/types";
import { assignImageSequence, resolveSelectedImageAssets } from "@/lib/generate/assets";
import { processPendingBatchTasks } from "@/lib/tasks/batch-processing";
import {
  computeBatchTotalVideoCount,
  resolveBatchUnitsPerProduct,
} from "@/lib/tasks/batch-math";
import { getMaxBatchGroupSubmissionsPerTick } from "@/lib/tasks/batch-queue";
import { resolveActiveVideoModel } from "@/lib/video/service";
import { computeDeliveryDeadline } from "@/lib/tasks/retry-policy";
import type { OutputLanguage } from "@/lib/video/types";

export const maxDuration = 300;

export function resolveOutputLanguage(
  outputLanguage: OutputLanguage | undefined,
  platform: "douyin" | "tiktok" | undefined,
): OutputLanguage {
  if (outputLanguage && outputLanguage !== "auto") return outputLanguage;
  return platform === "douyin" ? "auto" : "en";
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const body = (await req.json()) as BatchGenerateRequest;
  const batchTheme = body.batchTheme?.trim();
  const unitsPerProduct = resolveBatchUnitsPerProduct({
    batchUnitsPerProduct: body.unitsPerProduct,
    count: body.params.count,
  });
  const selectionMode = body.selectionMode ?? "sequence";
  const fulfillmentMode: "standard" | "backfill_until_target" =
    body.fulfillmentMode === "backfill_until_target"
    ? "backfill_until_target"
    : "standard";
  const resolvedOutputLanguage = resolveOutputLanguage(
    body.params.outputLanguage,
    body.params.platform,
  );

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
  const productCount = selectedAssets.length;
  const totalVideoCount = computeBatchTotalVideoCount(productCount, unitsPerProduct);
  const totalCost = modelRow.creditsPerGen * totalVideoCount;
  if (user.credits < totalCost) {
    return NextResponse.json(
      { error: `积分不足。需要 ${totalCost} 积分，当前余额 ${user.credits}。` },
      { status: 400 },
    );
  }

  const assignedAssets = assignImageSequence({
    assets: selectedAssets,
    count: productCount,
    selectionMode,
  });
  const batchRunId = crypto.randomUUID();
  const startedAt = new Date();
  const deliveryDeadlineAt = computeDeliveryDeadline(startedAt);
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
          count: totalVideoCount,
          platform: body.params.platform ?? "tiktok",
          outputLanguage: resolvedOutputLanguage,
          model: modelRow.slug,
          batchUnitsPerProduct: unitsPerProduct,
          batchProductCount: productCount,
          selectedImageIds: selectedAssets.map((asset) => asset.id),
          selectedAssets,
        },
        requestedCount: totalVideoCount,
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
            count: unitsPerProduct,
            platform: body.params.platform ?? "tiktok",
            outputLanguage: resolvedOutputLanguage,
            model: modelRow.slug,
            imageUrls: [assignedAsset.url],
            sourceMode: "batch",
            batchTheme,
            batchUnitsPerProduct: unitsPerProduct,
            batchProductCount: productCount,
            selectionMode,
            selectedImageIds: selectedAssets.map((asset) => asset.id),
            selectedAssets,
            assignedAssetId: assignedAsset.id,
            assignedAssetIndex: index,
            batchRunId,
            batchIndex: index + 1,
            batchTotal: totalVideoCount,
          };

          return {
            userId: user.id,
            taskGroupId: taskGroup.id,
            type: "theme" as const,
            status: "pending" as const,
            modelId: modelRow.id,
            inputText: batchTheme,
            creditsCost: modelRow.creditsPerGen * unitsPerProduct,
            fulfillmentMode,
            requestedCount: fulfillmentMode === "backfill_until_target" ? unitsPerProduct : null,
            successfulCount: 0,
            startedAt: fulfillmentMode === "backfill_until_target" ? startedAt : null,
            deliveryDeadlineAt: fulfillmentMode === "backfill_until_target" ? deliveryDeadlineAt : null,
            paramsJson,
          };
        }),
      )
      .returning({ id: tasks.id });

    await tx.insert(creditTxns).values(
      createdTasks.map((task, index) => ({
        userId: user.id,
        type: "consume" as const,
        amount: -(modelRow.creditsPerGen * unitsPerProduct),
        reason:
          fulfillmentMode === "backfill_until_target"
            ? `批量带货目标补齐 (${modelRow.slug} 商品#${index + 1}/${productCount} × ${unitsPerProduct})`
            : `批量带货生成 (${modelRow.slug} 商品#${index + 1}/${productCount} × ${unitsPerProduct})`,
        modelId: modelRow.id,
        taskId: task.id,
        balanceAfter:
          deducted.credits + modelRow.creditsPerGen * unitsPerProduct * (productCount - index - 1),
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
      limit: Math.min(productCount, getMaxBatchGroupSubmissionsPerTick()),
    });
  });

  return NextResponse.json({
    ok: true,
    taskGroupId: creation.taskGroupId,
    batchRunId,
    createdCount: creation.taskIds.length,
    failedCount: 0,
    taskIds: creation.taskIds,
    unitsPerProduct,
    totalVideoCount,
    errors: [],
  });
}
