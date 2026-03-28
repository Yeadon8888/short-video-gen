import { NextRequest, NextResponse } from "next/server";
import { processTimedOutTasks } from "@/lib/tasks/timeout";

/**
 * GET /api/cron/timeout — Check stuck tasks and auto-refund.
 * Protected by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processTimedOutTasks();

  return NextResponse.json({
    total: result.total,
    resolved: result.resolved,
    refunded: result.refunded,
  });
}
