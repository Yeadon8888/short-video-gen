import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  DEFAULT_SYSTEM_PROMPTS,
  SYSTEM_PROMPT_DEFINITIONS,
  cleanSystemPrompts,
  loadSystemPrompts,
  saveSystemPrompts,
} from "@/lib/system-prompts";

/** GET /api/admin/system-prompts — read merged system prompt config */
export async function GET() {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const prompts = await loadSystemPrompts();
  return NextResponse.json({
    definitions: SYSTEM_PROMPT_DEFINITIONS,
    prompts,
    defaults: DEFAULT_SYSTEM_PROMPTS,
  });
}

/** PUT /api/admin/system-prompts — save system prompt config */
export async function PUT(req: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const body = (await req.json()) as { prompts?: unknown };
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await saveSystemPrompts({
    prompts: cleanSystemPrompts(body.prompts),
    adminId: authResult.user.id,
  });

  return NextResponse.json({ ok: true, prompts: await loadSystemPrompts() });
}
