import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listActiveVideoModels } from "@/lib/video/service";

/** GET /api/generate/models — list active video models for generation page */
export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const models = await listActiveVideoModels();
  return NextResponse.json({ models });
}
