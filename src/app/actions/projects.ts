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
  status: "idle" | "error" | "success";
  message?: string;
};

function slugifyProjectName(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "project";
}

function buildProjectSlugCandidate(baseSlug: string, attempt: number) {
  if (attempt === 0) {
    return baseSlug;
  }

  if (attempt === 1) {
    return `${baseSlug}-copy`;
  }

  return `${baseSlug}-${attempt}`;
}

function isDuplicateSlugError(error: { code?: string; message?: string | null }) {
  const message = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();

  return error.code === "23505" && message.includes("slug");
}

function isPermissionError(error: { code?: string; message?: string | null }) {
  const message = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();

  return (
    error.code === "42501" ||
    message.includes("permission denied") ||
    message.includes("violates row-level security policy")
  );
}

async function getAuthenticatedSupabase() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { supabase: null, user: null };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

function revalidateProjectPaths(projectId: string) {
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/members`);
  revalidatePath(`/projects/${projectId}/capital`);
  revalidatePath(`/projects/${projectId}/tags`);
}

function isMissingOwnershipTransferMigration(error: {
  code?: string;
  message?: string | null;
}) {
  return (
    error.code === "PGRST202" ||
    error.message?.toLowerCase().includes("transfer_project_ownership") === true
  );
}

function isMissingRemoveProjectMemberMigration(error: {
  code?: string;
  message?: string | null;
}) {
  return (
    error.code === "PGRST202" ||
    error.message?.toLowerCase().includes("remove_project_member") === true
  );
}

function translateTransferOwnershipError(
  error: { message?: string | null },
  copy: {
    permissionDenied: string;
    invalidTarget: string;
    transferFailed: string;
  }
) {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("only the current project owner can transfer ownership")) {
    return copy.permissionDenied;
  }

  if (message.includes("new owner must be a different active project member")) {
    return copy.invalidTarget;
  }

  return error.message ?? copy.transferFailed;
}

function translateRemoveProjectMemberError(
  error: { message?: string | null },
  copy: {
    permissionDenied: string;
    invalidTarget: string;
    cannotRemoveSelf: string;
    cannotRemoveOwner: string;
    managerCannotRemoveRole: string;
    removeFailed: string;
  }
) {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("only project owners or managers can remove members")) {
    return copy.permissionDenied;
  }

  if (message.includes("target must be an active joined project member")) {
    return copy.invalidTarget;
  }

  if (message.includes("you cannot remove yourself from the project")) {
    return copy.cannotRemoveSelf;
  }

  if (message.includes("transfer ownership before removing the current owner")) {
    return copy.cannotRemoveOwner;
  }

  if (message.includes("managers can only remove project members")) {
    return copy.managerCannotRemoveRole;
  }

  return error.message ?? copy.removeFailed;
}

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

  const { supabase, user } = await getAuthenticatedSupabase();

  if (!supabase) {
    return {
      status: "error",
      message: text.actions.auth.supabaseMissing,
    };
  }

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
      message: missingRpc ? projectText.missingMigration : error.message,
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

export async function renameProjectAction(
  _previousState: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const { locale } = await getServerI18n();
  const session = await getSessionState();
  const copy =
    locale === "vi"
      ? {
          demoBlocked: "Khong the doi ten project trong demo mode.",
          nameMin: "Ten project can co it nhat 3 ky tu.",
          renameFailed: "Khong the doi ten project nay.",
          signInRequired: "Ban can dang nhap de doi ten project.",
          permissionDenied:
            "Chi owner hoac manager cua project moi duoc doi ten.",
          supabaseMissing: "Supabase chua duoc cau hinh.",
        }
      : {
          demoBlocked: "Project rename is disabled in demo mode.",
          nameMin: "Project name should be at least 3 characters.",
          renameFailed: "Unable to rename this project.",
          signInRequired: "You must be signed in to rename this project.",
          permissionDenied:
            "Only project owners and managers can rename this project.",
          supabaseMissing: "Supabase is not configured.",
        };

  if (session.demoMode) {
    return {
      status: "error",
      message: copy.demoBlocked,
    };
  }

  const parsed = z
    .object({
      projectId: z.string().uuid(),
      name: z.string().trim().min(3, copy.nameMin),
      redirectTo: z.string().trim().min(1).optional(),
    })
    .safeParse({
      projectId: formData.get("projectId"),
      name: formData.get("name"),
      redirectTo: formData.get("redirectTo"),
    });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? copy.renameFailed,
    };
  }

  const { supabase, user } = await getAuthenticatedSupabase();

  if (!supabase) {
    return {
      status: "error",
      message: copy.supabaseMissing,
    };
  }

  if (!user) {
    return {
      status: "error",
      message: copy.signInRequired,
    };
  }

  const baseSlug = slugifyProjectName(parsed.data.name);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const slug = buildProjectSlugCandidate(baseSlug, attempt);
    const { data, error } = await supabase
      .from("projects")
      .update({
        name: parsed.data.name,
        slug,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.projectId)
      .select("id")
      .single();

    if (!error && data) {
      revalidateProjectPaths(parsed.data.projectId);
      redirect(parsed.data.redirectTo ?? `/projects/${parsed.data.projectId}`);
    }

    if (error && isDuplicateSlugError(error)) {
      continue;
    }

    return {
      status: "error",
      message: error && isPermissionError(error)
        ? copy.permissionDenied
        : error?.message ?? copy.renameFailed,
    };
  }

  return {
    status: "error",
    message: copy.renameFailed,
  };
}

export async function duplicateProjectAction(
  _previousState: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const { locale, text } = await getServerI18n();
  const session = await getSessionState();
  const copy =
    locale === "vi"
      ? {
          demoBlocked: "Khong the duplicate project trong demo mode.",
          nameMin: "Ten project moi can co it nhat 3 ky tu.",
          duplicateFailed: "Khong the duplicate project nay.",
          signInRequired: "Ban can dang nhap de duplicate project.",
          permissionDenied:
            "Chi owner hoac manager cua project moi duoc duplicate.",
          sourceMissing: "Khong tim thay project goc de duplicate.",
          supabaseMissing: "Supabase chua duoc cau hinh.",
          missingMigration:
            "Database live dang thieu migration tao project moi nhat. Hay apply migration Supabase moi nhat roi thu lai.",
        }
      : {
          demoBlocked: "Project duplication is disabled in demo mode.",
          nameMin: "New project name should be at least 3 characters.",
          duplicateFailed: "Unable to duplicate this project.",
          signInRequired: "You must be signed in to duplicate this project.",
          permissionDenied:
            "Only project owners and managers can duplicate this project.",
          sourceMissing: "Unable to load the source project for duplication.",
          supabaseMissing: "Supabase is not configured.",
          missingMigration:
            "The live database is missing the latest project-creation migration. Apply the newest Supabase migration, then try again.",
        };

  if (session.demoMode) {
    return {
      status: "error",
      message: copy.demoBlocked,
    };
  }

  const parsed = z
    .object({
      sourceProjectId: z.string().uuid(),
      name: z.string().trim().min(3, copy.nameMin),
    })
    .safeParse({
      sourceProjectId: formData.get("sourceProjectId"),
      name: formData.get("name"),
    });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? copy.duplicateFailed,
    };
  }

  const { supabase, user } = await getAuthenticatedSupabase();

  if (!supabase) {
    return {
      status: "error",
      message: copy.supabaseMissing,
    };
  }

  if (!user) {
    return {
      status: "error",
      message: copy.signInRequired,
    };
  }

  const { data: sourceProject, error: sourceError } = await supabase
    .from("projects")
    .select("id, description, currency_code")
    .eq("id", parsed.data.sourceProjectId)
    .single();

  if (sourceError || !sourceProject) {
    return {
      status: "error",
      message:
        sourceError && isPermissionError(sourceError)
          ? copy.permissionDenied
          : copy.sourceMissing,
    };
  }

  const { data, error } = await supabase.rpc("create_project_with_owner", {
    p_name: parsed.data.name,
    p_description: sourceProject.description ?? null,
    p_currency_code: sourceProject.currency_code ?? DEFAULT_CURRENCY_CODE,
  });

  if (error) {
    const missingRpc =
      error.code === "PGRST202" ||
      error.message.toLowerCase().includes("create_project_with_owner");

    return {
      status: "error",
      message: missingRpc
        ? copy.missingMigration
        : isPermissionError(error)
          ? copy.permissionDenied
          : error.message ?? text.actions.projects.createFailed,
    };
  }

  const projectId = rpcResponseSchema.safeParse(data);

  if (!projectId.success) {
    return {
      status: "error",
      message: copy.duplicateFailed,
    };
  }

  revalidatePath("/projects");
  redirect(`/projects/${projectId.data}`);
}

export async function transferProjectOwnershipAction(
  projectId: string,
  nextOwnerProjectMemberId: string
): Promise<ProjectActionState> {
  const { locale } = await getServerI18n();
  const session = await getSessionState();
  const copy =
    locale === "vi"
      ? {
          missingProjectId: "Thieu project ID.",
          missingMemberId: "Thieu member ID.",
          demoBlocked: "Khong the chuyen ownership trong demo mode.",
          transferFailed: "Khong the chuyen ownership cho project nay.",
          signInRequired: "Ban can dang nhap de chuyen ownership.",
          permissionDenied:
            "Chi owner hien tai cua project moi duoc chuyen ownership.",
          invalidTarget:
            "Nguoi nhan ownership phai la mot thanh vien dang hoat dong khac trong project.",
          supabaseMissing: "Supabase chua duoc cau hinh.",
          missingMigration:
            "Database live dang thieu migration transfer ownership. Hay apply SQL migration moi nhat tren Supabase roi thu lai.",
          invalidResponse: "Phan hoi transfer ownership khong hop le.",
          transferred: "Da chuyen ownership cho thanh vien moi.",
        }
      : {
          missingProjectId: "Missing project ID.",
          missingMemberId: "Missing member ID.",
          demoBlocked: "Ownership transfer is disabled in demo mode.",
          transferFailed: "Unable to transfer project ownership.",
          signInRequired: "You must be signed in to transfer ownership.",
          permissionDenied:
            "Only the current project owner can transfer ownership.",
          invalidTarget:
            "The new owner must be a different active project member.",
          supabaseMissing: "Supabase is not configured.",
          missingMigration:
            "The live database is missing the ownership-transfer migration. Apply the newest SQL migration in Supabase, then try again.",
          invalidResponse: "Ownership transfer returned an invalid response.",
          transferred: "Project ownership transferred.",
        };

  if (session.demoMode) {
    return {
      status: "error",
      message: copy.demoBlocked,
    };
  }

  const parsed = z
    .object({
      projectId: z.string().uuid(copy.missingProjectId),
      nextOwnerProjectMemberId: z.string().uuid(copy.missingMemberId),
    })
    .safeParse({
      projectId,
      nextOwnerProjectMemberId,
    });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? copy.transferFailed,
    };
  }

  const { supabase, user } = await getAuthenticatedSupabase();

  if (!supabase) {
    return {
      status: "error",
      message: copy.supabaseMissing,
    };
  }

  if (!user) {
    return {
      status: "error",
      message: copy.signInRequired,
    };
  }

  const { data, error } = await supabase.rpc("transfer_project_ownership", {
    p_project_id: parsed.data.projectId,
    p_next_owner_project_member_id: parsed.data.nextOwnerProjectMemberId,
  });

  if (error) {
    return {
      status: "error",
      message: isMissingOwnershipTransferMigration(error)
        ? copy.missingMigration
        : translateTransferOwnershipError(error, copy),
    };
  }

  const response = rpcResponseSchema.safeParse(data);

  if (!response.success) {
    return {
      status: "error",
      message: copy.invalidResponse,
    };
  }

  revalidateProjectPaths(parsed.data.projectId);

  return {
    status: "success",
    message: copy.transferred,
  };
}

export async function removeProjectMemberAction(
  projectId: string,
  projectMemberId: string
): Promise<ProjectActionState> {
  const { locale } = await getServerI18n();
  const session = await getSessionState();
  const copy =
    locale === "vi"
      ? {
          missingProjectId: "Thieu project ID.",
          missingMemberId: "Thieu member ID.",
          demoBlocked: "Khong the remove member trong demo mode.",
          removeFailed: "Khong the remove member khoi project nay.",
          signInRequired: "Ban can dang nhap de remove member.",
          permissionDenied:
            "Chi owner hoac manager dang hoat dong moi duoc remove member.",
          invalidTarget:
            "Chi co the remove mot thanh vien dang hoat dong da tham gia project.",
          cannotRemoveSelf: "Ban khong the tu remove chinh minh khoi project.",
          cannotRemoveOwner:
            "Hay chuyen ownership truoc khi remove owner hien tai.",
          managerCannotRemoveRole:
            "Manager chi co the remove thanh vien thuong, khong remove owner hoac manager khac.",
          supabaseMissing: "Supabase chua duoc cau hinh.",
          missingMigration:
            "Database live dang thieu migration remove member. Hay apply SQL migration moi nhat tren Supabase roi thu lai.",
          invalidResponse: "Phan hoi remove member khong hop le.",
          removed: "Da remove member khoi project.",
        }
      : {
          missingProjectId: "Missing project ID.",
          missingMemberId: "Missing member ID.",
          demoBlocked: "Member removal is disabled in demo mode.",
          removeFailed: "Unable to remove this member from the project.",
          signInRequired: "You must be signed in to remove a member.",
          permissionDenied:
            "Only active project owners or managers can remove members.",
          invalidTarget:
            "Only an active joined project member can be removed.",
          cannotRemoveSelf: "You cannot remove yourself from the project.",
          cannotRemoveOwner:
            "Transfer ownership before removing the current owner.",
          managerCannotRemoveRole:
            "Managers can only remove regular members, not another manager or the owner.",
          supabaseMissing: "Supabase is not configured.",
          missingMigration:
            "The live database is missing the member-removal migration. Apply the newest SQL migration in Supabase, then try again.",
          invalidResponse: "Member removal returned an invalid response.",
          removed: "Member removed from the project.",
        };

  if (session.demoMode) {
    return {
      status: "error",
      message: copy.demoBlocked,
    };
  }

  const parsed = z
    .object({
      projectId: z.string().uuid(copy.missingProjectId),
      projectMemberId: z.string().uuid(copy.missingMemberId),
    })
    .safeParse({
      projectId,
      projectMemberId,
    });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? copy.removeFailed,
    };
  }

  const { supabase, user } = await getAuthenticatedSupabase();

  if (!supabase) {
    return {
      status: "error",
      message: copy.supabaseMissing,
    };
  }

  if (!user) {
    return {
      status: "error",
      message: copy.signInRequired,
    };
  }

  const { data, error } = await supabase.rpc("remove_project_member", {
    p_project_id: parsed.data.projectId,
    p_project_member_id: parsed.data.projectMemberId,
  });

  if (error) {
    return {
      status: "error",
      message: isMissingRemoveProjectMemberMigration(error)
        ? copy.missingMigration
        : translateRemoveProjectMemberError(error, copy),
    };
  }

  const response = rpcResponseSchema.safeParse(data);

  if (!response.success) {
    return {
      status: "error",
      message: copy.invalidResponse,
    };
  }

  revalidateProjectPaths(parsed.data.projectId);

  return {
    status: "success",
    message: copy.removed,
  };
}

export async function updateProjectStatusAction(
  _previousState: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const { locale } = await getServerI18n();
  const session = await getSessionState();
  const copy =
    locale === "vi"
      ? {
          demoBlocked: "Khong the doi trang thai project trong demo mode.",
          updateFailed: "Khong the cap nhat project nay.",
          signInRequired: "Ban can dang nhap de cap nhat project.",
          permissionDenied:
            "Chi owner hoac manager cua project moi duoc doi trang thai.",
          supabaseMissing: "Supabase chua duoc cau hinh.",
        }
      : {
          demoBlocked: "Project visibility changes are disabled in demo mode.",
          updateFailed: "Unable to update this project.",
          signInRequired: "You must be signed in to update this project.",
          permissionDenied:
            "Only project owners and managers can change project visibility.",
          supabaseMissing: "Supabase is not configured.",
        };

  if (session.demoMode) {
    return {
      status: "error",
      message: copy.demoBlocked,
    };
  }

  const parsed = z
    .object({
      projectId: z.string().uuid(),
      status: z.enum(["active", "archived", "closed"]),
      redirectTo: z.string().trim().min(1).optional(),
    })
    .safeParse({
      projectId: formData.get("projectId"),
      status: formData.get("status"),
      redirectTo: formData.get("redirectTo"),
    });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? copy.updateFailed,
    };
  }

  const { supabase, user } = await getAuthenticatedSupabase();

  if (!supabase) {
    return {
      status: "error",
      message: copy.supabaseMissing,
    };
  }

  if (!user) {
    return {
      status: "error",
      message: copy.signInRequired,
    };
  }

  const { data, error } = await supabase
    .from("projects")
    .update({
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.projectId)
    .select("id")
    .single();

  if (error || !data) {
    return {
      status: "error",
      message:
        error && isPermissionError(error)
          ? copy.permissionDenied
          : error?.message ?? copy.updateFailed,
    };
  }

  revalidateProjectPaths(parsed.data.projectId);
  redirect(parsed.data.redirectTo ?? "/projects");
}

export async function deleteProjectAction(
  _previousState: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const { locale } = await getServerI18n();
  const session = await getSessionState();
  const copy =
    locale === "vi"
      ? {
          demoBlocked: "Khong the xoa project trong demo mode.",
          deleteFailed: "Khong the xoa project nay.",
          signInRequired: "Ban can dang nhap de xoa project.",
          permissionDenied:
            "Chi owner hoac manager cua project moi duoc xoa project nay.",
          supabaseMissing: "Supabase chua duoc cau hinh.",
        }
      : {
          demoBlocked: "Project deletion is disabled in demo mode.",
          deleteFailed: "Unable to delete this project.",
          signInRequired: "You must be signed in to delete this project.",
          permissionDenied:
            "Only project owners and managers can delete this project.",
          supabaseMissing: "Supabase is not configured.",
        };

  if (session.demoMode) {
    return {
      status: "error",
      message: copy.demoBlocked,
    };
  }

  const parsed = z
    .object({
      projectId: z.string().uuid(),
      redirectTo: z.string().trim().min(1).optional(),
    })
    .safeParse({
      projectId: formData.get("projectId"),
      redirectTo: formData.get("redirectTo"),
    });

  if (!parsed.success) {
    return {
      status: "error",
      message: copy.deleteFailed,
    };
  }

  const { supabase, user } = await getAuthenticatedSupabase();

  if (!supabase) {
    return {
      status: "error",
      message: copy.supabaseMissing,
    };
  }

  if (!user) {
    return {
      status: "error",
      message: copy.signInRequired,
    };
  }

  const { data, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", parsed.data.projectId)
    .select("id");

  if (error || !data || data.length === 0) {
    return {
      status: "error",
      message:
        error && isPermissionError(error)
          ? copy.permissionDenied
          : error?.message ?? copy.deleteFailed,
    };
  }

  revalidatePath("/projects");
  redirect(parsed.data.redirectTo ?? "/projects");
}
