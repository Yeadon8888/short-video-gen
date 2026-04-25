import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getNewUserFreeCredits,
  normalizeNewUserFreeCredits,
  saveNewUserFreeCredits,
} from "@/lib/onboarding";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const newUserFreeCredits = await getNewUserFreeCredits();
  return NextResponse.json({ newUserFreeCredits });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    newUserFreeCredits?: number;
  };

  if (!Number.isInteger(body.newUserFreeCredits)) {
    return NextResponse.json(
      { error: "新用户免费额度必须是整数" },
      { status: 400 },
    );
  }

  const credits = normalizeNewUserFreeCredits({ credits: body.newUserFreeCredits });
  const savedCredits = await saveNewUserFreeCredits({
    credits,
    adminId: auth.user.id,
  });

  return NextResponse.json({ ok: true, newUserFreeCredits: savedCredits });
}
