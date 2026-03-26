import { db } from "@/lib/db";
import { taskGroups, tasks } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { and, desc, eq, isNull } from "drizzle-orm";
import { TaskList } from "./TaskList";

export default async function TasksPage() {
  const auth = await requireAuth();
  if (auth instanceof Response) return null; // 401
  const user = auth.user;

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

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
      <h1 className="text-lg font-bold text-white sm:text-xl">任务历史</h1>
      <TaskList initialTasks={userTasks} initialTaskGroups={userTaskGroups} />
    </div>
  );
}
