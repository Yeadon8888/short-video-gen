import { NextRequest, NextResponse } from "next/server";
import { queryTaskStatus } from "@/lib/video/plato";

/**
 * Client-side polling endpoint for Sora video task status.
 * GET /api/generate/status?taskIds=id1,id2
 */
export async function GET(req: NextRequest) {
  const taskIdsParam = req.nextUrl.searchParams.get("taskIds") ?? "";
  const taskIds = taskIdsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (taskIds.length === 0) {
    return NextResponse.json({ error: "Missing taskIds" }, { status: 400 });
  }

  const results = await Promise.all(
    taskIds.map(async (taskId) => {
      try {
        return await queryTaskStatus(taskId);
      } catch {
        return { taskId, status: "UNKNOWN", progress: "0%" };
      }
    })
  );

  const allDone = results.every(
    (r) => r.status === "SUCCESS" || r.status === "FAILED"
  );

  return NextResponse.json({ results, allDone });
}
