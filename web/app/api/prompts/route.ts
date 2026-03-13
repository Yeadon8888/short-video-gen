import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceIdFromHeaders } from "@/lib/workspace";
import {
  loadWorkspacePrompts,
  saveWorkspacePrompts,
  type WorkspacePrompts,
} from "@/lib/storage/gateway";

/** GET /api/prompts — read custom prompts for the current workspace */
export async function GET(req: NextRequest) {
  const workspaceId = getWorkspaceIdFromHeaders(req.headers);
  if (!workspaceId) {
    return NextResponse.json({ error: "Missing workspace" }, { status: 401 });
  }

  const prompts = await loadWorkspacePrompts(workspaceId);
  return NextResponse.json(prompts);
}

/** PUT /api/prompts — save custom prompts for the current workspace */
export async function PUT(req: NextRequest) {
  const workspaceId = getWorkspaceIdFromHeaders(req.headers);
  if (!workspaceId) {
    return NextResponse.json({ error: "Missing workspace" }, { status: 401 });
  }

  const body = (await req.json()) as WorkspacePrompts;

  // Validate: only allow known keys, each must be string or undefined
  const allowed = new Set([
    "video_remix_base",
    "video_remix_with_modification",
    "theme_to_video",
  ]);
  const cleaned: WorkspacePrompts = {};
  for (const [key, value] of Object.entries(body)) {
    if (allowed.has(key) && typeof value === "string" && value.trim()) {
      (cleaned as Record<string, string>)[key] = value.trim();
    }
  }

  await saveWorkspacePrompts(workspaceId, cleaned);
  return NextResponse.json({ ok: true });
}
