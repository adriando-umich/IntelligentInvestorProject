"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { env } from "@/lib/env";
import { getSessionState } from "@/lib/auth/session";
import { getServerI18n } from "@/lib/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type InviteRow = {
  id: string;
  invite_token: string;
  email: string | null;
  role: "member" | "manager";
};

export type ProjectInviteActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  inviteLink?: string;
};

function isMissingInviteUpgrade(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "PGRST202" ||
    error?.message?.toLowerCase().includes("project_invite") === true
  );
}

export async function createProjectInviteAction(
  _previousState: ProjectInviteActionState,
  formData: FormData
): Promise<ProjectInviteActionState> {
  const { locale } = await getServerI18n();
  const session = await getSessionState();
  const copy =
    locale === "vi"
      ? {
          missingProjectId: "Thieu project ID.",
          invalidEmailOrBlank:
            "Hay nhap email hop le hoac de trong neu muon tao link dung chung.",
          demoCreateBlocked:
            "Workspace mau khong bat tinh nang moi. Hay dung du an live.",
          createFailed: "Khong the tao loi moi.",
          supabaseMissing: "Supabase chua duoc cau hinh.",
          missingMigration:
            "Database dang thieu migration moi thanh vien moi nhat. Hay apply SQL migration moi nhat tren Supabase roi thu lai.",
          incompleteResponse:
            "Loi moi da duoc tao nhung payload phan hoi tra ve chua du.",
          targetedInviteReady:
            "Link moi da san sang. Chi email duoc chi dinh moi co the chap nhan.",
          reusableInviteReady:
            "Da tao link moi dung chung. Bat ky ai da dang nhap va co link deu co the tham gia.",
        }
      : {
          missingProjectId: "Missing project ID.",
          invalidEmailOrBlank:
            "Use a valid email address or leave it blank for a reusable link.",
          demoCreateBlocked:
            "Invites are disabled in the sample workspace. Use a live project instead.",
          createFailed: "Unable to create invite.",
          supabaseMissing: "Supabase is not configured.",
          missingMigration:
            "The database is missing the latest invite migration. Apply the newest SQL migration in Supabase, then try again.",
          incompleteResponse:
            "Invite was created, but the response payload was incomplete.",
          targetedInviteReady:
            "Invite link ready. Only the specified email can accept it.",
          reusableInviteReady:
            "Reusable invite link created. Any signed-in user with the link can join.",
        };
  const createInviteSchema = z.object({
    projectId: z.string().uuid(copy.missingProjectId),
    email: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined))
      .refine((value) => !value || z.string().email().safeParse(value).success, {
        message: copy.invalidEmailOrBlank,
      }),
    role: z.enum(["member", "manager"]),
  });

  if (session.demoMode) {
    return {
      status: "error",
      message: copy.demoCreateBlocked,
    };
  }

  const parsed = createInviteSchema.safeParse({
    projectId: formData.get("projectId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

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

  const { data, error } = await supabase.rpc("create_project_invite", {
    p_project_id: parsed.data.projectId,
    p_email: parsed.data.email ?? null,
    p_role: parsed.data.role,
  });

  if (error) {
    return {
      status: "error",
      message: isMissingInviteUpgrade(error)
        ? copy.missingMigration
        : error.message,
    };
  }

  const invite = (Array.isArray(data) ? data[0] : data) as InviteRow | null;

  if (!invite?.invite_token) {
    return {
      status: "error",
      message: copy.incompleteResponse,
    };
  }

  const inviteLink = `${env.NEXT_PUBLIC_APP_URL}/join/${invite.invite_token}`;

  revalidatePath("/projects");
  revalidatePath(`/projects/${parsed.data.projectId}`);
  revalidatePath(`/projects/${parsed.data.projectId}/members`);

  return {
    status: "success",
    message: invite.email
      ? locale === "vi"
        ? `Link moi da san sang cho ${invite.email}. Chi email nay moi co the chap nhan.`
        : `Invite link ready for ${invite.email}. Only that email can accept it.`
      : copy.reusableInviteReady,
    inviteLink,
  };
}

export async function revokeProjectInviteAction(
  projectId: string,
  inviteId: string
): Promise<ProjectInviteActionState> {
  const { locale } = await getServerI18n();
  const session = await getSessionState();
  const copy =
    locale === "vi"
      ? {
          missingProjectId: "Thieu project ID.",
          missingInviteId: "Thieu invite ID.",
          demoRevokeBlocked: "Workspace mau khong cho thu hoi loi moi.",
          revokeFailed: "Khong the thu hoi loi moi.",
          supabaseMissing: "Supabase chua duoc cau hinh.",
          missingMigration:
            "Database dang thieu migration moi thanh vien moi nhat. Hay apply SQL migration moi nhat tren Supabase roi thu lai.",
          revoked: "Da thu hoi loi moi.",
        }
      : {
          missingProjectId: "Missing project ID.",
          missingInviteId: "Missing invite ID.",
          demoRevokeBlocked:
            "Invite revocation is disabled in the sample workspace.",
          revokeFailed: "Unable to revoke invite.",
          supabaseMissing: "Supabase is not configured.",
          missingMigration:
            "The database is missing the latest invite migration. Apply the newest SQL migration in Supabase, then try again.",
          revoked: "Invite revoked.",
        };
  const revokeInviteSchema = z.object({
    projectId: z.string().uuid(copy.missingProjectId),
    inviteId: z.string().uuid(copy.missingInviteId),
  });

  if (session.demoMode) {
    return {
      status: "error",
      message: copy.demoRevokeBlocked,
    };
  }

  const parsed = revokeInviteSchema.safeParse({ projectId, inviteId });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? copy.revokeFailed,
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      status: "error",
      message: copy.supabaseMissing,
    };
  }

  const { error } = await supabase.rpc("revoke_project_invite", {
    p_invite_id: parsed.data.inviteId,
  });

  if (error) {
    return {
      status: "error",
      message: isMissingInviteUpgrade(error)
        ? copy.missingMigration
        : error.message,
    };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${parsed.data.projectId}`);
  revalidatePath(`/projects/${parsed.data.projectId}/members`);

  return {
    status: "success",
    message: copy.revoked,
  };
}

export async function acceptProjectInviteAction(
  _previousState: ProjectInviteActionState,
  formData: FormData
): Promise<ProjectInviteActionState> {
  const { locale } = await getServerI18n();
  const copy =
    locale === "vi"
      ? {
          inviteTokenMissing: "Thieu invite token.",
          acceptFailed: "Khong the chap nhan loi moi.",
          supabaseMissing: "Supabase chua duoc cau hinh.",
          missingMigration:
            "Database dang thieu migration moi thanh vien moi nhat. Hay apply SQL migration moi nhat tren Supabase roi thu lai.",
          invalidRedirect:
            "Da chap nhan loi moi nhung diem dich chuyen huong toi du an khong hop le.",
        }
      : {
          inviteTokenMissing: "Invite token is missing.",
          acceptFailed: "Unable to accept invite.",
          supabaseMissing: "Supabase is not configured.",
          missingMigration:
            "The database is missing the latest invite migration. Apply the newest SQL migration in Supabase, then try again.",
          invalidRedirect:
            "Invite was accepted, but the project redirect target was invalid.",
        };
  const acceptInviteSchema = z.object({
    inviteToken: z.string().trim().min(10, copy.inviteTokenMissing),
  });

  const parsed = acceptInviteSchema.safeParse({
    inviteToken: formData.get("inviteToken"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? copy.acceptFailed,
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
    redirect(`/sign-in?next=/join/${parsed.data.inviteToken}`);
  }

  const { data, error } = await supabase.rpc("accept_project_invite", {
    p_invite_token: parsed.data.inviteToken,
  });

  if (error) {
    return {
      status: "error",
      message: isMissingInviteUpgrade(error)
        ? copy.missingMigration
        : error.message,
    };
  }

  const projectId = z.string().uuid().safeParse(data);

  if (!projectId.success) {
    return {
      status: "error",
      message: copy.invalidRedirect,
    };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId.data}`);
  revalidatePath(`/projects/${projectId.data}/members`);

  redirect(`/projects/${projectId.data}`);
}
