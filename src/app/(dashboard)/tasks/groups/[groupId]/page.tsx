export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { taskGroups, tasks } from "@/lib/db/schema";
import type { TaskParamsSnapshot } from "@/lib/video/types";
import { CopyTextButton } from "@/components/ui/CopyTextButton";
import { TaskGroupDownloadButton } from "@/components/tasks/TaskGroupDownloadButton";
import { buildGenerateReplayHref } from "@/lib/generate/preset";
import {
  computeBatchTotalVideoCount,
  resolveBatchUnitsPerProduct,
} from "@/lib/tasks/batch-math";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="vc-card space-y-4 p-5">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

export default async function TaskGroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const auth = await requireAuth();
  if (auth instanceof Response) return null;
  const user = auth.user;
  const { groupId } = await params;

  const [group] = await db
    .select()
    .from(taskGroups)
    .where(and(eq(taskGroups.id, groupId), eq(taskGroups.userId, user.id)))
    .limit(1);

  if (!group) notFound();

  const childTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.taskGroupId, group.id))
    .orderBy(asc(tasks.createdAt));

  const paramsJson = (group.paramsJson ?? {}) as TaskParamsSnapshot;
  const selectedAssets = paramsJson.selectedAssets ?? [];
  const batchUnitsPerProduct = resolveBatchUnitsPerProduct(paramsJson);
  const batchProductCount = paramsJson.batchProductCount ?? selectedAssets.length;
  const targetVideoCount =
    group.requestedCount ??
    computeBatchTotalVideoCount(batchProductCount, batchUnitsPerProduct);
  const displayedSuccessCount = Math.min(group.successCount, targetVideoCount);
  const displayedFailedCount = Math.min(
    group.failedCount,
    Math.max(targetVideoCount - displayedSuccessCount, 0),
  );
  const productOrderText = selectedAssets
    .map((asset, index) => `${index + 1}. ${asset.filename || asset.id}`)
    .join("\n");
  const replayHref = buildGenerateReplayHref({
    tab: "batch",
    batchTheme: group.batchTheme ?? undefined,
    batchUnitsPerProduct,
    batchImageIds: selectedAssets.map((asset) => asset.id),
    params: {
      orientation: paramsJson.orientation,
      duration: paramsJson.duration,
      platform: paramsJson.platform,
      outputLanguage: paramsJson.outputLanguage,
      model: paramsJson.model,
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link
        href="/tasks"
        className="inline-flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-white"
      >
        ← 返回任务列表
      </Link>
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--vc-text-dim)]">
          批量任务组
        </p>
        <h1 className="text-xl font-bold text-white">{group.title || group.batchTheme || "批量带货任务"}</h1>
        <p className="text-sm text-[var(--vc-text-muted)]">
          创建于 {new Date(group.createdAt).toLocaleString("zh-CN")} · 状态 {group.status}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={replayHref}
            className="rounded-full border border-[var(--vc-border)] px-3 py-1 text-xs text-[var(--vc-text-secondary)]"
          >
            按此配置再来一组
          </Link>
          <TaskGroupDownloadButton
            groupId={group.id}
            disabled={false}
          />
          {group.batchTheme && <CopyTextButton text={group.batchTheme} />}
          {productOrderText && <CopyTextButton text={productOrderText} />}
        </div>
      </div>

      <Section title="批量配置">
        <div className="grid gap-3 text-sm text-[var(--vc-text-secondary)] sm:grid-cols-2 lg:grid-cols-4">
          <div>模型：{paramsJson.model || "—"}</div>
          <div>平台：{paramsJson.platform || "—"}</div>
          <div>语言：{paramsJson.outputLanguage || "auto"}</div>
          <div>时长：{paramsJson.duration ?? "—"} 秒</div>
          <div>商品数：{batchProductCount}</div>
          <div>每商品条数：{batchUnitsPerProduct}</div>
          <div>计划总视频：{targetVideoCount}</div>
          <div>成功：{displayedSuccessCount}</div>
          <div>失败：{displayedFailedCount}</div>
          <div>选图策略：{group.selectionMode || "sequence"}</div>
          <div>积分：{group.creditsCost}</div>
        </div>
        {group.batchTheme && (
          <div className="space-y-2">
            <div className="flex justify-end">
              <CopyTextButton text={group.batchTheme} />
            </div>
            <pre className="whitespace-pre-wrap rounded-2xl bg-[var(--vc-bg-root)] p-4 text-sm text-[var(--vc-text-secondary)]">
              {group.batchTheme}
            </pre>
          </div>
        )}
      </Section>

      <Section title="产品图顺序">
        {selectedAssets.length > 0 ? (
          <div className="space-y-2">
            <div className="flex justify-end">
              <CopyTextButton text={productOrderText} />
            </div>
            {selectedAssets.map((asset, index) => (
              <div
                key={`${asset.id}-${index}`}
                className="rounded-2xl border border-[var(--vc-border)] px-4 py-3 text-sm text-[var(--vc-text-secondary)]"
              >
                <p className="text-white">
                  {index + 1}. {asset.filename || asset.id}
                </p>
                <p className="truncate text-xs text-[var(--vc-text-dim)]">{asset.url}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--vc-text-muted)]">未保存产品图顺序快照。</p>
        )}
      </Section>

      <Section title="子任务">
        <div className="space-y-3">
          {childTasks.map((task, index) => {
            const taskParams = (task.paramsJson ?? {}) as TaskParamsSnapshot;
            return (
              <div
                key={task.id}
                className="rounded-2xl border border-[var(--vc-border)] px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-white">
                      第 {index + 1} 个商品 · 状态 {task.status}
                    </p>
                    <p className="text-xs text-[var(--vc-text-dim)]">
                      产品图序号 {typeof taskParams.assignedAssetIndex === "number" ? taskParams.assignedAssetIndex + 1 : "—"}
                    </p>
                  </div>
                  <Link
                    href={`/tasks/${task.id}`}
                    className="rounded-full border border-[var(--vc-border)] px-3 py-1 text-xs text-[var(--vc-text-secondary)]"
                  >
                    查看详情
                  </Link>
                </div>
                {task.errorMessage && (
                  <p className="mt-2 text-xs text-red-400">{task.errorMessage}</p>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
