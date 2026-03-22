"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { DEFAULT_CURRENCY_CODE } from "@/lib/app-config";
import { getSessionState } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createProjectSchema = z.object({
  name: z.string().trim().min(3, "Project name should be at least 3 characters."),
  description: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  currencyCode: z
    .string()
    .trim()
    .length(3, "Choose a valid 3-letter currency code.")
    .transform((value) => value.toUpperCase()),
});

const rpcResponseSchema = z.string().uuid();

export type ProjectActionState = {
  status: "idle" | "error";
  message?: string;
};

export async function createProjectAction(
  _previousState: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const session = await getSessionState();

  if (session.demoMode) {
    return {
      status: "error",
      message:
        "Project creation is disabled in the sample workspace. Sign in with a live account to create a real project.",
    };
  }

  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    currencyCode: formData.get("currencyCode") ?? DEFAULT_CURRENCY_CODE,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Unable to create project.",
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      status: "error",
      message: "Supabase is not configured.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: "You must be signed in before creating a project.",
    };
  }

  const { data, error } = await supabase.rpc("create_project_with_owner", {
    p_name: parsed.data.name,
    p_description: parsed.data.description ?? null,
    p_currency_code: parsed.data.currencyCode,
  });

  if (error) {
    const missingRpc =
      error.code === "PGRST202" ||
      error.message.toLowerCase().includes("create_project_with_owner");

    return {
      status: "error",
      message: missingRpc
        ? "The database is missing the latest project-creation migration. Apply the newest SQL migration in Supabase, then try again."
        : error.message,
    };
  }

  const projectId = rpcResponseSchema.safeParse(data);

  if (!projectId.success) {
    return {
      status: "error",
      message: "Project was created, but the response payload was invalid.",
    };
  }

  revalidatePath("/projects");
  redirect(`/projects/${projectId.data}`);
}
