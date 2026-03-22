"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionState } from "@/lib/auth/session";
import { getServerI18n } from "@/lib/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProjectTagActionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

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
  payload: { projectId: string; tagName: string }
): Promise<ProjectTagActionState> {
  const { locale } = await getServerI18n();
  const session = await getSessionState();
  const copy =
    locale === "vi"
      ? {
          nameMin: "Ten tag can co it nhat 2 ky tu.",
          nameMax: "Ten tag nen ngan hon 60 ky tu.",
          demoBlocked: "Khong the quan ly tag trong che do demo.",
          createFailed: "Khong the tao tag nay.",
          supabaseMissing: "Supabase chua duoc cau hinh.",
          signInRequired: "Ban can dang nhap de quan ly tag.",
          missingMigration:
            "Database live dang thieu migration tag moi nhat. Hay apply migration Supabase moi nhat roi thu lai.",
          saved: "Da luu tag.",
        }
      : {
          nameMin: "Tag name should be at least 2 characters.",
          nameMax: "Keep tag names under 60 characters.",
          demoBlocked: "Tag management is disabled in demo mode.",
          createFailed: "Unable to create this tag.",
          supabaseMissing: "Supabase is not configured.",
          signInRequired: "You must be signed in to manage tags.",
          missingMigration:
            "The live database is missing the latest tags migration. Apply the newest Supabase migration, then try again.",
          saved: "Tag saved.",
        };
  const projectTagSchema = z.object({
    projectId: z.string().min(1),
    tagName: z.string().trim().min(2, copy.nameMin).max(60, copy.nameMax),
  });

  if (session.demoMode) {
    return {
      status: "error",
      message: copy.demoBlocked,
    };
  }

  const parsed = projectTagSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? copy.createFailed,
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      status: "error",
      message: copy.supabaseMissing,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: copy.signInRequired,
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
        ? copy.missingMigration
        : error.message,
    };
  }

  revalidateProjectTagPaths(parsed.data.projectId);

  return {
    status: "success",
    message: copy.saved,
  };
}

export async function updateProjectTagAction(
  payload: { projectId: string; tagId: string; tagName: string }
): Promise<ProjectTagActionState> {
  const { locale } = await getServerI18n();
  const session = await getSessionState();
  const copy =
    locale === "vi"
      ? {
          nameMin: "Ten tag can co it nhat 2 ky tu.",
          nameMax: "Ten tag nen ngan hon 60 ky tu.",
          demoBlocked: "Khong the quan ly tag trong che do demo.",
          updateFailed: "Khong the cap nhat tag nay.",
          supabaseMissing: "Supabase chua duoc cau hinh.",
          signInRequired: "Ban can dang nhap de quan ly tag.",
          duplicateName:
            "Da co tag khac co ten tuong tu. Hay dat ten cu the hon.",
          missingMigration:
            "Database live dang thieu migration tag moi nhat. Hay apply migration Supabase moi nhat roi thu lai.",
          managerOnlyRename:
            "Trong live mode, chi manager cua du an moi duoc doi ten tag.",
          updated: "Da cap nhat tag.",
        }
      : {
          nameMin: "Tag name should be at least 2 characters.",
          nameMax: "Keep tag names under 60 characters.",
          demoBlocked: "Tag management is disabled in demo mode.",
          updateFailed: "Unable to update this tag.",
          supabaseMissing: "Supabase is not configured.",
          signInRequired: "You must be signed in to manage tags.",
          duplicateName:
            "Another tag already uses a similar name. Try a more specific tag.",
          missingMigration:
            "The live database is missing the latest tags migration. Apply the newest Supabase migration, then try again.",
          managerOnlyRename:
            "Only project managers can rename tags in live mode.",
          updated: "Tag updated.",
        };
  const existingProjectTagSchema = z.object({
    projectId: z.string().min(1),
    tagId: z.string().min(1),
    tagName: z.string().trim().min(2, copy.nameMin).max(60, copy.nameMax),
  });

  if (session.demoMode) {
    return {
      status: "error",
      message: copy.demoBlocked,
    };
  }

  const parsed = existingProjectTagSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? copy.updateFailed,
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      status: "error",
      message: copy.supabaseMissing,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: copy.signInRequired,
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
        message: copy.duplicateName,
      };
    }

    return {
      status: "error",
      message: isMissingTagUpgradeError(error)
        ? copy.missingMigration
        : error.message,
    };
  }

  if (!data) {
    return {
      status: "error",
      message: copy.managerOnlyRename,
    };
  }

  revalidateProjectTagPaths(parsed.data.projectId);

  return {
    status: "success",
    message: copy.updated,
  };
}

export async function deleteProjectTagAction(
  payload: { projectId: string; tagId: string }
): Promise<ProjectTagActionState> {
  const { locale } = await getServerI18n();
  const session = await getSessionState();
  const copy =
    locale === "vi"
      ? {
          demoBlocked: "Khong the quan ly tag trong che do demo.",
          deleteFailed: "Khong the xoa tag nay.",
          supabaseMissing: "Supabase chua duoc cau hinh.",
          signInRequired: "Ban can dang nhap de quan ly tag.",
          missingMigration:
            "Database live dang thieu migration tag-policy moi nhat. Hay apply migration Supabase moi nhat roi thu lai.",
          managerOnlyDelete:
            "Muon xoa tag can quyen manager va migration tag-policy moi nhat tren database live.",
          deleted: "Da xoa tag.",
        }
      : {
          demoBlocked: "Tag management is disabled in demo mode.",
          deleteFailed: "Unable to delete this tag.",
          supabaseMissing: "Supabase is not configured.",
          signInRequired: "You must be signed in to manage tags.",
          missingMigration:
            "The live database is missing the latest tag-policy migration. Apply the newest Supabase migration, then try again.",
          managerOnlyDelete:
            "Delete needs manager permission and the latest tag-policy migration in the live database.",
          deleted: "Tag deleted.",
        };

  if (session.demoMode) {
    return {
      status: "error",
      message: copy.demoBlocked,
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
      message: copy.deleteFailed,
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      status: "error",
      message: copy.supabaseMissing,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: copy.signInRequired,
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
        ? copy.missingMigration
        : error.message,
    };
  }

  if (!data || data.length === 0) {
    return {
      status: "error",
      message: copy.managerOnlyDelete,
    };
  }

  revalidateProjectTagPaths(parsed.data.projectId);

  return {
    status: "success",
    message: copy.deleted,
  };
}
