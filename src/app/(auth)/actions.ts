"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  attachPartnerAttributionIfMissing,
  createAppUserForAuthUser,
} from "@/lib/onboarding";
import { PARTNER_REF_COOKIE } from "@/lib/partners";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);
  if (error) {
    return { error: error.message };
  }

  const cookieStore = await cookies();
  const referralCode = cookieStore.get(PARTNER_REF_COOKIE)?.value ?? null;
  if (referralCode) {
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user;
    if (authUser?.email) {
      const appUser = await createAppUserForAuthUser({
        authId: authUser.id,
        email: authUser.email,
        name:
          authUser.user_metadata?.full_name ??
          authUser.user_metadata?.name ??
          authUser.email.split("@")[0],
        referralCode,
      });
      await attachPartnerAttributionIfMissing({
        userId: appUser.id,
        referralCode,
      });
    }
    cookieStore.delete(PARTNER_REF_COOKIE);
  }

  revalidatePath("/", "layout");
  redirect("/generate");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = (formData.get("name") as string) || email.split("@")[0];

  const { data: authData, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // Create app user record
  if (authData.user) {
    try {
      const cookieStore = await cookies();
      const referralCode = cookieStore.get(PARTNER_REF_COOKIE)?.value ?? null;
      await createAppUserForAuthUser({
        authId: authData.user.id,
        email,
        name,
        referralCode,
      });
      if (referralCode) cookieStore.delete(PARTNER_REF_COOKIE);
    } catch (dbError) {
      console.error("[signup] DB error:", dbError);
      return { error: "账号创建失败，请稍后再试" };
    }
  }

  // If email confirmation is required, Supabase won't create a session
  // In that case, redirect to login with a hint
  if (!authData.session) {
    redirect("/login?registered=1");
  }

  revalidatePath("/", "layout");
  redirect("/generate");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "https://video.yeadon.top";
  const partnerRef = (await cookies()).get(PARTNER_REF_COOKIE)?.value;
  const callbackUrl = new URL("/auth/callback", origin);
  if (partnerRef) callbackUrl.searchParams.set("ref", partnerRef);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error || !data.url) {
    redirect("/login?error=google_auth_failed");
  }

  redirect(data.url);
}
