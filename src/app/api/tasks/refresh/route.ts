import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { taskGroups, tasks } from "@/lib/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { runTaskMaintenance } from "@/lib/tasks/runner";

/**
 * GET /api/tasks/refresh
 *
 * Returns user tasks. For any task in an active status, polls the provider
 * for the latest status and updates the DB before responding.
 * This ensures the tasks page shows accurate state even when the user
 * didn't stay on the generate page to finish polling.
 */
export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  await runTaskMaintenance({
    userId: user.id,
    scheduledLimit: 3,
    taskGroupLimit: 30,
    groupProcessLimit: 2,
    activeTaskLimit: 200,
    timeoutLimit: 20,
  });

  // Re-fetch the final task list
  const userTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, user.id), isNull(tasks.taskGroupId)))
    .orderBy(desc(tasks.createdAt))
    .limit(50);

  const userTaskGroups = await db
    .select()
    .from(taskGroups)
    .where(eq(taskGroups.userId, user.id))
    .orderBy(desc(taskGroups.createdAt))
    .limit(30);

  return NextResponse.json({ tasks: userTasks, taskGroups: userTaskGroups });
}
