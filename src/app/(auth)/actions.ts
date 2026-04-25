"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAppUserForAuthUser } from "@/lib/onboarding";

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
      await createAppUserForAuthUser({
        authId: authData.user.id,
        email,
        name,
      });
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

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=google_auth_failed");
  }

  redirect(data.url);
}
