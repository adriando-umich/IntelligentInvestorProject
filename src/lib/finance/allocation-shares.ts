const SHARE_PERCENT_SCALE = 100;
const SHARE_EPSILON = 0.01;

export type AllocationShareInput = {
  projectMemberId: string;
  weightPercent: number;
};

export type AllocationSharePreview = AllocationShareInput & {
  amount: number;
};

function roundToCents(value: number) {
  return Math.round(value * 100) / 100;
}

function truncateToCents(value: number) {
  return Math.trunc(value * 100) / 100;
}

function sanitizePositiveNumber(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value;
}

export function buildEqualAllocationShares(
  projectMemberIds: string[]
): AllocationShareInput[] {
  if (projectMemberIds.length === 0) {
    return [];
  }

  const basePercent = truncateToCents(
    SHARE_PERCENT_SCALE / projectMemberIds.length
  );
  const allocatedPercent = roundToCents(basePercent * projectMemberIds.length);
  const remainderPercent = roundToCents(
    SHARE_PERCENT_SCALE - allocatedPercent
  );

  return projectMemberIds.map((projectMemberId, index) => ({
    projectMemberId,
    weightPercent:
      index === projectMemberIds.length - 1
        ? roundToCents(basePercent + remainderPercent)
        : basePercent,
  }));
}

export function normalizeAllocationShares(
  shares: AllocationShareInput[]
): AllocationShareInput[] {
  if (shares.length === 0) {
    return [];
  }

  const positiveShares = shares.map((share) => ({
    projectMemberId: share.projectMemberId,
    weightPercent: sanitizePositiveNumber(share.weightPercent),
  }));
  const totalWeight = positiveShares.reduce(
    (sum, share) => sum + share.weightPercent,
    0
  );

  if (totalWeight <= SHARE_EPSILON) {
    return buildEqualAllocationShares(
      positiveShares.map((share) => share.projectMemberId)
    );
  }

  let distributedPercent = 0;

  return positiveShares.map((share, index) => {
    if (index === positiveShares.length - 1) {
      return {
        projectMemberId: share.projectMemberId,
        weightPercent: roundToCents(
          SHARE_PERCENT_SCALE - distributedPercent
        ),
      };
    }

    const normalizedPercent = truncateToCents(
      (share.weightPercent / totalWeight) * SHARE_PERCENT_SCALE
    );
    distributedPercent = roundToCents(
      distributedPercent + normalizedPercent
    );

    return {
      projectMemberId: share.projectMemberId,
      weightPercent: normalizedPercent,
    };
  });
}

export function reconcileCustomAllocationShares(
  projectMemberIds: string[],
  currentShares: AllocationShareInput[]
) {
  if (projectMemberIds.length === 0) {
    return [];
  }

  const shareById = new Map(
    currentShares.map((share) => [share.projectMemberId, share.weightPercent])
  );
  const hasNewMember = projectMemberIds.some((memberId) => !shareById.has(memberId));

  if (hasNewMember) {
    return buildEqualAllocationShares(projectMemberIds);
  }

  return normalizeAllocationShares(
    projectMemberIds.map((projectMemberId) => ({
      projectMemberId,
      weightPercent: shareById.get(projectMemberId) ?? 0,
    }))
  );
}

export function computeAllocationAmountPreviews(
  totalAmount: number,
  shares: AllocationShareInput[]
): AllocationSharePreview[] {
  const normalizedShares = normalizeAllocationShares(shares);
  const safeAmount = Math.max(roundToCents(totalAmount), 0);

  if (normalizedShares.length === 0) {
    return [];
  }

  let distributedAmount = 0;

  return normalizedShares.map((share, index) => {
    if (index === normalizedShares.length - 1) {
      return {
        ...share,
        amount: roundToCents(safeAmount - distributedAmount),
      };
    }

    const amount = truncateToCents(
      safeAmount * (share.weightPercent / SHARE_PERCENT_SCALE)
    );
    distributedAmount = roundToCents(distributedAmount + amount);

    return {
      ...share,
      amount,
    };
  });
}

export function buildAllocationSharesFromAllocations(
  projectMemberIds: string[],
  entryAmount: number,
  allocations: Array<{
    projectMemberId: string;
    amount: number;
    weightPercent?: number | null;
  }>
) {
  if (projectMemberIds.length === 0) {
    return [];
  }

  const allocationsByMemberId = new Map(
    allocations.map((allocation) => [allocation.projectMemberId, allocation])
  );

  const shares = projectMemberIds.map((projectMemberId) => {
    const allocation = allocationsByMemberId.get(projectMemberId);

    if (!allocation) {
      return {
        projectMemberId,
        weightPercent: 0,
      };
    }

    if (
      typeof allocation.weightPercent === "number" &&
      Number.isFinite(allocation.weightPercent) &&
      allocation.weightPercent > 0
    ) {
      return {
        projectMemberId,
        weightPercent: roundToCents(allocation.weightPercent * SHARE_PERCENT_SCALE),
      };
    }

    if (entryAmount > SHARE_EPSILON) {
      return {
        projectMemberId,
        weightPercent: roundToCents(
          (allocation.amount / entryAmount) * SHARE_PERCENT_SCALE
        ),
      };
    }

    return {
      projectMemberId,
      weightPercent: 0,
    };
  });

  return normalizeAllocationShares(shares);
}

export function inferAllocationSplitMode(shares: AllocationShareInput[]) {
  if (shares.length <= 1) {
    return "equal" as const;
  }

  const equalShares = buildEqualAllocationShares(
    shares.map((share) => share.projectMemberId)
  );

  const isEqual = shares.every((share, index) => {
    const equalShare = equalShares[index];
    return (
      equalShare?.projectMemberId === share.projectMemberId &&
      Math.abs(equalShare.weightPercent - share.weightPercent) <= SHARE_EPSILON
    );
  });

  return isEqual ? ("equal" as const) : ("custom" as const);
}

export function areAllocationSharesEqual(
  left: AllocationShareInput[],
  right: AllocationShareInput[]
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((share, index) => {
    const other = right[index];

    return (
      share.projectMemberId === other?.projectMemberId &&
      Math.abs(share.weightPercent - other.weightPercent) <= SHARE_EPSILON
    );
  });
}
