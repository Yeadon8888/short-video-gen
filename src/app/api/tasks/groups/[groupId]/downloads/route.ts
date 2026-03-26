import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { taskGroups, tasks } from "@/lib/db/schema";

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
    return NextResponse.json({ error: "任务组不存在。" }, { status: 404 });
  }

  const childTasks = await db
    .select({ resultUrls: tasks.resultUrls })
    .from(tasks)
    .where(eq(tasks.taskGroupId, group.id));

  const urls = childTasks.flatMap((task) => task.resultUrls ?? []);

  return NextResponse.json({ urls });
}
