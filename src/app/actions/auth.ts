"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { DEMO_COOKIE_NAME } from "@/lib/app-config";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.string().email("Use a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export type AuthActionState = {
  status: "idle" | "error";
  message?: string;
};

export async function signInAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const cookieStore = await cookies();

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Unable to sign in.",
    };
  }

  if (!isSupabaseConfigured) {
    cookieStore.set(DEMO_COOKIE_NAME, "enabled", {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
    redirect("/projects");
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      status: "error",
      message: "Supabase is not configured.",
    };
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  cookieStore.delete(DEMO_COOKIE_NAME);
  redirect("/projects");
}

export async function continueInDemoAction() {
  const cookieStore = await cookies();
  cookieStore.set(DEMO_COOKIE_NAME, "enabled", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  });
  redirect("/projects");
}

export async function signOutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_COOKIE_NAME);

  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    await supabase?.auth.signOut();
  }

  redirect("/sign-in");
}
