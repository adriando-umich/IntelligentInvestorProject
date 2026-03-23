import {
  type ProjectDataset,
  type SettlementSuggestion,
} from "@/lib/finance/types";
import { roundMoney } from "@/lib/format";

const EPSILON = 0.01;

type SharedExpenseBalanceRow = {
  projectMemberId: string;
  expenseReimbursementBalance: number;
  teamOwesYou: number;
  youOweTeam: number;
};

export type SharedExpenseSettlementView = {
  balances: SharedExpenseBalanceRow[];
  balancesByProjectMemberId: Map<string, SharedExpenseBalanceRow>;
  settlementSuggestions: SettlementSuggestion[];
};

function byDateAsc<T extends { effectiveAt?: string; createdAt?: string }>(
  left: T,
  right: T
) {
  return (
    new Date(left.effectiveAt ?? left.createdAt ?? 0).getTime() -
    new Date(right.effectiveAt ?? right.createdAt ?? 0).getTime()
  );
}

function getAllocationsForEntry(
  entryId: string,
  allocations: ProjectDataset["allocations"],
  allocationType: "expense_share"
) {
  return allocations.filter(
    (allocation) =>
      allocation.ledgerEntryId === entryId &&
      allocation.allocationType === allocationType
  );
}

function applyCashMovement(
  cashCustodyByMemberId: Map<string, number>,
  entry: ProjectDataset["entries"][number],
  factor: number,
  projectMemberIdByRef: Map<string, string>
) {
  const cashInProjectMemberId = entry.cashInMemberId
    ? projectMemberIdByRef.get(entry.cashInMemberId) ?? entry.cashInMemberId
    : null;
  const cashOutProjectMemberId = entry.cashOutMemberId
    ? projectMemberIdByRef.get(entry.cashOutMemberId) ?? entry.cashOutMemberId
    : null;

  if (cashInProjectMemberId) {
    cashCustodyByMemberId.set(
      cashInProjectMemberId,
      roundMoney(
        (cashCustodyByMemberId.get(cashInProjectMemberId) ?? 0) +
          entry.amount * factor
      )
    );
  }

  if (cashOutProjectMemberId) {
    cashCustodyByMemberId.set(
      cashOutProjectMemberId,
      roundMoney(
        (cashCustodyByMemberId.get(cashOutProjectMemberId) ?? 0) -
          entry.amount * factor
      )
    );
  }

  return {
    cashInProjectMemberId,
    cashOutProjectMemberId,
  };
}

function getFrontedOwnMoneyDelta(beforeCashCustody: number, afterCashCustody: number) {
  return roundMoney(
    Math.max(-afterCashCustody, 0) - Math.max(-beforeCashCustody, 0)
  );
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

function applySettlementEffects(
  entry: ProjectDataset["entries"][number],
  factor: number,
  allocations: ProjectDataset["allocations"],
  reimbursementBalanceByMemberId: Map<string, number>,
  cashCustodyByMemberId: Map<string, number>,
  projectMemberIdByRef: Map<string, string>,
  entryById: Map<string, ProjectDataset["entries"][number]>
) {
  if (entry.entryType === "reversal" && entry.reversalOfEntryId) {
    const reversedEntry = entryById.get(entry.reversalOfEntryId);
    if (reversedEntry) {
      applySettlementEffects(
        reversedEntry,
        -1,
        allocations,
        reimbursementBalanceByMemberId,
        cashCustodyByMemberId,
        projectMemberIdByRef,
        entryById
      );
    }
    return;
  }

  const payerProjectMemberId = entry.cashOutMemberId
    ? projectMemberIdByRef.get(entry.cashOutMemberId) ?? entry.cashOutMemberId
    : null;
  const payerCashCustodyBefore = payerProjectMemberId
    ? cashCustodyByMemberId.get(payerProjectMemberId) ?? 0
    : 0;

  applyCashMovement(cashCustodyByMemberId, entry, factor, projectMemberIdByRef);

  const payerCashCustodyAfter = payerProjectMemberId
    ? cashCustodyByMemberId.get(payerProjectMemberId) ?? 0
    : 0;
  const payerReimbursableCashDelta = payerProjectMemberId
    ? getFrontedOwnMoneyDelta(payerCashCustodyBefore, payerCashCustodyAfter)
    : 0;

  if (
    entry.entryType === "operating_expense" ||
    entry.entryType === "shared_loan_interest_payment"
  ) {
    if (
      payerProjectMemberId &&
      Math.abs(payerReimbursableCashDelta) > EPSILON
    ) {
      reimbursementBalanceByMemberId.set(
        payerProjectMemberId,
        roundMoney(
          (reimbursementBalanceByMemberId.get(payerProjectMemberId) ?? 0) +
            payerReimbursableCashDelta
        )
      );
    }

    for (const allocation of getAllocationsForEntry(
      entry.id,
      allocations,
      "expense_share"
    )) {
      const reimbursementShareAmount = getReimbursementShareAmount(
        allocation.amount,
        payerReimbursableCashDelta,
        entry.amount
      );

      if (Math.abs(reimbursementShareAmount) <= EPSILON) {
        continue;
      }

      reimbursementBalanceByMemberId.set(
        allocation.projectMemberId,
        roundMoney(
          (reimbursementBalanceByMemberId.get(allocation.projectMemberId) ?? 0) -
            reimbursementShareAmount
        )
      );
    }
  }

  if (entry.entryType === "expense_settlement_payment") {
    const debtorProjectMemberId = payerProjectMemberId;
    const creditorProjectMemberId = entry.cashInMemberId
      ? projectMemberIdByRef.get(entry.cashInMemberId) ?? entry.cashInMemberId
      : null;

    if (debtorProjectMemberId) {
      reimbursementBalanceByMemberId.set(
        debtorProjectMemberId,
        roundMoney(
          (reimbursementBalanceByMemberId.get(debtorProjectMemberId) ?? 0) +
            entry.amount * factor
        )
      );
    }

    if (creditorProjectMemberId) {
      reimbursementBalanceByMemberId.set(
        creditorProjectMemberId,
        roundMoney(
          (reimbursementBalanceByMemberId.get(creditorProjectMemberId) ?? 0) -
            entry.amount * factor
        )
      );
    }
  }
}

export function buildSharedExpenseSettlementView(
  dataset: ProjectDataset
): SharedExpenseSettlementView {
  const projectMemberIdByRef = new Map<string, string>();
  const reimbursementBalanceByMemberId = new Map<string, number>();
  const cashCustodyByMemberId = new Map<string, number>();

  for (const member of dataset.members) {
    projectMemberIdByRef.set(member.id, member.id);
    projectMemberIdByRef.set(member.userId, member.id);
    reimbursementBalanceByMemberId.set(member.id, 0);
    cashCustodyByMemberId.set(member.id, 0);
  }

  const entryById = new Map(dataset.entries.map((entry) => [entry.id, entry]));
  const postedEntries = dataset.entries
    .filter((entry) => entry.status === "posted")
    .sort(byDateAsc);

  for (const entry of postedEntries) {
    applySettlementEffects(
      entry,
      1,
      dataset.allocations,
      reimbursementBalanceByMemberId,
      cashCustodyByMemberId,
      projectMemberIdByRef,
      entryById
    );
  }

  const balances = dataset.members.map((member) => {
    const expenseReimbursementBalance = roundMoney(
      reimbursementBalanceByMemberId.get(member.id) ?? 0
    );

    return {
      projectMemberId: member.id,
      expenseReimbursementBalance,
      teamOwesYou: roundMoney(Math.max(expenseReimbursementBalance, 0)),
      youOweTeam: roundMoney(Math.max(-expenseReimbursementBalance, 0)),
    };
  });

  const creditors = balances
    .filter((row) => row.expenseReimbursementBalance > EPSILON)
    .map((row) => ({
      ...row,
      remaining: row.expenseReimbursementBalance,
    }))
    .sort((left, right) => right.remaining - left.remaining);

  const debtors = balances
    .filter((row) => row.expenseReimbursementBalance < -EPSILON)
    .map((row) => ({
      ...row,
      remaining: Math.abs(row.expenseReimbursementBalance),
    }))
    .sort((left, right) => right.remaining - left.remaining);

  const settlementSuggestions: SettlementSuggestion[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = roundMoney(Math.min(creditor.remaining, debtor.remaining));

    if (amount > EPSILON) {
      settlementSuggestions.push({
        fromProjectMemberId: debtor.projectMemberId,
        toProjectMemberId: creditor.projectMemberId,
        amount,
        reason: "Shared-expense settlement",
      });
    }

    creditor.remaining = roundMoney(creditor.remaining - amount);
    debtor.remaining = roundMoney(debtor.remaining - amount);

    if (creditor.remaining <= EPSILON) {
      creditorIndex += 1;
    }

    if (debtor.remaining <= EPSILON) {
      debtorIndex += 1;
    }
  }

  return {
    balances,
    balancesByProjectMemberId: new Map(
      balances.map((row) => [row.projectMemberId, row])
    ),
    settlementSuggestions,
  };
}
