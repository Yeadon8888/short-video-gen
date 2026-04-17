import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { buildZipArchive } from "@/lib/tasks/downloads";

export async function GET(
  _req: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;
  const { taskId } = await context.params;

  const [task] = await db
    .select({
      id: tasks.id,
      resultUrls: tasks.resultUrls,
    })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)))
    .limit(1);

  if (!task) {
    return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
  }

  const items = (task.resultUrls ?? []).map((url, index) => ({
    url,
    fileStem: `视频${index + 1}`,
  }));

  if (items.length === 0) {
    return NextResponse.json(
      { error: "这个任务还没有可下载的视频。" },
      { status: 400 },
    );
  }

  const zip = await buildZipArchive({
    items,
    rootFolder: `task-${task.id.slice(0, 8)}`,
  });

  return new NextResponse(zip, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="task-${task.id.slice(0, 8)}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
