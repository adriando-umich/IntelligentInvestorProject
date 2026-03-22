"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { DEMO_COOKIE_NAME } from "@/lib/app-config";
import { isSupabaseConfigured } from "@/lib/env";
import { getServerI18n } from "@/lib/i18n/server";
import { syncProfileFromAuthUser } from "@/lib/supabase/profile-sync";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function normalizeNextPath(nextPath: FormDataEntryValue | null) {
  if (typeof nextPath !== "string" || !nextPath.startsWith("/")) {
    return "/projects";
  }

  return nextPath;
}

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export async function signInAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const { text } = await getServerI18n();
  const cookieStore = await cookies();
  const authText = text.actions.auth;

  const parsed = z
    .object({
      email: z.string().email(authText.invalidEmail),
      password: z.string().min(8, authText.invalidPassword),
      nextPath: z.string().optional(),
    })
    .safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    nextPath: formData.get("nextPath"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? authText.signInFailed,
    };
  }

  if (!isSupabaseConfigured) {
    cookieStore.set(DEMO_COOKIE_NAME, "enabled", {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
    redirect(normalizeNextPath(formData.get("nextPath")));
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      status: "error",
      message: authText.supabaseMissing,
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
  redirect(normalizeNextPath(formData.get("nextPath")));
}

export async function signUpAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const { text } = await getServerI18n();
  const cookieStore = await cookies();
  const authText = text.actions.auth;

  const parsed = z
    .object({
      displayName: z.string().trim().min(2, authText.invalidDisplayName),
      email: z.string().email(authText.invalidEmail),
      password: z.string().min(8, authText.invalidPassword),
      nextPath: z.string().optional(),
    })
    .safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    nextPath: formData.get("nextPath"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? authText.signUpFailed,
    };
  }

  if (!isSupabaseConfigured) {
    return {
      status: "error",
      message: authText.demoSignUpUnavailable,
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      status: "error",
      message: authText.supabaseMissing,
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

    redirect(normalizeNextPath(formData.get("nextPath")));
  }

  return {
    status: "success",
    message: authText.emailVerificationNotice,
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
