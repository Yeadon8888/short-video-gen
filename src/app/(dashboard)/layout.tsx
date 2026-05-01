import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { createAppUserForAuthUser } from "@/lib/onboarding";
import { PARTNER_REF_COOKIE } from "@/lib/partners";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fast path: use cached getAuthUser (deduplicates with API route calls)
  const authCtx = await getAuthUser();

  if (authCtx) {
    if (authCtx.user.status !== "active") {
      redirect("/login?error=suspended");
    }
    return (
      <DashboardShell user={authCtx.user}>
        {children}
      </DashboardShell>
    );
  }

  // Auth failed — try to auto-create user record (first login after email confirmation)
  let supabaseUser;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    supabaseUser = data.user;
  } catch {
    redirect("/login");
  }

  if (!supabaseUser) {
    redirect("/login");
  }

  // User exists in Supabase but not in our DB — auto-create
  const cookieStore = await cookies();
  const referralCode = cookieStore.get(PARTNER_REF_COOKIE)?.value ?? null;
  const newUser = await createAppUserForAuthUser({
    authId: supabaseUser.id,
    email: supabaseUser.email!,
    name:
      supabaseUser.user_metadata?.full_name ??
      supabaseUser.user_metadata?.name ??
      supabaseUser.email!.split("@")[0],
    referralCode,
  });
  if (referralCode) cookieStore.delete(PARTNER_REF_COOKIE);

  if (newUser.status !== "active") {
    redirect("/login?error=suspended");
  }

  return (
    <DashboardShell user={newUser}>
      {children}
    </DashboardShell>
  );
}
