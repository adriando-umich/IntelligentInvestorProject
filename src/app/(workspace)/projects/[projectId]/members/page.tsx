import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { ProjectMemberManager } from "@/components/finance/project-member-manager";
import { getSessionState } from "@/lib/auth/session";
import { getProjectSnapshot, getViewerProfile } from "@/lib/data/repository";
import { env } from "@/lib/env";
import { getServerI18n } from "@/lib/i18n/server";
import { getViewerProjectMembership } from "@/lib/projects/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DbProjectInviteRow = {
  id: string;
  email: string | null;
  role: "manager" | "member";
  status: "pending" | "accepted" | "revoked" | "expired";
  invite_token: string;
  expires_at: string;
  created_at: string;
};

export default async function ProjectMembersPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [{ locale }, snapshot, session, viewer] = await Promise.all([
    getServerI18n(),
    getProjectSnapshot(projectId),
    getSessionState(),
    getViewerProfile(),
  ]);

  if (!snapshot) {
    notFound();
  }

  const viewerMember = getViewerProjectMembership(snapshot.dataset, viewer?.userId);
  const canManageInvites =
    viewerMember?.role === "owner" || viewerMember?.role === "manager";
  const canTransferOwnership = viewerMember?.role === "owner";
  const displayNameByProjectMemberId = new Map(
    snapshot.memberSummaries.map((summary) => [
      summary.projectMember.id,
      summary.profile.displayName,
    ])
  );

  let invites: DbProjectInviteRow[] = [];

  if (!session.demoMode && canManageInvites) {
    const supabase = await createSupabaseServerClient();

    if (supabase) {
      const { data, error } = await supabase
        .from("project_invites")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .returns<DbProjectInviteRow[]>();

      if (!error && data) {
        invites = data;
      } else if (error) {
        console.error("Unable to load project invites", error);
      }
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={locale === "vi" ? "Thành viên" : "Members"}
        title={
          locale === "vi"
            ? `Thành viên trong ${snapshot.dataset.project.name}`
            : `Members in ${snapshot.dataset.project.name}`
        }
        description={
          locale === "vi"
            ? "Mời đồng đội vào dự án, chia sẻ link tự tham gia và giữ danh sách thành viên rõ ràng ở một nơi."
            : "Invite teammates into the project, share a self-join link, and keep the member list visible in one place."
        }
      />

      <ProjectMemberManager
        projectId={snapshot.dataset.project.id}
        projectName={snapshot.dataset.project.name}
        liveModeEnabled={!session.demoMode}
        canManageInvites={canManageInvites}
        canTransferOwnership={canTransferOwnership}
        viewerProjectMemberId={viewerMember?.id ?? null}
        viewerRole={viewerMember?.role ?? null}
        members={snapshot.memberSummaries
          .filter((summary) => summary.projectMember.isActive)
          .map((summary) => ({
            id: summary.projectMember.id,
            displayName: summary.profile.displayName,
            email: summary.profile.email,
            avatarUrl: summary.profile.avatarUrl,
            role: summary.projectMember.role,
            joinedAt: summary.projectMember.joinedAt,
            membershipStatus:
              summary.projectMember.membershipStatus ?? "active",
          }))
          .sort((left, right) => left.displayName.localeCompare(right.displayName))}
        memberActivity={(snapshot.dataset.projectMemberActivities ?? [])
          .map((activity) => ({
            id: activity.id,
            actorDisplayName:
              displayNameByProjectMemberId.get(activity.actorProjectMemberId) ??
              (locale === "vi" ? "Thanh vien khong ro" : "Unknown member"),
            targetDisplayName:
              displayNameByProjectMemberId.get(activity.targetProjectMemberId) ??
              (locale === "vi" ? "Thanh vien khong ro" : "Unknown member"),
            eventType: activity.eventType,
            occurredAt: activity.occurredAt,
          }))
          .sort(
            (left, right) =>
              new Date(right.occurredAt).getTime() -
              new Date(left.occurredAt).getTime()
          )
          .slice(0, 6)}
        invites={invites.map((invite) => ({
          id: invite.id,
          email: invite.email,
          role: invite.role,
          status: invite.status,
          expiresAt: invite.expires_at,
          createdAt: invite.created_at,
          inviteLink: `${env.NEXT_PUBLIC_APP_URL}/join/${invite.invite_token}`,
        }))}
      />
    </div>
  );
}
