import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { ProjectInviteAcceptCard } from "@/components/finance/project-invite-accept-card";
import { getServerI18n } from "@/lib/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type InvitePreview = {
  invite_id: string;
  project_id: string;
  project_name: string;
  project_description: string | null;
  invited_email: string | null;
  role: "manager" | "member";
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
};

export default async function JoinProjectPage({
  params,
}: {
  params: Promise<{ inviteToken: string }>;
}) {
  const { inviteToken } = await params;
  const { locale } = await getServerI18n();
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect("/sign-in");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?next=/join/${inviteToken}`);
  }

  const { data, error } = await supabase.rpc("get_project_invite_preview", {
    p_invite_token: inviteToken,
  });

  const preview = (Array.isArray(data) ? data[0] : data) as InvitePreview | null;

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-6">
      <PageHeader
        eyebrow={locale === "vi" ? "Lời mời dự án" : "Project invite"}
        title={
          preview?.project_name
            ? locale === "vi"
              ? `Tham gia ${preview.project_name}`
              : `Join ${preview.project_name}`
            : locale === "vi"
              ? "Tham gia dự án"
              : "Join a project"
        }
        description={
          preview?.project_description ??
            (locale === "vi"
              ? "Chấp nhận lời mời để vào workspace live của dự án."
              : "Accept the invite to enter the live project workspace.")
        }
      />

      {!preview || error ? (
        <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-6 py-6 text-sm leading-6 text-rose-800">
          {locale === "vi"
            ? "Không thể tải link mời này. Link có thể không hợp lệ, đã bị thu hồi hoặc đã hết hạn."
            : "This invite link could not be loaded. It may be invalid, revoked, or expired."}
        </div>
      ) : (
        <ProjectInviteAcceptCard
          inviteToken={inviteToken}
          projectName={preview.project_name}
          invitedEmail={preview.invited_email}
          role={preview.role}
          status={preview.status}
        />
      )}
    </div>
  );
}
