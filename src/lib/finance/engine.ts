import {
  type CapitalWeightRow,
  type LedgerAllocation,
  type LedgerEntry,
  type MemberFinanceSummary,
  type MemberStatementSnapshot,
  type ProjectDataset,
  type ProjectMember,
  type ProjectSnapshot,
  type ReconciliationCheckView,
  type ReconciliationProjectAccountingView,
  type SettlementSuggestion,
  type TagRollupRow,
} from "@/lib/finance/types";
import { roundMoney } from "@/lib/format";

const EPSILON = 0.01;
type BuildProjectSnapshotOptions = {
  skipOpenReconciliation?: boolean;
};

function byDateAsc<T extends { effectiveAt?: string; createdAt?: string }>(
  a: T,
  b: T
) {
  const effectiveDelta =
    new Date(a.effectiveAt ?? 0).getTime() - new Date(b.effectiveAt ?? 0).getTime();

  if (effectiveDelta !== 0) {
    return effectiveDelta;
  }

  return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
}

function byDateDesc<T extends { effectiveAt?: string; createdAt?: string }>(
  a: T,
  b: T
) {
  return -byDateAsc(a, b);
}

function getAllocationsForEntry(
  entryId: string,
  allocations: LedgerAllocation[],
  allocationType?: LedgerAllocation["allocationType"]
) {
  return allocations.filter(
    (allocation) =>
      allocation.ledgerEntryId === entryId &&
      (!allocationType || allocation.allocationType === allocationType)
  );
}

function buildTagRollups(
  dataset: ProjectDataset,
  postedEntries: LedgerEntry[],
  entryTypes: LedgerEntry["entryType"][]
) {
  const includedTypes = new Set(entryTypes);
  const tagById = new Map(dataset.tags.map((tag) => [tag.id, tag]));
  const tagIdsByEntryId = new Map<string, string[]>();

  for (const entryTag of dataset.entryTags) {
    const current = tagIdsByEntryId.get(entryTag.ledgerEntryId) ?? [];
    current.push(entryTag.projectTagId);
    tagIdsByEntryId.set(entryTag.ledgerEntryId, current);
  }

  const rollups = new Map<string, TagRollupRow>();

  for (const entry of postedEntries) {
    if (!includedTypes.has(entry.entryType)) {
      continue;
    }

    const projectTagIds = [...new Set(tagIdsByEntryId.get(entry.id) ?? [])];

    for (const projectTagId of projectTagIds) {
      const tag = tagById.get(projectTagId);

      if (!tag) {
        continue;
      }

      const current = rollups.get(projectTagId) ?? {
        projectTagId,
        name: tag.name,
        slug: tag.slug,
        amount: 0,
        entryCount: 0,
      };

      current.amount = roundMoney(current.amount + entry.amount);
      current.entryCount += 1;
      rollups.set(projectTagId, current);
    }
  }

  return [...rollups.values()].sort((left, right) => right.amount - left.amount);
}

function applyCashMovement(
  summariesByMemberRef: Map<string, MemberFinanceSummary>,
  entry: LedgerEntry,
  factor: number
) {
  if (entry.cashInMemberId) {
    const receiver = summariesByMemberRef.get(entry.cashInMemberId);
    if (receiver) {
      receiver.projectCashCustody = roundMoney(
        receiver.projectCashCustody + entry.amount * factor
      );
    }
  }

  if (entry.cashOutMemberId) {
    const payer = summariesByMemberRef.get(entry.cashOutMemberId);
    if (payer) {
      payer.projectCashCustody = roundMoney(
        payer.projectCashCustody - entry.amount * factor
      );
    }
  }
}

function getFrontedOwnMoneyDelta(beforeCashCustody: number, afterCashCustody: number) {
  return roundMoney(
    Math.max(-afterCashCustody, 0) - Math.max(-beforeCashCustody, 0)
  );
}

function filterProjectDatasetAsOf(
  dataset: ProjectDataset,
  asOf: string
): ProjectDataset {
  const cutoff = new Date(asOf).getTime();

  if (!Number.isFinite(cutoff)) {
    return {
      ...dataset,
      reconciliationRuns: [],
      reconciliationChecks: [],
    };
  }

  const entries = dataset.entries.filter(
    (entry) => new Date(entry.effectiveAt).getTime() <= cutoff
  );
  const includedEntryIds = new Set(entries.map((entry) => entry.id));

  return {
    ...dataset,
    entries,
    allocations: dataset.allocations.filter((allocation) =>
      includedEntryIds.has(allocation.ledgerEntryId)
    ),
    entryTags: dataset.entryTags.filter((entryTag) =>
      includedEntryIds.has(entryTag.ledgerEntryId)
    ),
    reconciliationRuns: [],
    reconciliationChecks: [],
  };
}

export function buildProjectSnapshotAsOf(
  dataset: ProjectDataset,
  asOf: string
): ProjectSnapshot {
  return buildProjectSnapshot(filterProjectDatasetAsOf(dataset, asOf), {
    skipOpenReconciliation: true,
  });
}

export function buildReconciliationProjectAccountingView(
  dataset: ProjectDataset,
  asOf: string,
  checks: ReconciliationCheckView[]
): ReconciliationProjectAccountingView {
  const asOfSnapshot = buildProjectSnapshotAsOf(dataset, asOf);
  const reportedTotalProjectCash = roundMoney(
    checks.reduce(
      (sum, checkView) => sum + (checkView.check.reportedProjectCash ?? 0),
      0
    )
  );
  const expectedTotalCapitalOutstanding = asOfSnapshot.totalCapitalOutstanding;
  const expectedTotalDeployedAssetBasis = asOfSnapshot.totalDeployedAssetBasis;
  const expectedTotalSharedLoanPrincipal =
    asOfSnapshot.sharedLoanPrincipalOutstanding;
  const expectedTotalUndistributedProfit = asOfSnapshot.undistributedProfit;
  const expectedTotalProjectCash = roundMoney(
    expectedTotalCapitalOutstanding +
      expectedTotalUndistributedProfit +
      expectedTotalSharedLoanPrincipal +
      -expectedTotalDeployedAssetBasis
  );
  const submittedCount = checks.filter(
    (checkView) => checkView.check.reportedProjectCash != null
  ).length;

  return {
    expectedTotalProjectCash,
    expectedTotalCapitalOutstanding,
    expectedTotalDeployedAssetBasis,
    expectedTotalSharedLoanPrincipal,
    expectedTotalUndistributedProfit,
    reportedTotalProjectCash,
    differenceAmount: roundMoney(
      reportedTotalProjectCash - expectedTotalProjectCash
    ),
    submittedCount,
    totalMemberCount: checks.length,
    allMembersSubmitted: submittedCount === checks.length,
  };
}

function getReimbursementShareAmount(
  allocationAmount: number,
  reimbursableCashDelta: number,
  entryAmount: number
) {
  if (Math.abs(reimbursableCashDelta) <= EPSILON || entryAmount <= EPSILON) {
    return 0;
  }

  return roundMoney((allocationAmount / entryAmount) * reimbursableCashDelta);
}

function allocateProfitByCapital(
  rows: { projectMemberId: string; capitalBalance: number }[],
  totalAmount: number
) {
  const positiveRows = rows.filter((row) => row.capitalBalance > 0);
  const totalCapital = positiveRows.reduce(
    (sum, row) => sum + row.capitalBalance,
    0
  );

  if (Math.abs(totalAmount) <= EPSILON || totalCapital <= 0) {
    return new Map<string, { weight: number; amount: number }>();
  }

  const previews = positiveRows.map((row) => {
    const weight = row.capitalBalance / totalCapital;
    return {
      projectMemberId: row.projectMemberId,
      capitalBalance: row.capitalBalance,
      weight,
      amount: roundMoney(totalAmount * weight),
    };
  });

  const distributed = previews.reduce((sum, row) => sum + row.amount, 0);
  const remainder = roundMoney(totalAmount - distributed);

  if (Math.abs(remainder) > EPSILON) {
    const largest = previews.reduce((best, row) =>
      row.capitalBalance > best.capitalBalance ? row : best
    );
    largest.amount = roundMoney(largest.amount + remainder);
  }

  return new Map(
    previews.map((row) => [
      row.projectMemberId,
      { weight: row.weight, amount: row.amount },
    ])
  );
}

function checkpointOutstandingProfitPool(
  memberSummaries: MemberFinanceSummary[],
  totals: {
    operatingIncome: number;
    operatingExpense: number;
    projectWideProfitDistributed: number;
    ownerProfitPayoutTotal: number;
  }
) {
  const accruedProfitTotal = roundMoney(
    memberSummaries.reduce(
      (sum, summary) => sum + summary.accruedProfitBalance,
      0
    )
  );
  const openProfitPool = roundMoney(
    totals.operatingIncome -
      totals.operatingExpense -
      totals.projectWideProfitDistributed -
      totals.ownerProfitPayoutTotal -
      accruedProfitTotal
  );

  if (Math.abs(openProfitPool) <= EPSILON) {
    return;
  }

  const checkpointRows = allocateProfitByCapital(
    memberSummaries.map((summary) => ({
      projectMemberId: summary.projectMember.id,
      capitalBalance: summary.capitalBalance,
    })),
    openProfitPool
  );

  for (const summary of memberSummaries) {
    const checkpointAmount = checkpointRows.get(summary.projectMember.id)?.amount ?? 0;

    if (Math.abs(checkpointAmount) <= EPSILON) {
      continue;
    }

    summary.accruedProfitBalance = roundMoney(
      summary.accruedProfitBalance + checkpointAmount
    );
  }
}

function applyEntryEffects(
  entry: LedgerEntry,
  factor: number,
  allocations: LedgerAllocation[],
  memberSummaries: MemberFinanceSummary[],
  summariesByMemberRef: Map<string, MemberFinanceSummary>,
  projectMemberById: Map<string, ProjectMember>,
  totals: {
    operatingIncome: number;
    operatingExpense: number;
    projectWideProfitDistributed: number;
    ownerProfitPayoutTotal: number;
    sharedLoanDrawdown: number;
    sharedLoanPrincipalRepaid: number;
    sharedLoanInterestPaid: number;
  }
) {
  const payerCashCustodyBefore = entry.cashOutMemberId
    ? summariesByMemberRef.get(entry.cashOutMemberId)?.projectCashCustody ?? 0
    : 0;

  applyCashMovement(summariesByMemberRef, entry, factor);

  const payerCashCustodyAfter = entry.cashOutMemberId
    ? summariesByMemberRef.get(entry.cashOutMemberId)?.projectCashCustody ?? 0
    : 0;
  const payerReimbursableCashDelta = entry.cashOutMemberId
    ? getFrontedOwnMoneyDelta(payerCashCustodyBefore, payerCashCustodyAfter)
    : 0;

  switch (entry.entryType) {
    case "capital_contribution": {
      for (const allocation of getAllocationsForEntry(
        entry.id,
        allocations,
        "capital_owner"
      )) {
        const member = projectMemberById.get(allocation.projectMemberId);
        if (!member) {
          continue;
        }

        const summary = summariesByMemberRef.get(member.id);
        if (!summary) {
          continue;
        }

        summary.capitalBalance = roundMoney(
          summary.capitalBalance + allocation.amount * factor
        );
      }
      return;
    }
    case "capital_return": {
      for (const allocation of getAllocationsForEntry(
        entry.id,
        allocations,
        "capital_owner"
      )) {
        const member = projectMemberById.get(allocation.projectMemberId);
        if (!member) {
          continue;
        }

        const summary = summariesByMemberRef.get(member.id);
        if (!summary) {
          continue;
        }

        summary.capitalBalance = roundMoney(
          summary.capitalBalance - allocation.amount * factor
        );
      }
      return;
    }
    case "operating_income": {
      totals.operatingIncome = roundMoney(
        totals.operatingIncome + entry.amount * factor
      );
      return;
    }
    case "land_purchase": {
      for (const allocation of getAllocationsForEntry(
        entry.id,
        allocations,
        "expense_share"
      )) {
        const member = projectMemberById.get(allocation.projectMemberId);
        if (!member) {
          continue;
        }

        const summary = summariesByMemberRef.get(member.id);
        if (!summary) {
          continue;
        }

        summary.assetBasisBalance = roundMoney(
          summary.assetBasisBalance + allocation.amount * factor
        );
      }
      return;
    }
    case "operating_expense": {
      totals.operatingExpense = roundMoney(
        totals.operatingExpense + entry.amount * factor
      );

      if (entry.cashOutMemberId && Math.abs(payerReimbursableCashDelta) > EPSILON) {
        const payer = summariesByMemberRef.get(entry.cashOutMemberId);
        if (payer) {
          payer.expenseReimbursementBalance = roundMoney(
            payer.expenseReimbursementBalance + payerReimbursableCashDelta
          );
        }
      }

      for (const allocation of getAllocationsForEntry(
        entry.id,
        allocations,
        "expense_share"
      )) {
        const member = projectMemberById.get(allocation.projectMemberId);
        if (!member) {
          continue;
        }

        const summary = summariesByMemberRef.get(member.id);
        if (!summary) {
          continue;
        }

        summary.operatingPnlShare = roundMoney(
          summary.operatingPnlShare - allocation.amount * factor
        );
        const reimbursementShareAmount = getReimbursementShareAmount(
          allocation.amount,
          payerReimbursableCashDelta,
          entry.amount
        );

        if (Math.abs(reimbursementShareAmount) > EPSILON) {
          summary.expenseReimbursementBalance = roundMoney(
            summary.expenseReimbursementBalance - reimbursementShareAmount
          );
        }
      }
      return;
    }
    case "shared_loan_drawdown":
      totals.sharedLoanDrawdown = roundMoney(
        totals.sharedLoanDrawdown + entry.amount * factor
      );
      return;
    case "shared_loan_repayment_principal":
      totals.sharedLoanPrincipalRepaid = roundMoney(
        totals.sharedLoanPrincipalRepaid + entry.amount * factor
      );
      return;
    case "shared_loan_interest_payment": {
      totals.operatingExpense = roundMoney(
        totals.operatingExpense + entry.amount * factor
      );
      totals.sharedLoanInterestPaid = roundMoney(
        totals.sharedLoanInterestPaid + entry.amount * factor
      );

      if (entry.cashOutMemberId && Math.abs(payerReimbursableCashDelta) > EPSILON) {
        const payer = summariesByMemberRef.get(entry.cashOutMemberId);
        if (payer) {
          payer.expenseReimbursementBalance = roundMoney(
            payer.expenseReimbursementBalance + payerReimbursableCashDelta
          );
        }
      }

      for (const allocation of getAllocationsForEntry(
        entry.id,
        allocations,
        "expense_share"
      )) {
        const member = projectMemberById.get(allocation.projectMemberId);
        if (!member) {
          continue;
        }

        const summary = summariesByMemberRef.get(member.id);
        if (!summary) {
          continue;
        }

        summary.operatingPnlShare = roundMoney(
          summary.operatingPnlShare - allocation.amount * factor
        );
        const reimbursementShareAmount = getReimbursementShareAmount(
          allocation.amount,
          payerReimbursableCashDelta,
          entry.amount
        );

        if (Math.abs(reimbursementShareAmount) > EPSILON) {
          summary.expenseReimbursementBalance = roundMoney(
            summary.expenseReimbursementBalance - reimbursementShareAmount
          );
        }
      }
      return;
    }
    case "expense_settlement_payment": {
      if (entry.cashOutMemberId) {
        const debtor = summariesByMemberRef.get(entry.cashOutMemberId);
        if (debtor) {
          debtor.expenseReimbursementBalance = roundMoney(
            debtor.expenseReimbursementBalance + entry.amount * factor
          );
        }
      }

      if (entry.cashInMemberId) {
        const creditor = summariesByMemberRef.get(entry.cashInMemberId);
        if (creditor) {
          creditor.expenseReimbursementBalance = roundMoney(
            creditor.expenseReimbursementBalance - entry.amount * factor
          );
        }
      }
      return;
    }
    case "profit_distribution": {
      if (factor > 0) {
        checkpointOutstandingProfitPool(memberSummaries, totals);
      }

      totals.projectWideProfitDistributed = roundMoney(
        totals.projectWideProfitDistributed + entry.amount * factor
      );

      for (const allocation of getAllocationsForEntry(
        entry.id,
        allocations,
        "profit_share"
      )) {
        const member = projectMemberById.get(allocation.projectMemberId);
        if (!member) {
          continue;
        }

        const summary = summariesByMemberRef.get(member.id);
        if (!summary) {
          continue;
        }

        summary.profitReceivedTotal = roundMoney(
          summary.profitReceivedTotal + allocation.amount * factor
        );
        summary.accruedProfitBalance = roundMoney(
          summary.accruedProfitBalance - allocation.amount * factor
        );
      }
      return;
    }
    case "owner_profit_payout": {
      if (factor > 0) {
        checkpointOutstandingProfitPool(memberSummaries, totals);
      }

      totals.ownerProfitPayoutTotal = roundMoney(
        totals.ownerProfitPayoutTotal + entry.amount * factor
      );

      for (const allocation of getAllocationsForEntry(
        entry.id,
        allocations,
        "profit_share"
      )) {
        const member = projectMemberById.get(allocation.projectMemberId);
        if (!member) {
          continue;
        }

        const summary = summariesByMemberRef.get(member.id);
        if (!summary) {
          continue;
        }

        summary.profitReceivedTotal = roundMoney(
          summary.profitReceivedTotal + allocation.amount * factor
        );
        summary.ownerProfitPayoutTotal = roundMoney(
          summary.ownerProfitPayoutTotal + allocation.amount * factor
        );
        summary.accruedProfitBalance = roundMoney(
          summary.accruedProfitBalance - allocation.amount * factor
        );
      }
      return;
    }
    case "cash_handover":
    case "reconciliation_adjustment":
    case "reversal":
      return;
  }
}

export function buildProjectSnapshot(
  dataset: ProjectDataset,
  options: BuildProjectSnapshotOptions = {}
): ProjectSnapshot {
  const profilesById = new Map(
    dataset.profiles.map((profile) => [profile.userId, profile])
  );
  const projectMemberById = new Map(
    dataset.members.map((member) => [member.id, member])
  );

  const memberSummaries = dataset.members
    .map((member) => {
      const profile = profilesById.get(member.userId);
      if (!profile) {
        throw new Error(`Missing profile for user ${member.userId}`);
      }

      return {
        projectMember: member,
        profile,
        projectCashCustody: 0,
        frontedOwnMoney: 0,
        expenseReimbursementBalance: 0,
        teamOwesYou: 0,
        youOweTeam: 0,
        capitalBalance: 0,
        assetBasisBalance: 0,
        operatingPnlShare: 0,
        profitReceivedTotal: 0,
        ownerProfitPayoutTotal: 0,
        accruedProfitBalance: 0,
        estimatedProfitShare: 0,
      } satisfies MemberFinanceSummary;
    })
    .sort((left, right) =>
      left.profile.displayName.localeCompare(right.profile.displayName)
    );

  const summariesByMemberRef = new Map<string, MemberFinanceSummary>();
  for (const summary of memberSummaries) {
    summariesByMemberRef.set(summary.projectMember.id, summary);
    summariesByMemberRef.set(summary.projectMember.userId, summary);
  }

  const entryById = new Map(dataset.entries.map((entry) => [entry.id, entry]));
  const postedEntries = dataset.entries
    .filter((entry) => entry.status === "posted")
    .sort(byDateAsc);

  const totals = {
    operatingIncome: 0,
    operatingExpense: 0,
    projectWideProfitDistributed: 0,
    ownerProfitPayoutTotal: 0,
    sharedLoanDrawdown: 0,
    sharedLoanPrincipalRepaid: 0,
    sharedLoanInterestPaid: 0,
  };

  for (const entry of postedEntries) {
    if (entry.entryType === "reversal" && entry.reversalOfEntryId) {
      const reversedEntry = entryById.get(entry.reversalOfEntryId);
      if (reversedEntry) {
        applyEntryEffects(
          reversedEntry,
          -1,
          dataset.allocations,
          memberSummaries,
          summariesByMemberRef,
          projectMemberById,
          totals
        );
      }
      continue;
    }

    applyEntryEffects(
      entry,
      1,
      dataset.allocations,
      memberSummaries,
      summariesByMemberRef,
      projectMemberById,
      totals
    );
  }

  const totalProjectCash = roundMoney(
    memberSummaries.reduce((sum, summary) => sum + summary.projectCashCustody, 0)
  );
  const membersHoldingProjectCashTotal = roundMoney(
    memberSummaries.reduce(
      (sum, summary) => sum + Math.max(summary.projectCashCustody, 0),
      0
    )
  );
  const frontedByMembersTotal = roundMoney(
    memberSummaries.reduce(
      (sum, summary) => sum + Math.max(-summary.projectCashCustody, 0),
      0
    )
  );
  const totalCapitalOutstanding = roundMoney(
    memberSummaries.reduce((sum, summary) => sum + summary.capitalBalance, 0)
  );
  const totalDeployedAssetBasis = roundMoney(
    memberSummaries.reduce((sum, summary) => sum + summary.assetBasisBalance, 0)
  );
  const sharedLoanPrincipalOutstanding = roundMoney(
    totals.sharedLoanDrawdown - totals.sharedLoanPrincipalRepaid
  );
  const openProfitPool = roundMoney(
    totals.operatingIncome -
      totals.operatingExpense -
      totals.projectWideProfitDistributed -
      totals.ownerProfitPayoutTotal -
      memberSummaries.reduce(
        (sum, summary) => sum + summary.accruedProfitBalance,
        0
      )
  );

  const positiveCapitalPreview = allocateProfitByCapital(
    memberSummaries.map((summary) => ({
      projectMemberId: summary.projectMember.id,
      capitalBalance: summary.capitalBalance,
    })),
    openProfitPool
  );

  for (const summary of memberSummaries) {
    summary.frontedOwnMoney = roundMoney(Math.max(-summary.projectCashCustody, 0));
    summary.teamOwesYou = roundMoney(
      Math.max(summary.expenseReimbursementBalance, 0)
    );
    summary.youOweTeam = roundMoney(
      Math.max(-summary.expenseReimbursementBalance, 0)
    );
    summary.estimatedProfitShare = roundMoney(
      summary.accruedProfitBalance +
        (positiveCapitalPreview.get(summary.projectMember.id)?.amount ?? 0)
    );
  }

  const undistributedProfit = roundMoney(
    memberSummaries.reduce(
      (sum, summary) => sum + summary.estimatedProfitShare,
      0
    )
  );

  const capitalWeights = memberSummaries
    .filter((summary) => summary.capitalBalance > 0)
    .map((summary) => {
      const preview = positiveCapitalPreview.get(summary.projectMember.id);
      return {
        projectMemberId: summary.projectMember.id,
        displayName: summary.profile.displayName,
        capitalBalance: summary.capitalBalance,
        weight: preview?.weight ?? 0,
        estimatedProfitShare: summary.estimatedProfitShare,
      } satisfies CapitalWeightRow;
    })
    .sort((left, right) => right.capitalBalance - left.capitalBalance);

  const inflowTagRollups = buildTagRollups(dataset, postedEntries, [
    "operating_income",
    "shared_loan_drawdown",
  ]);
  const expenseTagRollups = buildTagRollups(dataset, postedEntries, [
    "operating_expense",
    "shared_loan_interest_payment",
  ]);

  const creditors = memberSummaries
    .filter((summary) => summary.expenseReimbursementBalance > EPSILON)
    .map((summary) => ({
      summary,
      remaining: summary.expenseReimbursementBalance,
    }))
    .sort((left, right) => right.remaining - left.remaining);

  const debtors = memberSummaries
    .filter((summary) => summary.expenseReimbursementBalance < -EPSILON)
    .map((summary) => ({
      summary,
      remaining: Math.abs(summary.expenseReimbursementBalance),
    }))
    .sort((left, right) => right.remaining - left.remaining);

  const settlementSuggestions: SettlementSuggestion[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = roundMoney(Math.min(creditor.remaining, debtor.remaining));

    if (amount <= EPSILON) {
      break;
    }

    settlementSuggestions.push({
      fromProjectMemberId: debtor.summary.projectMember.id,
      toProjectMemberId: creditor.summary.projectMember.id,
      amount,
      reason: "Shared-expense settlement",
    });

    creditor.remaining = roundMoney(creditor.remaining - amount);
    debtor.remaining = roundMoney(debtor.remaining - amount);

    if (creditor.remaining <= EPSILON) {
      creditorIndex += 1;
    }

    if (debtor.remaining <= EPSILON) {
      debtorIndex += 1;
    }
  }

  const openRun = options.skipOpenReconciliation
    ? undefined
    : dataset.reconciliationRuns
        .filter((run) => run.status === "open")
        .sort((left, right) => right.openedAt.localeCompare(left.openedAt))[0];

  const openReconciliation =
    openRun == null
      ? null
      : (() => {
          const checks = dataset.reconciliationChecks
            .filter((check) => check.runId === openRun.id)
            .map((check) => {
              const member = projectMemberById.get(check.projectMemberId);
              if (!member) {
                throw new Error(`Missing member for check ${check.id}`);
              }

              const profile = profilesById.get(member.userId);
              if (!profile) {
                throw new Error(`Missing profile for check ${check.id}`);
              }

              return { check, member, profile } satisfies ReconciliationCheckView;
            })
            .sort((left, right) =>
              left.profile.displayName.localeCompare(right.profile.displayName)
            );

          return {
            run: openRun,
            checks,
            matchedCount: checks.filter((item) => item.check.status === "matched")
              .length,
            varianceCount: checks.filter(
              (item) => item.check.status === "variance_found"
            ).length,
            pendingCount: checks.filter((item) => item.check.status === "pending")
              .length,
            projectAccounting: buildReconciliationProjectAccountingView(
              dataset,
              openRun.asOf,
              checks
            ),
          };
        })();

  return {
    dataset,
    memberSummaries,
    totalProjectCash,
    membersHoldingProjectCashTotal,
    frontedByMembersTotal,
    projectOperatingIncome: roundMoney(totals.operatingIncome),
    projectOperatingExpense: roundMoney(totals.operatingExpense),
    projectOperatingProfit: roundMoney(
      totals.operatingIncome - totals.operatingExpense
    ),
    totalDeployedAssetBasis,
    sharedLoanDrawdownTotal: roundMoney(totals.sharedLoanDrawdown),
    sharedLoanPrincipalRepaidTotal: roundMoney(totals.sharedLoanPrincipalRepaid),
    sharedLoanPrincipalOutstanding,
    sharedLoanInterestPaidTotal: roundMoney(totals.sharedLoanInterestPaid),
    totalCapitalOutstanding,
      totalProfitDistributed: roundMoney(
        totals.projectWideProfitDistributed + totals.ownerProfitPayoutTotal
      ),
    undistributedProfit,
    settlementSuggestions,
    openReconciliation,
    capitalWeights,
    inflowTagRollups,
    expenseTagRollups,
    recentEntries: [...postedEntries].sort(byDateDesc).slice(0, 8),
  };
}

export function buildMemberStatement(
  dataset: ProjectDataset,
  projectMemberId: string
): MemberStatementSnapshot | null {
  const snapshot = buildProjectSnapshot(dataset);
  const summary = snapshot.memberSummaries.find(
    (item) => item.projectMember.id === projectMemberId
  );

  if (!summary) {
    return null;
  }

  const relatedEntries = snapshot.dataset.entries
    .filter((entry) => entry.status === "posted")
    .filter((entry) => {
      if (
        entry.cashInMemberId === summary.projectMember.id ||
        entry.cashOutMemberId === summary.projectMember.id ||
        entry.cashInMemberId === summary.projectMember.userId ||
        entry.cashOutMemberId === summary.projectMember.userId
      ) {
        return true;
      }

      return snapshot.dataset.allocations.some(
        (allocation) =>
          allocation.ledgerEntryId === entry.id &&
          allocation.projectMemberId === summary.projectMember.id
      );
    })
    .sort(byDateDesc);

  const openReconciliationCheck =
    snapshot.openReconciliation?.checks.find(
      (item) => item.member.id === summary.projectMember.id
    ) ?? null;

  return {
    project: snapshot.dataset.project,
    summary,
    memberDirectory: snapshot.memberSummaries.map((item) => ({
      projectMemberId: item.projectMember.id,
      userId: item.projectMember.userId,
      displayName: item.profile.displayName,
    })),
    relatedEntries,
    openReconciliationCheck,
  };
}
