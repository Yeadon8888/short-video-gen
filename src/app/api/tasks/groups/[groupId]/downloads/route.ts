import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { taskGroups, tasks } from "@/lib/db/schema";
import {
  buildZipArchive,
  contentDispositionAttachment,
  type ZipAssetItem,
} from "@/lib/tasks/downloads";
import type { TaskParamsSnapshot } from "@/lib/video/types";

export const maxDuration = 300;

function buildTaskZipItems(childTasks: Array<{
  id: string;
  resultUrls: string[] | null;
  paramsJson: TaskParamsSnapshot | null;
}>): ZipAssetItem[] {
  return childTasks.flatMap((task, taskIndex) => {
    const params = task.paramsJson ?? null;
    const productIndex = params?.assignedAssetIndex ?? taskIndex;
    const productName = `商品${String(productIndex + 1).padStart(2, "0")}`;
    return (task.resultUrls ?? []).map((url, urlIndex) => ({
      url,
      fileStem: `${productName}/视频${urlIndex + 1}`,
    }));
  });
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ groupId: string }> },
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;
  const { groupId } = await context.params;

  const [group] = await db
    .select({ id: taskGroups.id })
    .from(taskGroups)
    .where(and(eq(taskGroups.id, groupId), eq(taskGroups.userId, user.id)))
    .limit(1);

  if (!group) {
    return NextResponse.json(
      { error: "任务组不存在。" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const childTasks = await db
    .select({
      id: tasks.id,
      resultUrls: tasks.resultUrls,
      paramsJson: tasks.paramsJson,
    })
    .from(tasks)
    .where(eq(tasks.taskGroupId, group.id))
    .orderBy(asc(tasks.createdAt));

  const items = buildTaskZipItems(childTasks);
  if (items.length === 0) {
    return NextResponse.json(
      { error: "这个任务组里还没有可下载的视频。" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const filename = `task-group-${group.id.slice(0, 8)}.zip`;
  const zip = await buildZipArchive({
    items,
    rootFolder: `task-group-${group.id.slice(0, 8)}`,
  });

  return new NextResponse(zip, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": contentDispositionAttachment(filename),
      "Cache-Control": "no-store",
    },
  });
}
