import type {
  MemberRole,
  ProjectDataset,
  ProjectMember,
} from "@/lib/finance/types";

export function getViewerProjectMembership(
  dataset: ProjectDataset,
  viewerUserId?: string | null
): ProjectMember | null {
  if (!viewerUserId) {
    return null;
  }

  return (
    dataset.members.find(
      (member) => member.userId === viewerUserId && member.isActive
    ) ?? null
  );
}

export function getViewerProjectRole(
  dataset: ProjectDataset,
  viewerUserId?: string | null
): MemberRole | null {
  return getViewerProjectMembership(dataset, viewerUserId)?.role ?? null;
}

export function canManageProjectRole(role?: MemberRole | null) {
  return role === "owner" || role === "manager";
}
