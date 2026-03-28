import type {
  LedgerAllocation,
  LedgerEntry,
  Profile,
  ProfitDistributionLine,
  ProfitDistributionRun,
  ProjectDataset,
  ProjectMember,
  ProjectMemberActivity,
  ReconciliationCheck,
  ReconciliationStatus,
} from "@/lib/finance/types";

function normalizeEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

function memberIdentityKey(
  member: ProjectMember,
  profilesByUserId: Map<string, Profile>
) {
  const profileEmail = normalizeEmail(profilesByUserId.get(member.userId)?.email);
  const pendingEmail = normalizeEmail(member.pendingEmail);

  if (profileEmail) {
    return `email:${profileEmail}`;
  }

  if (pendingEmail) {
    return `email:${pendingEmail}`;
  }

  return member.membershipStatus === "pending_invite"
    ? `pending:${member.id}`
    : `user:${member.userId}`;
}

function buildMemberReferenceCounts(dataset: ProjectDataset) {
  const counts = new Map<string, number>();

  const bump = (projectMemberId?: string | null) => {
    if (!projectMemberId) {
      return;
    }

    counts.set(projectMemberId, (counts.get(projectMemberId) ?? 0) + 1);
  };

  for (const member of dataset.members) {
    counts.set(member.id, 0);
  }

  for (const entry of dataset.entries) {
    bump(entry.cashInMemberId);
    bump(entry.cashOutMemberId);
  }

  for (const allocation of dataset.allocations) {
    bump(allocation.projectMemberId);
  }

  for (const run of dataset.profitDistributionRuns) {
    bump(run.cashOutProjectMemberId ?? run.cashOutMemberId);
  }

  for (const line of dataset.profitDistributionLines) {
    bump(line.projectMemberId);
  }

  for (const check of dataset.reconciliationChecks) {
    bump(check.projectMemberId);
  }

  for (const activity of dataset.projectMemberActivities ?? []) {
    bump(activity.actorProjectMemberId);
    bump(activity.targetProjectMemberId);
  }

  return counts;
}

function isBetterCanonicalCandidate(
  candidate: ProjectMember,
  current: ProjectMember,
  referenceCounts: Map<string, number>
) {
  if (candidate.isActive !== current.isActive) {
    return candidate.isActive;
  }

  const candidateAccepted = candidate.membershipStatus !== "pending_invite";
  const currentAccepted = current.membershipStatus !== "pending_invite";
  if (candidateAccepted !== currentAccepted) {
    return candidateAccepted;
  }

  const candidateReferences = referenceCounts.get(candidate.id) ?? 0;
  const currentReferences = referenceCounts.get(current.id) ?? 0;
  if (candidateReferences !== currentReferences) {
    return candidateReferences > currentReferences;
  }

  const candidateJoinedAt = new Date(candidate.joinedAt).getTime();
  const currentJoinedAt = new Date(current.joinedAt).getTime();
  if (candidateJoinedAt !== currentJoinedAt) {
    return candidateJoinedAt < currentJoinedAt;
  }

  return candidate.id < current.id;
}

function combineNotes(...notes: Array<string | null | undefined>) {
  const uniqueNotes = [...new Set(
    notes
      .map((note) => note?.trim())
      .filter((note): note is string => Boolean(note))
  )];

  return uniqueNotes.length > 0 ? uniqueNotes.join("\n\n") : null;
}

function mergeLedgerAllocations(allocations: LedgerAllocation[]) {
  const allocationByKey = new Map<string, LedgerAllocation>();

  for (const allocation of allocations) {
    const key = [
      allocation.ledgerEntryId,
      allocation.projectMemberId,
      allocation.allocationType,
    ].join("::");
    const current = allocationByKey.get(key);

    if (!current) {
      allocationByKey.set(key, { ...allocation });
      continue;
    }

    current.amount += allocation.amount;
    current.weightPercent =
      current.weightPercent == null && allocation.weightPercent == null
        ? null
        : (current.weightPercent ?? 0) + (allocation.weightPercent ?? 0);
    current.note = combineNotes(current.note, allocation.note);
  }

  return [...allocationByKey.values()];
}

function mergeProfitDistributionLines(lines: ProfitDistributionLine[]) {
  const lineByKey = new Map<string, ProfitDistributionLine>();

  for (const line of lines) {
    const key = `${line.runId}::${line.projectMemberId}`;
    const current = lineByKey.get(key);

    if (!current) {
      lineByKey.set(key, { ...line });
      continue;
    }

    current.capitalBalanceSnapshot += line.capitalBalanceSnapshot;
    current.weightBasisAmount += line.weightBasisAmount;
    current.weightPercent += line.weightPercent;
    current.distributionAmount += line.distributionAmount;
  }

  return [...lineByKey.values()];
}

const reconciliationStatusRank: Record<ReconciliationStatus, number> = {
  pending: 0,
  matched: 1,
  variance_found: 2,
  accepted: 3,
  adjustment_posted: 4,
};

function pickHigherReconciliationStatus(
  left: ReconciliationStatus,
  right: ReconciliationStatus
) {
  return reconciliationStatusRank[right] > reconciliationStatusRank[left]
    ? right
    : left;
}

function mergeReconciliationChecks(checks: ReconciliationCheck[]) {
  const checkByKey = new Map<string, ReconciliationCheck>();

  for (const check of checks) {
    const key = `${check.runId}::${check.projectMemberId}`;
    const current = checkByKey.get(key);

    if (!current) {
      checkByKey.set(key, { ...check });
      continue;
    }

    current.expectedProjectCash += check.expectedProjectCash;
    current.reportedProjectCash =
      current.reportedProjectCash == null && check.reportedProjectCash == null
        ? null
        : (current.reportedProjectCash ?? 0) + (check.reportedProjectCash ?? 0);
    current.varianceAmount =
      current.varianceAmount == null && check.varianceAmount == null
        ? null
        : (current.varianceAmount ?? 0) + (check.varianceAmount ?? 0);
    current.status = pickHigherReconciliationStatus(current.status, check.status);
    current.memberNote = combineNotes(current.memberNote, check.memberNote);
    current.reviewNote = combineNotes(current.reviewNote, check.reviewNote);
    current.submittedBy = current.submittedBy ?? check.submittedBy ?? null;
    current.submittedAt =
      current.submittedAt == null
        ? (check.submittedAt ?? null)
        : check.submittedAt == null
          ? current.submittedAt
          : current.submittedAt > check.submittedAt
            ? current.submittedAt
            : check.submittedAt;
    current.reviewedBy = current.reviewedBy ?? check.reviewedBy ?? null;
    current.reviewedAt =
      current.reviewedAt == null
        ? (check.reviewedAt ?? null)
        : check.reviewedAt == null
          ? current.reviewedAt
          : current.reviewedAt > check.reviewedAt
            ? current.reviewedAt
            : check.reviewedAt;
  }

  return [...checkByKey.values()];
}

function remapProjectMemberActivity(
  activity: ProjectMemberActivity,
  canonicalProjectMemberIdByAlias: Record<string, string>
) {
  return {
    ...activity,
    actorProjectMemberId:
      canonicalProjectMemberIdByAlias[activity.actorProjectMemberId] ??
      activity.actorProjectMemberId,
    targetProjectMemberId:
      canonicalProjectMemberIdByAlias[activity.targetProjectMemberId] ??
      activity.targetProjectMemberId,
  };
}

export function canonicalizeProjectDatasetMembers(
  dataset: ProjectDataset
): ProjectDataset {
  const profilesByUserId = new Map(
    dataset.profiles.map((profile) => [profile.userId, profile])
  );
  const referenceCounts = buildMemberReferenceCounts(dataset);
  const canonicalByIdentity = new Map<string, ProjectMember>();
  const identityByMemberId = new Map<string, string>();

  for (const member of dataset.members) {
    const identity = memberIdentityKey(member, profilesByUserId);
    identityByMemberId.set(member.id, identity);

    const current = canonicalByIdentity.get(identity);
    if (!current || isBetterCanonicalCandidate(member, current, referenceCounts)) {
      canonicalByIdentity.set(identity, member);
    }
  }

  const canonicalProjectMemberIdByAlias = Object.fromEntries(
    dataset.members
      .filter((member) => {
        const identity = identityByMemberId.get(member.id);
        return identity != null && canonicalByIdentity.get(identity)?.id !== member.id;
      })
      .map((member) => {
        const identity = identityByMemberId.get(member.id)!;
        return [member.id, canonicalByIdentity.get(identity)!.id];
      })
  ) satisfies Record<string, string>;

  if (Object.keys(canonicalProjectMemberIdByAlias).length === 0) {
    return dataset;
  }

  const remapProjectMemberId = (projectMemberId?: string | null) =>
    projectMemberId == null
      ? projectMemberId
      : (canonicalProjectMemberIdByAlias[projectMemberId] ?? projectMemberId);

  return {
    ...dataset,
    members: dataset.members.filter(
      (member) => canonicalProjectMemberIdByAlias[member.id] == null
    ),
    entries: dataset.entries.map((entry) => ({
      ...entry,
      cashInMemberId: remapProjectMemberId(entry.cashInMemberId),
      cashOutMemberId: remapProjectMemberId(entry.cashOutMemberId),
    })),
    allocations: mergeLedgerAllocations(
      dataset.allocations.map((allocation) => ({
        ...allocation,
        projectMemberId:
          canonicalProjectMemberIdByAlias[allocation.projectMemberId] ??
          allocation.projectMemberId,
      }))
    ),
    profitDistributionRuns: dataset.profitDistributionRuns.map((run) => ({
      ...run,
      cashOutMemberId: remapProjectMemberId(run.cashOutMemberId),
      cashOutProjectMemberId: remapProjectMemberId(run.cashOutProjectMemberId),
    })),
    profitDistributionLines: mergeProfitDistributionLines(
      dataset.profitDistributionLines.map((line) => ({
        ...line,
        projectMemberId:
          canonicalProjectMemberIdByAlias[line.projectMemberId] ??
          line.projectMemberId,
      }))
    ),
    reconciliationChecks: mergeReconciliationChecks(
      dataset.reconciliationChecks.map((check) => ({
        ...check,
        projectMemberId:
          canonicalProjectMemberIdByAlias[check.projectMemberId] ??
          check.projectMemberId,
      }))
    ),
    projectMemberActivities: (dataset.projectMemberActivities ?? []).map((activity) =>
      remapProjectMemberActivity(activity, canonicalProjectMemberIdByAlias)
    ),
    projectMemberCanonicalIdByAlias: {
      ...(dataset.projectMemberCanonicalIdByAlias ?? {}),
      ...canonicalProjectMemberIdByAlias,
    },
  };
}

export function resolveCanonicalProjectMemberId(
  dataset: Pick<ProjectDataset, "projectMemberCanonicalIdByAlias">,
  projectMemberId?: string | null
) {
  return projectMemberId == null
    ? projectMemberId
    : (dataset.projectMemberCanonicalIdByAlias?.[projectMemberId] ?? projectMemberId);
}
