import { NextRequest, NextResponse } from "next/server";
import {
  PARTNER_REF_COOKIE,
  PARTNER_REF_MAX_AGE_SECONDS,
  getActivePartnerByCode,
  normalizePartnerCode,
} from "@/lib/partners";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const referralCode = normalizePartnerCode(code);
  const url = request.nextUrl.clone();
  url.pathname = "/register";
  url.searchParams.set("ref", referralCode);

  const response = NextResponse.redirect(url);
  const partner = await getActivePartnerByCode(referralCode);

  if (partner) {
    response.cookies.set(PARTNER_REF_COOKIE, referralCode, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: PARTNER_REF_MAX_AGE_SECONDS,
      path: "/",
    });
  }

  return response;
}
