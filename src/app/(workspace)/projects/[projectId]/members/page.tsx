import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { ProjectMemberManager } from "@/components/finance/project-member-manager";
import { getSessionState } from "@/lib/auth/session";
import { getProjectSnapshot, getViewerProfile } from "@/lib/data/repository";
import { env } from "@/lib/env";
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
  const [snapshot, session, viewer] = await Promise.all([
    getProjectSnapshot(projectId),
    getSessionState(),
    getViewerProfile(),
  ]);

  if (!snapshot) {
    notFound();
  }

  const viewerMember = snapshot.dataset.members.find(
    (member) => member.userId === viewer?.userId
  );
  const canManageInvites =
    viewerMember?.role === "owner" || viewerMember?.role === "manager";

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
        eyebrow="Members"
        title={`Members in ${snapshot.dataset.project.name}`}
        description="Invite teammates into the project, share a self-join link, and keep the member list visible in one place."
      />

      <ProjectMemberManager
        projectId={snapshot.dataset.project.id}
        projectName={snapshot.dataset.project.name}
        liveModeEnabled={!session.demoMode}
        canManageInvites={canManageInvites}
        members={snapshot.memberSummaries
          .map((summary) => ({
            id: summary.projectMember.id,
            displayName: summary.profile.displayName,
            email: summary.profile.email,
            avatarUrl: summary.profile.avatarUrl,
            role: summary.projectMember.role,
            joinedAt: summary.projectMember.joinedAt,
          }))
          .sort((left, right) => left.displayName.localeCompare(right.displayName))}
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
