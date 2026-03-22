"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { DEFAULT_CURRENCY_CODE } from "@/lib/app-config";
import { getSessionState } from "@/lib/auth/session";
import { getServerI18n } from "@/lib/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const rpcResponseSchema = z.string().uuid();

export type ProjectActionState = {
  status: "idle" | "error";
  message?: string;
};

export async function createProjectAction(
  _previousState: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const { text } = await getServerI18n();
  const session = await getSessionState();
  const projectText = text.actions.projects;

  if (session.demoMode) {
    return {
      status: "error",
      message: projectText.demoBlocked,
    };
  }

  const parsed = z
    .object({
      name: z.string().trim().min(3, projectText.projectNameMin),
      description: z
        .string()
        .trim()
        .optional()
        .transform((value) => (value && value.length > 0 ? value : undefined)),
      currencyCode: z
        .string()
        .trim()
        .length(3, projectText.currencyInvalid)
        .transform((value) => value.toUpperCase()),
    })
    .safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    currencyCode: formData.get("currencyCode") ?? DEFAULT_CURRENCY_CODE,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? projectText.createFailed,
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      status: "error",
      message: text.actions.auth.supabaseMissing,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: projectText.signInRequired,
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
        ? projectText.missingMigration
        : error.message,
    };
  }

  const projectId = rpcResponseSchema.safeParse(data);

  if (!projectId.success) {
    return {
      status: "error",
      message: projectText.invalidResponse,
    };
  }

  revalidatePath("/projects");
  redirect(`/projects/${projectId.data}`);
}
