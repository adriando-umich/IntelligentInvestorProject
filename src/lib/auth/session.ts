import "server-only";

import { cookies } from "next/headers";

import { DEMO_COOKIE_NAME } from "@/lib/app-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionState = {
  isAuthenticated: boolean;
  demoMode: boolean;
};

export async function getSessionState(): Promise<SessionState> {
  const cookieStore = await cookies();
  const demoMode = cookieStore.get(DEMO_COOKIE_NAME)?.value === "enabled";

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      isAuthenticated: demoMode,
      demoMode,
    };
  }

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  return {
    isAuthenticated: Boolean(claims?.sub) || demoMode,
    demoMode: claims?.sub ? false : demoMode,
  };
}
