import {
  type MemberFinanceSummary,
  type ProjectSnapshot,
  type SettlementSuggestion,
} from "@/lib/finance/types";
import { roundMoney } from "@/lib/format";

const EPSILON = 0.01;

export type ProjectCashClaimRow = {
  projectMemberId: string;
  cashEntitlement: number;
  reserveAllocation: number;
  distributableCashHeld: number;
  netSettlementBalance: number;
  teamOwesYou: number;
  youOweTeam: number;
};

export type ProjectCashClaimView = {
  rows: ProjectCashClaimRow[];
  rowsByProjectMemberId: Map<string, ProjectCashClaimRow>;
  settlementSuggestions: SettlementSuggestion[];
  reserveCashTotal: number;
};

export function getLiquidCapitalBalance(
  summary: Pick<MemberFinanceSummary, "capitalBalance" | "assetBasisBalance">
) {
  return roundMoney(summary.capitalBalance - summary.assetBasisBalance);
}

export function getCashEntitlement(
  summary: Pick<
    MemberFinanceSummary,
    | "capitalBalance"
    | "assetBasisBalance"
    | "estimatedProfitShare"
    | "expenseReimbursementBalance"
  >
) {
  return roundMoney(
    getLiquidCapitalBalance(summary) +
      summary.estimatedProfitShare +
      summary.expenseReimbursementBalance
  );
}

export function getCapitalReturnAvailableToday(
  summary: Pick<
    MemberFinanceSummary,
    "capitalBalance" | "assetBasisBalance" | "estimatedProfitShare"
  >
) {
  return roundMoney(
    Math.max(
      getLiquidCapitalBalance(summary) + Math.min(summary.estimatedProfitShare, 0),
      0
    )
  );
}

export function getProfitPayoutAvailableToday(
  summary: Pick<MemberFinanceSummary, "estimatedProfitShare">
) {
  return roundMoney(Math.max(summary.estimatedProfitShare, 0));
}

export function getClaimAvailableToday(
  summary: Pick<
    MemberFinanceSummary,
    "capitalBalance" | "assetBasisBalance" | "estimatedProfitShare"
  >
) {
  return roundMoney(
    getCapitalReturnAvailableToday(summary) +
      getProfitPayoutAvailableToday(summary)
  );
}

type WeightedReserveRow = {
  projectMemberId: string;
  positiveCashHeld: number;
  positiveEntitlement: number;
};

function allocateReserveCash(
  rows: WeightedReserveRow[],
  reserveCashTotal: number
) {
  if (Math.abs(reserveCashTotal) <= EPSILON || rows.length === 0) {
    return new Map(rows.map((row) => [row.projectMemberId, 0]));
  }

  const positiveCashHeldTotal = rows.reduce(
    (sum, row) => sum + row.positiveCashHeld,
    0
  );
  const positiveEntitlementTotal = rows.reduce(
    (sum, row) => sum + row.positiveEntitlement,
    0
  );

  const weightedRows = rows.map((row) => {
    const weight =
      positiveCashHeldTotal > EPSILON
        ? row.positiveCashHeld / positiveCashHeldTotal
        : positiveEntitlementTotal > EPSILON
          ? row.positiveEntitlement / positiveEntitlementTotal
          : row.projectMemberId === rows[0]?.projectMemberId
            ? 1
            : 0;

    return {
      ...row,
      weight,
      reserveAllocation: roundMoney(reserveCashTotal * weight),
    };
  });

  const distributed = weightedRows.reduce(
    (sum, row) => sum + row.reserveAllocation,
    0
  );
  const remainder = roundMoney(reserveCashTotal - distributed);

  if (Math.abs(remainder) > EPSILON) {
    const bestRow = weightedRows.reduce((best, row) =>
      row.weight > best.weight ? row : best
    );
    bestRow.reserveAllocation = roundMoney(bestRow.reserveAllocation + remainder);
  }

  return new Map(
    weightedRows.map((row) => [row.projectMemberId, row.reserveAllocation])
  );
}

export function buildProjectCashClaimView(
  snapshot: ProjectSnapshot
): ProjectCashClaimView {
  const baseRows = snapshot.memberSummaries.map((summary) => {
    const cashEntitlement = getCashEntitlement(summary);

    return {
      projectMemberId: summary.projectMember.id,
      cashEntitlement,
      positiveCashHeld: Math.max(summary.projectCashCustody, 0),
      positiveEntitlement: Math.max(cashEntitlement, 0),
    };
  });

  const reserveCashTotal = roundMoney(
    snapshot.totalProjectCash -
      baseRows.reduce((sum, row) => sum + row.cashEntitlement, 0)
  );
  const reserveByProjectMemberId = allocateReserveCash(baseRows, reserveCashTotal);

  const rows = snapshot.memberSummaries.map((summary) => {
    const reserveAllocation = roundMoney(
      reserveByProjectMemberId.get(summary.projectMember.id) ?? 0
    );
    const cashEntitlement = roundMoney(
      baseRows.find((row) => row.projectMemberId === summary.projectMember.id)
        ?.cashEntitlement ?? 0
    );
    const distributableCashHeld = roundMoney(
      summary.projectCashCustody - reserveAllocation
    );
    const netSettlementBalance = roundMoney(
      cashEntitlement - distributableCashHeld
    );

    return {
      projectMemberId: summary.projectMember.id,
      cashEntitlement,
      reserveAllocation,
      distributableCashHeld,
      netSettlementBalance,
      teamOwesYou: roundMoney(Math.max(netSettlementBalance, 0)),
      youOweTeam: roundMoney(Math.max(-netSettlementBalance, 0)),
    } satisfies ProjectCashClaimRow;
  });

  const creditors = rows
    .filter((row) => row.netSettlementBalance > EPSILON)
    .map((row) => ({
      ...row,
      remaining: row.netSettlementBalance,
    }))
    .sort((left, right) => right.remaining - left.remaining);

  const debtors = rows
    .filter((row) => row.netSettlementBalance < -EPSILON)
    .map((row) => ({
      ...row,
      remaining: Math.abs(row.netSettlementBalance),
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
        reason: "Project cash redistribution",
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
    rows,
    rowsByProjectMemberId: new Map(
      rows.map((row) => [row.projectMemberId, row])
    ),
    settlementSuggestions,
    reserveCashTotal,
  };
}
