import type { MemberRole, ProjectDataset } from "@/lib/finance/types";

export function getViewerProjectRole(
  dataset: ProjectDataset,
  viewerUserId?: string | null
): MemberRole | null {
  if (!viewerUserId) {
    return null;
  }

  const membership = dataset.members.find(
    (member) => member.userId === viewerUserId && member.isActive
  );

  return membership?.role ?? null;
}

export function canManageProjectRole(role?: MemberRole | null) {
  return role === "owner" || role === "manager";
}
