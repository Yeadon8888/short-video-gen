import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PARTNER_REF_COOKIE, PARTNER_REF_MAX_AGE_SECONDS, normalizePartnerCode } from "@/lib/partners";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/generate";
  const ref = searchParams.get("ref");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      const referralCode = ref ? normalizePartnerCode(ref) : "";
      if (referralCode) {
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
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
