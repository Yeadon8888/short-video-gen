"use client";

/**
 * Client-side defense for the "tab-refocus auth hang" class of bugs.
 *
 * Mounted once per dashboard render. Subscribes to Supabase auth events and
 * kicks the browser to /login the moment the session is gone — so a user who
 * left the dashboard open overnight doesn't end up clicking on a dead UI
 * whose API calls all 401 silently.
 *
 * Triggers:
 *   - SIGNED_OUT: explicit or upstream-revoked logout.
 *   - TOKEN_REFRESHED with no session: refresh attempt returned a null
 *     session (Supabase's bug-mode for invalid refresh tokens).
 *
 * Intentionally does NOT trigger on USER_UPDATED — that fires after benign
 * `updateUser({ data: ... })` calls and would cause spurious logouts.
 *
 * Complements the middleware timeout+cookie scrub: middleware catches the
 * SSR request path; this catches tabs that stay open while the token quietly
 * expires in-place.
 */
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthRecovery() {
  useEffect(() => {
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Happy path (existing session OR refresh that produced one): ignore.
      if (session) return;

      if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        // `replace` so the broken dashboard isn't left in browser history.
        window.location.replace("/login?session_expired=1");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return null;
}
