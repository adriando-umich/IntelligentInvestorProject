"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionState } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProjectTagActionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

const projectTagSchema = z.object({
  projectId: z.string().min(1),
  tagName: z.string().trim().min(2, "Tag name should be at least 2 characters.").max(60, "Keep tag names under 60 characters."),
});

const existingProjectTagSchema = projectTagSchema.extend({
  tagId: z.string().min(1),
});

function slugifyTagName(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "tag";
}

function isMissingTagUpgradeError(error: { code?: string; message?: string | null }) {
  const message = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();

  return (
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    message.includes("project_tags") ||
    message.includes("ledger_entry_tags")
  );
}

function revalidateProjectTagPaths(projectId: string) {
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/tags`);
  revalidatePath(`/projects/${projectId}/ledger/new`);
}

export async function createProjectTagAction(
  payload: z.input<typeof projectTagSchema>
): Promise<ProjectTagActionState> {
  const session = await getSessionState();

  if (session.demoMode) {
    return {
      status: "error",
      message: "Tag management is disabled in demo mode.",
    };
  }

  const parsed = projectTagSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Unable to create this tag.",
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
      message: "You must be signed in to manage tags.",
    };
  }

  const { error } = await supabase
    .from("project_tags")
    .upsert(
      {
        project_id: parsed.data.projectId,
        name: parsed.data.tagName,
        slug: slugifyTagName(parsed.data.tagName),
      },
      {
        onConflict: "project_id,slug",
      }
    )
    .select("id")
    .single();

  if (error) {
    return {
      status: "error",
      message: isMissingTagUpgradeError(error)
        ? "The live database is missing the tags migration. Apply the newest Supabase migration, then try again."
        : error.message,
    };
  }

  revalidateProjectTagPaths(parsed.data.projectId);

  return {
    status: "success",
    message: "Tag saved.",
  };
}

export async function updateProjectTagAction(
  payload: z.input<typeof existingProjectTagSchema>
): Promise<ProjectTagActionState> {
  const session = await getSessionState();

  if (session.demoMode) {
    return {
      status: "error",
      message: "Tag management is disabled in demo mode.",
    };
  }

  const parsed = existingProjectTagSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Unable to update this tag.",
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
      message: "You must be signed in to manage tags.",
    };
  }

  const { data, error } = await supabase
    .from("project_tags")
    .update({
      name: parsed.data.tagName,
      slug: slugifyTagName(parsed.data.tagName),
    })
    .eq("id", parsed.data.tagId)
    .eq("project_id", parsed.data.projectId)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        message: "Another tag already uses a similar name. Try a more specific tag.",
      };
    }

    return {
      status: "error",
      message: isMissingTagUpgradeError(error)
        ? "The live database is missing the tags migration. Apply the newest Supabase migration, then try again."
        : error.message,
    };
  }

  if (!data) {
    return {
      status: "error",
      message: "Only project managers can rename tags in live mode.",
    };
  }

  revalidateProjectTagPaths(parsed.data.projectId);

  return {
    status: "success",
    message: "Tag updated.",
  };
}

export async function deleteProjectTagAction(
  payload: { projectId: string; tagId: string }
): Promise<ProjectTagActionState> {
  const session = await getSessionState();

  if (session.demoMode) {
    return {
      status: "error",
      message: "Tag management is disabled in demo mode.",
    };
  }

  const parsed = z
    .object({
      projectId: z.string().min(1),
      tagId: z.string().min(1),
    })
    .safeParse(payload);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Unable to delete this tag.",
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
      message: "You must be signed in to manage tags.",
    };
  }

  const { data, error } = await supabase
    .from("project_tags")
    .delete()
    .eq("id", parsed.data.tagId)
    .eq("project_id", parsed.data.projectId)
    .select("id");

  if (error) {
    return {
      status: "error",
      message: isMissingTagUpgradeError(error)
        ? "The live database is missing the latest tag-policy migration. Apply the newest Supabase migration, then try again."
        : error.message,
    };
  }

  if (!data || data.length === 0) {
    return {
      status: "error",
      message:
        "Delete needs manager permission and the latest tag-policy migration in the live database.",
    };
  }

  revalidateProjectTagPaths(parsed.data.projectId);

  return {
    status: "success",
    message: "Tag deleted.",
  };
}
