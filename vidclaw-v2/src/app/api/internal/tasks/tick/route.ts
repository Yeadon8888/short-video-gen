import { NextRequest, NextResponse } from "next/server";
import { runTaskMaintenance } from "@/lib/tasks/runner";

export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && bearer === cronSecret) return true;

  const tickSecret = process.env.INTERNAL_TICK_SECRET;
  if (tickSecret && bearer === tickSecret) return true;

  return false;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runTaskMaintenance({
    scheduledLimit: 10,
    taskGroupLimit: 30,
    groupProcessLimit: 3,
    activeTaskLimit: 200,
    timeoutLimit: 50,
  });

  return NextResponse.json({
    ok: true,
    ...result,
    executedAt: new Date().toISOString(),
  });
}
