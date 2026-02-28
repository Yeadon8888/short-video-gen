import { NextRequest, NextResponse } from "next/server";
import { getInviteCodes, signSession, COOKIE_NAME, SESSION_TTL_DAYS } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { code } = (await req.json()) as { code?: string };
  if (!code) {
    return NextResponse.json({ error: "邀请码不能为空" }, { status: 400 });
  }

  const normalized = code.trim().toUpperCase();
  const inviteCodes = getInviteCodes();
  const name = inviteCodes.get(normalized);

  if (!name) {
    return NextResponse.json({ error: "邀请码无效" }, { status: 403 });
  }

  const token = await signSession({ code: normalized, name });

  const res = NextResponse.json({ ok: true, name });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    path: "/",
  });
  return res;
}
