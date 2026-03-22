"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { env } from "@/lib/env";
import { getSessionState } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createInviteSchema = z.object({
  projectId: z.string().uuid("Missing project ID."),
  email: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: "Use a valid email address or leave it blank for a reusable link.",
    }),
  role: z.enum(["member", "manager"]),
});

const revokeInviteSchema = z.object({
  projectId: z.string().uuid("Missing project ID."),
  inviteId: z.string().uuid("Missing invite ID."),
});

const acceptInviteSchema = z.object({
  inviteToken: z.string().trim().min(10, "Invite token is missing."),
});

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
  const session = await getSessionState();

  if (session.demoMode) {
    return {
      status: "error",
      message: "Invites are disabled in the sample workspace. Use a live project instead.",
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
      message: parsed.error.issues[0]?.message ?? "Unable to create invite.",
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      status: "error",
      message: "Supabase is not configured.",
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
        ? "The database is missing the latest invite migration. Apply the newest SQL migration in Supabase, then try again."
        : error.message,
    };
  }

  const invite = (Array.isArray(data) ? data[0] : data) as InviteRow | null;

  if (!invite?.invite_token) {
    return {
      status: "error",
      message: "Invite was created, but the response payload was incomplete.",
    };
  }

  const inviteLink = `${env.NEXT_PUBLIC_APP_URL}/join/${invite.invite_token}`;

  revalidatePath("/projects");
  revalidatePath(`/projects/${parsed.data.projectId}`);
  revalidatePath(`/projects/${parsed.data.projectId}/members`);

  return {
    status: "success",
    message: invite.email
      ? `Invite link ready for ${invite.email}. Only that email can accept it.`
      : "Reusable invite link created. Any signed-in user with the link can join.",
    inviteLink,
  };
}

export async function revokeProjectInviteAction(
  projectId: string,
  inviteId: string
): Promise<ProjectInviteActionState> {
  const session = await getSessionState();

  if (session.demoMode) {
    return {
      status: "error",
      message: "Invite revocation is disabled in the sample workspace.",
    };
  }

  const parsed = revokeInviteSchema.safeParse({ projectId, inviteId });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Unable to revoke invite.",
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      status: "error",
      message: "Supabase is not configured.",
    };
  }

  const { error } = await supabase.rpc("revoke_project_invite", {
    p_invite_id: parsed.data.inviteId,
  });

  if (error) {
    return {
      status: "error",
      message: isMissingInviteUpgrade(error)
        ? "The database is missing the latest invite migration. Apply the newest SQL migration in Supabase, then try again."
        : error.message,
    };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${parsed.data.projectId}`);
  revalidatePath(`/projects/${parsed.data.projectId}/members`);

  return {
    status: "success",
    message: "Invite revoked.",
  };
}

export async function acceptProjectInviteAction(
  _previousState: ProjectInviteActionState,
  formData: FormData
): Promise<ProjectInviteActionState> {
  const parsed = acceptInviteSchema.safeParse({
    inviteToken: formData.get("inviteToken"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Unable to accept invite.",
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
    redirect(`/sign-in?next=/join/${parsed.data.inviteToken}`);
  }

  const { data, error } = await supabase.rpc("accept_project_invite", {
    p_invite_token: parsed.data.inviteToken,
  });

  if (error) {
    return {
      status: "error",
      message: isMissingInviteUpgrade(error)
        ? "The database is missing the latest invite migration. Apply the newest SQL migration in Supabase, then try again."
        : error.message,
    };
  }

  const projectId = z.string().uuid().safeParse(data);

  if (!projectId.success) {
    return {
      status: "error",
      message: "Invite was accepted, but the project redirect target was invalid.",
    };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId.data}`);
  revalidatePath(`/projects/${projectId.data}/members`);

  redirect(`/projects/${projectId.data}`);
}
