export type GovernedMemberRole = "owner" | "manager" | "member";

export type GovernedMembershipStatus = "active" | "pending_invite";

export type GovernedMemberSummary = {
  id: string;
  role: GovernedMemberRole;
  membershipStatus: GovernedMembershipStatus;
};

export function canTransferOwnershipToMember(args: {
  liveModeEnabled: boolean;
  canTransferOwnership: boolean;
  viewerProjectMemberId: string | null;
  member: GovernedMemberSummary;
}) {
  const {
    liveModeEnabled,
    canTransferOwnership,
    viewerProjectMemberId,
    member,
  } = args;

  return (
    liveModeEnabled &&
    canTransferOwnership &&
    member.membershipStatus === "active" &&
    member.role !== "owner" &&
    member.id !== viewerProjectMemberId
  );
}

export function canRemoveProjectMember(args: {
  liveModeEnabled: boolean;
  viewerProjectMemberId: string | null;
  viewerRole: GovernedMemberRole | null;
  member: GovernedMemberSummary;
}) {
  const { liveModeEnabled, viewerProjectMemberId, viewerRole, member } = args;

  if (!liveModeEnabled) {
    return false;
  }

  if (viewerRole !== "owner" && viewerRole !== "manager") {
    return false;
  }

  if (member.membershipStatus !== "active") {
    return false;
  }

  if (member.id === viewerProjectMemberId) {
    return false;
  }

  if (member.role === "owner") {
    return false;
  }

  if (viewerRole === "manager" && member.role !== "member") {
    return false;
  }

  return true;
}
