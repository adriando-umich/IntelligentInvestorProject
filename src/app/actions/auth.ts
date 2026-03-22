"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { DEMO_COOKIE_NAME } from "@/lib/app-config";
import { isSupabaseConfigured } from "@/lib/env";
import { syncProfileFromAuthUser } from "@/lib/supabase/profile-sync";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.string().email("Use a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Add the name people should see in the workspace."),
  email: z.string().email("Use a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters."),
});

export type AuthActionState = {
  status: "idle" | "error" | "success";
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

  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  if (data.user) {
    await syncProfileFromAuthUser(supabase, data.user);
  }

  cookieStore.delete(DEMO_COOKIE_NAME);
  redirect("/projects");
}

export async function signUpAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const cookieStore = await cookies();

  const parsed = signUpSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Unable to create account.",
    };
  }

  if (!isSupabaseConfigured) {
    return {
      status: "error",
      message:
        "Live account creation is unavailable because Supabase is not configured.",
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      status: "error",
      message: "Supabase is not configured.",
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        display_name: parsed.data.displayName,
        name: parsed.data.displayName,
      },
    },
  });

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  cookieStore.delete(DEMO_COOKIE_NAME);

  if (data.session) {
    if (data.user) {
      await syncProfileFromAuthUser(supabase, data.user);
    }

    redirect("/projects");
  }

  return {
    status: "success",
    message:
      "Account created. Check your email for a confirmation link if your Supabase project requires email verification.",
  };
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
