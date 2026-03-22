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
  type SettlementSuggestion,
  type TagRollupRow,
} from "@/lib/finance/types";
import { roundMoney } from "@/lib/format";

const EPSILON = 0.01;

function byDateAsc<T extends { effectiveAt?: string; createdAt?: string }>(
  a: T,
  b: T
) {
  return (
    new Date(a.effectiveAt ?? a.createdAt ?? 0).getTime() -
    new Date(b.effectiveAt ?? b.createdAt ?? 0).getTime()
  );
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
  summariesByUserId: Map<string, MemberFinanceSummary>,
  entry: LedgerEntry,
  factor: number
) {
  if (entry.cashInMemberId) {
    const receiver = summariesByUserId.get(entry.cashInMemberId);
    if (receiver) {
      receiver.projectCashCustody = roundMoney(
        receiver.projectCashCustody + entry.amount * factor
      );
    }
  }

  if (entry.cashOutMemberId) {
    const payer = summariesByUserId.get(entry.cashOutMemberId);
    if (payer) {
      payer.projectCashCustody = roundMoney(
        payer.projectCashCustody - entry.amount * factor
      );
    }
  }
}

function applyEntryEffects(
  entry: LedgerEntry,
  factor: number,
  allocations: LedgerAllocation[],
  summariesByUserId: Map<string, MemberFinanceSummary>,
  projectMemberById: Map<string, ProjectMember>,
  totals: {
    operatingIncome: number;
    operatingExpense: number;
    profitDistributed: number;
    sharedLoanDrawdown: number;
    sharedLoanPrincipalRepaid: number;
    sharedLoanInterestPaid: number;
  }
) {
  applyCashMovement(summariesByUserId, entry, factor);

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

        const summary = summariesByUserId.get(member.userId);
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

        const summary = summariesByUserId.get(member.userId);
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

      for (const allocation of getAllocationsForEntry(
        entry.id,
        allocations,
        "income_share"
      )) {
        const member = projectMemberById.get(allocation.projectMemberId);
        if (!member) {
          continue;
        }

        const summary = summariesByUserId.get(member.userId);
        if (!summary) {
          continue;
        }

        summary.operatingPnlShare = roundMoney(
          summary.operatingPnlShare + allocation.amount * factor
        );
      }
      return;
    }
    case "operating_expense": {
      totals.operatingExpense = roundMoney(
        totals.operatingExpense + entry.amount * factor
      );

      if (entry.cashOutMemberId) {
        const payer = summariesByUserId.get(entry.cashOutMemberId);
        if (payer) {
          payer.expenseReimbursementBalance = roundMoney(
            payer.expenseReimbursementBalance + entry.amount * factor
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

        const summary = summariesByUserId.get(member.userId);
        if (!summary) {
          continue;
        }

        summary.operatingPnlShare = roundMoney(
          summary.operatingPnlShare - allocation.amount * factor
        );
        summary.expenseReimbursementBalance = roundMoney(
          summary.expenseReimbursementBalance - allocation.amount * factor
        );
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

      if (entry.cashOutMemberId) {
        const payer = summariesByUserId.get(entry.cashOutMemberId);
        if (payer) {
          payer.expenseReimbursementBalance = roundMoney(
            payer.expenseReimbursementBalance + entry.amount * factor
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

        const summary = summariesByUserId.get(member.userId);
        if (!summary) {
          continue;
        }

        summary.operatingPnlShare = roundMoney(
          summary.operatingPnlShare - allocation.amount * factor
        );
        summary.expenseReimbursementBalance = roundMoney(
          summary.expenseReimbursementBalance - allocation.amount * factor
        );
      }
      return;
    }
    case "expense_settlement_payment": {
      if (entry.cashOutMemberId) {
        const debtor = summariesByUserId.get(entry.cashOutMemberId);
        if (debtor) {
          debtor.expenseReimbursementBalance = roundMoney(
            debtor.expenseReimbursementBalance + entry.amount * factor
          );
        }
      }

      if (entry.cashInMemberId) {
        const creditor = summariesByUserId.get(entry.cashInMemberId);
        if (creditor) {
          creditor.expenseReimbursementBalance = roundMoney(
            creditor.expenseReimbursementBalance - entry.amount * factor
          );
        }
      }
      return;
    }
    case "profit_distribution": {
      totals.profitDistributed = roundMoney(
        totals.profitDistributed + entry.amount * factor
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

        const summary = summariesByUserId.get(member.userId);
        if (!summary) {
          continue;
        }

        summary.profitReceivedTotal = roundMoney(
          summary.profitReceivedTotal + allocation.amount * factor
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

function allocateProfitPreview(
  rows: { projectMemberId: string; capitalBalance: number }[],
  totalAmount: number
) {
  const positiveRows = rows.filter((row) => row.capitalBalance > 0);
  const totalCapital = positiveRows.reduce(
    (sum, row) => sum + row.capitalBalance,
    0
  );

  if (totalAmount <= 0 || totalCapital <= 0) {
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

export function buildProjectSnapshot(dataset: ProjectDataset): ProjectSnapshot {
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
        operatingPnlShare: 0,
        profitReceivedTotal: 0,
        estimatedProfitShare: 0,
      } satisfies MemberFinanceSummary;
    })
    .sort((left, right) =>
      left.profile.displayName.localeCompare(right.profile.displayName)
    );

  const summariesByUserId = new Map(
    memberSummaries.map((summary) => [summary.projectMember.userId, summary])
  );

  const entryById = new Map(dataset.entries.map((entry) => [entry.id, entry]));
  const postedEntries = dataset.entries
    .filter((entry) => entry.status === "posted")
    .sort(byDateAsc);

  const totals = {
    operatingIncome: 0,
    operatingExpense: 0,
    profitDistributed: 0,
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
          summariesByUserId,
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
      summariesByUserId,
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
  const sharedLoanPrincipalOutstanding = roundMoney(
    totals.sharedLoanDrawdown - totals.sharedLoanPrincipalRepaid
  );
  const undistributedProfit = roundMoney(
    totals.operatingIncome - totals.operatingExpense - totals.profitDistributed
  );

  const positiveCapitalPreview = allocateProfitPreview(
    memberSummaries.map((summary) => ({
      projectMemberId: summary.projectMember.id,
      capitalBalance: summary.capitalBalance,
    })),
    Math.max(undistributedProfit, 0)
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
      positiveCapitalPreview.get(summary.projectMember.id)?.amount ?? 0
    );
  }

  const capitalWeights = memberSummaries
    .filter((summary) => summary.capitalBalance > 0)
    .map((summary) => {
      const preview = positiveCapitalPreview.get(summary.projectMember.id);
      return {
        projectMemberId: summary.projectMember.id,
        displayName: summary.profile.displayName,
        capitalBalance: summary.capitalBalance,
        weight: preview?.weight ?? 0,
        estimatedProfitShare: preview?.amount ?? 0,
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

  const openRun = dataset.reconciliationRuns
    .filter((run) => run.status === "open")
    .sort((left, right) =>
      right.openedAt.localeCompare(left.openedAt)
    )[0];

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
    sharedLoanDrawdownTotal: roundMoney(totals.sharedLoanDrawdown),
    sharedLoanPrincipalRepaidTotal: roundMoney(totals.sharedLoanPrincipalRepaid),
    sharedLoanPrincipalOutstanding,
    sharedLoanInterestPaidTotal: roundMoney(totals.sharedLoanInterestPaid),
    totalCapitalOutstanding,
    totalProfitDistributed: roundMoney(totals.profitDistributed),
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
