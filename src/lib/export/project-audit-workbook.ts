import "server-only";

import ExcelJS from "exceljs";
import { format } from "date-fns";

import {
  buildProjectCashClaimView,
  type ProjectCashClaimView,
} from "../finance/project-cash-claims";
import {
  getEntryFamily,
  getEntryFamilyLabel,
  getEntryTypeLabel,
  type LedgerAllocation,
  type ProjectDataset,
  type ProjectSnapshot,
} from "../finance/types";
import { formatCurrency, roundMoney } from "../format";

const MONEY_FORMAT = '#,##0.00;[Red]-#,##0.00';
const PERCENT_FORMAT = "0.00%";
const DATE_FORMAT = "yyyy-mm-dd";
const HEADER_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFEAF2F0" },
};
const SECTION_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFF8FBFA" },
};

type WorkbookBuildInput = {
  dataset: ProjectDataset;
  snapshot: ProjectSnapshot;
  generatedAt?: Date;
};

type CalcMetricKey =
  | "totalProjectCash"
  | "membersHoldingProjectCashTotal"
  | "frontedByMembersTotal"
  | "totalCapitalOutstanding"
  | "estimatedProfitToday"
  | "sharedLoanPrincipalOutstanding"
  | "projectOperatingIncome"
  | "projectOperatingExpense"
  | "sharedLoanInterestPaid"
  | "reserveCashTotal"
  | "positiveCashHeldTotal"
  | "positiveEntitlementTotal";

type CalcMetricRef = {
  workbookCell: string;
  appCell: string;
  deltaCell: string;
};

type CalcMemberRef = {
  row: number;
  projectMemberId: string;
  displayName: string;
};

type CalcSheetRefs = {
  metrics: Record<CalcMetricKey, CalcMetricRef>;
  memberRows: CalcMemberRef[];
};

type TransactionSheetContext = {
  hiddenCashInIdColumn: string;
  hiddenCashOutIdColumn: string;
  hiddenEntryTypeKeyColumn: string;
};

function byDateAsc<T extends { effectiveAt?: string; createdAt?: string }>(
  left: T,
  right: T
) {
  const leftTime = new Date(left.effectiveAt ?? left.createdAt ?? 0).getTime();
  const rightTime = new Date(right.effectiveAt ?? right.createdAt ?? 0).getTime();
  return leftTime - rightTime;
}

function sanitizeFileSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toFileNameTimestamp(input: Date) {
  return format(input, "yyyyMMdd-HHmm");
}

function toExcelDate(input: string | null | undefined) {
  if (!input) {
    return null;
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function setHeaderStyle(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FF0F172A" } };
  row.fill = HEADER_FILL;
  row.alignment = { vertical: "middle", wrapText: true };
  row.border = {
    bottom: { style: "thin", color: { argb: "FFD7E2DF" } },
  };
}

function setSectionStyle(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FF0F172A" } };
  row.fill = SECTION_FILL;
}

function buildMemberDirectory(snapshot: ProjectSnapshot) {
  return snapshot.memberSummaries.map((summary, index) => ({
    order: index + 1,
    projectMemberId: summary.projectMember.id,
    userId: summary.projectMember.userId ?? "",
    displayName: summary.profile.displayName,
    email: summary.profile.email,
    status: summary.projectMember.membershipStatus ?? "active",
    role: summary.projectMember.role,
    isActive: summary.projectMember.isActive,
    summary,
  }));
}

function createTransactionSummaries(
  dataset: ProjectDataset,
  snapshot: ProjectSnapshot
) {
  const memberNameById = new Map(
    snapshot.memberSummaries.map((summary) => [
      summary.projectMember.id,
      summary.profile.displayName,
    ])
  );
  const tagNameById = new Map(dataset.tags.map((tag) => [tag.id, tag.name]));
  const tagIdsByEntryId = new Map<string, string[]>();
  const allocationsByEntryId = new Map<string, LedgerAllocation[]>();

  for (const entryTag of dataset.entryTags) {
    const current = tagIdsByEntryId.get(entryTag.ledgerEntryId) ?? [];
    current.push(entryTag.projectTagId);
    tagIdsByEntryId.set(entryTag.ledgerEntryId, current);
  }

  for (const allocation of dataset.allocations) {
    const current = allocationsByEntryId.get(allocation.ledgerEntryId) ?? [];
    current.push(allocation);
    allocationsByEntryId.set(allocation.ledgerEntryId, current);
  }

  return dataset.entries
    .slice()
    .sort(byDateAsc)
    .map((entry) => {
      const entryTags = [...new Set(tagIdsByEntryId.get(entry.id) ?? [])]
        .map((tagId) => tagNameById.get(tagId))
        .filter((name): name is string => Boolean(name));
      const entryAllocations = allocationsByEntryId.get(entry.id) ?? [];

      const allocationSummary = entryAllocations
        .map((allocation) => {
          const memberName =
            memberNameById.get(allocation.projectMemberId) ??
            allocation.projectMemberId;
          return `${memberName} (${allocation.allocationType}): ${formatCurrency(
            allocation.amount,
            entry.currencyCode
          )}`;
        })
        .join("; ");

      const allocationWeightSummary = entryAllocations
        .filter((allocation) => allocation.weightPercent != null)
        .map((allocation) => {
          const memberName =
            memberNameById.get(allocation.projectMemberId) ??
            allocation.projectMemberId;
          return `${memberName}: ${Number(
            allocation.weightPercent ?? 0
          ).toFixed(2)}%`;
        })
        .join("; ");

      const capitalOwnerSummary = entryAllocations
        .filter((allocation) => allocation.allocationType === "capital_owner")
        .map((allocation) => {
          const memberName =
            memberNameById.get(allocation.projectMemberId) ??
            allocation.projectMemberId;
          return `${memberName}: ${formatCurrency(
            allocation.amount,
            entry.currencyCode
          )}`;
        })
        .join("; ");

      return {
        entry,
        tagsSummary: entryTags.join(", "),
        allocationSummary,
        allocationWeightSummary,
        capitalOwnerSummary,
      };
    });
}

function buildTransactionsSheet(
  workbook: ExcelJS.Workbook,
  dataset: ProjectDataset,
  snapshot: ProjectSnapshot
): TransactionSheetContext {
  const sheet = workbook.addWorksheet("Transactions", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const transactionRows = createTransactionSummaries(dataset, snapshot);
  const memberNameById = new Map(
    snapshot.memberSummaries.map((summary) => [
      summary.projectMember.id,
      summary.profile.displayName,
    ])
  );

  sheet.columns = [
    { header: "Entry ID", key: "entryId", width: 36 },
    { header: "Status", key: "status", width: 12 },
    {
      header: "Effective date",
      key: "effectiveAt",
      width: 14,
      style: { numFmt: DATE_FORMAT },
    },
    { header: "Entry family", key: "entryFamily", width: 18 },
    { header: "Entry type", key: "entryTypeLabel", width: 28 },
    { header: "Description", key: "description", width: 26 },
    {
      header: "Amount",
      key: "amount",
      width: 16,
      style: { numFmt: MONEY_FORMAT },
    },
    { header: "Currency", key: "currencyCode", width: 12 },
    { header: "Money in to member", key: "cashInMemberName", width: 22 },
    { header: "Money out by", key: "cashOutMemberName", width: 22 },
    { header: "External counterparty", key: "externalCounterparty", width: 24 },
    { header: "Note", key: "note", width: 28 },
    { header: "Tags", key: "tagsSummary", width: 24 },
    { header: "Capital owner", key: "capitalOwnerSummary", width: 28 },
    { header: "Allocation summary", key: "allocationSummary", width: 42 },
    {
      header: "Allocation weight summary",
      key: "allocationWeightSummary",
      width: 30,
    },
    {
      header: "Created at",
      key: "createdAt",
      width: 22,
      style: { numFmt: "yyyy-mm-dd hh:mm" },
    },
    { header: "Reversal of entry", key: "reversalOfEntryId", width: 36 },
    { header: "Money in member id", key: "cashInMemberId", width: 36, hidden: true },
    {
      header: "Money out member id",
      key: "cashOutMemberId",
      width: 36,
      hidden: true,
    },
    { header: "Entry type key", key: "entryTypeKey", width: 18, hidden: true },
    {
      header: "Entry family key",
      key: "entryFamilyKey",
      width: 18,
      hidden: true,
    },
  ];

  setHeaderStyle(sheet.getRow(1));
  sheet.autoFilter = {
    from: "A1",
    to: "V1",
  };

  for (const row of transactionRows) {
    const { entry } = row;
    const entryFamilyKey = getEntryFamily(entry.entryType);

    sheet.addRow({
      entryId: entry.id,
      status: entry.status,
      effectiveAt: toExcelDate(entry.effectiveAt),
      entryFamily: getEntryFamilyLabel(entryFamilyKey),
      entryTypeLabel: getEntryTypeLabel(entry.entryType),
      description: entry.description,
      amount: entry.amount,
      currencyCode: entry.currencyCode,
      cashInMemberName: entry.cashInMemberId
        ? memberNameById.get(entry.cashInMemberId) ?? entry.cashInMemberId
        : "",
      cashOutMemberName: entry.cashOutMemberId
        ? memberNameById.get(entry.cashOutMemberId) ?? entry.cashOutMemberId
        : "",
      externalCounterparty: entry.externalCounterparty ?? "",
      note: entry.note ?? "",
      tagsSummary: row.tagsSummary,
      capitalOwnerSummary: row.capitalOwnerSummary,
      allocationSummary: row.allocationSummary,
      allocationWeightSummary: row.allocationWeightSummary,
      createdAt: toExcelDate(entry.createdAt),
      reversalOfEntryId: entry.reversalOfEntryId ?? "",
      cashInMemberId: entry.cashInMemberId ?? "",
      cashOutMemberId: entry.cashOutMemberId ?? "",
      entryTypeKey: entry.entryType,
      entryFamilyKey,
    });
  }

  return {
    hiddenCashInIdColumn: "S",
    hiddenCashOutIdColumn: "T",
    hiddenEntryTypeKeyColumn: "U",
  };
}

function buildMembersSheet(
  workbook: ExcelJS.Workbook,
  snapshot: ProjectSnapshot
) {
  const sheet = workbook.addWorksheet("_members");
  sheet.state = "hidden";
  sheet.columns = [
    { header: "Order", key: "order", width: 10 },
    { header: "Project member ID", key: "projectMemberId", width: 36 },
    { header: "User ID", key: "userId", width: 36 },
    { header: "Display name", key: "displayName", width: 24 },
    { header: "Email", key: "email", width: 28 },
    { header: "Status", key: "status", width: 16 },
    { header: "Role", key: "role", width: 14 },
    { header: "Is active", key: "isActive", width: 10 },
  ];
  setHeaderStyle(sheet.getRow(1));

  for (const row of buildMemberDirectory(snapshot)) {
    sheet.addRow(row);
  }
}

function buildAllocationsSheet(
  workbook: ExcelJS.Workbook,
  dataset: ProjectDataset,
  snapshot: ProjectSnapshot
) {
  const sheet = workbook.addWorksheet("_allocations");
  sheet.state = "hidden";
  const entryById = new Map(dataset.entries.map((entry) => [entry.id, entry]));
  const memberNameById = new Map(
    snapshot.memberSummaries.map((summary) => [
      summary.projectMember.id,
      summary.profile.displayName,
    ])
  );

  sheet.columns = [
    { header: "Entry ID", key: "entryId", width: 36 },
    { header: "Entry status", key: "entryStatus", width: 12 },
    {
      header: "Effective date",
      key: "effectiveAt",
      width: 14,
      style: { numFmt: DATE_FORMAT },
    },
    { header: "Entry type", key: "entryType", width: 24 },
    { header: "Project member ID", key: "projectMemberId", width: 36 },
    { header: "Member name", key: "memberName", width: 24 },
    { header: "Allocation type", key: "allocationType", width: 18 },
    {
      header: "Amount",
      key: "amount",
      width: 16,
      style: { numFmt: MONEY_FORMAT },
    },
    {
      header: "Weight percent",
      key: "weightPercent",
      width: 14,
      style: { numFmt: PERCENT_FORMAT },
    },
    { header: "Note", key: "note", width: 24 },
  ];
  setHeaderStyle(sheet.getRow(1));

  for (const allocation of dataset.allocations.slice().sort((left, right) => {
    const leftEntry = entryById.get(left.ledgerEntryId);
    const rightEntry = entryById.get(right.ledgerEntryId);
    return byDateAsc(leftEntry ?? {}, rightEntry ?? {});
  })) {
    const entry = entryById.get(allocation.ledgerEntryId);
    if (!entry) {
      continue;
    }

    sheet.addRow({
      entryId: entry.id,
      entryStatus: entry.status,
      effectiveAt: toExcelDate(entry.effectiveAt),
      entryType: entry.entryType,
      projectMemberId: allocation.projectMemberId,
      memberName:
        memberNameById.get(allocation.projectMemberId) ??
        allocation.projectMemberId,
      allocationType: allocation.allocationType,
      amount: allocation.amount,
      weightPercent:
        allocation.weightPercent == null ? "" : allocation.weightPercent / 100,
      note: allocation.note ?? "",
    });
  }
}

function buildCalcSheet(
  workbook: ExcelJS.Workbook,
  snapshot: ProjectSnapshot,
  cashClaimView: ProjectCashClaimView,
  transactionSheet: TransactionSheetContext
): CalcSheetRefs {
  const sheet = workbook.addWorksheet("_calc");
  sheet.state = "hidden";

  const memberDirectory = buildMemberDirectory(snapshot);
  const claimRowById = cashClaimView.rowsByProjectMemberId;
  const capitalWeightById = new Map(
    snapshot.capitalWeights.map((row) => [row.projectMemberId, row.weight])
  );

  sheet.getCell("A1").value = "Audit metric support";
  sheet.getCell("A1").font = { bold: true, size: 13 };
  sheet.getCell("A2").value = "Metric";
  sheet.getCell("B2").value = "Workbook formula";
  sheet.getCell("C2").value = "Web snapshot";
  sheet.getCell("D2").value = "Delta";
  setHeaderStyle(sheet.getRow(2));

  const memberStartRow = 19;
  const memberEndRow = memberStartRow + memberDirectory.length - 1;
  const projectMoneyRange = `$D$${memberStartRow}:$D$${memberEndRow}`;
  const frontedRange = `$E$${memberStartRow}:$E$${memberEndRow}`;
  const capitalRange = `$G$${memberStartRow}:$G$${memberEndRow}`;
  const estimatedProfitRange = `$H$${memberStartRow}:$H$${memberEndRow}`;
  const entitlementRange = `$I$${memberStartRow}:$I$${memberEndRow}`;
  const positiveCashRange = `$J$${memberStartRow}:$J$${memberEndRow}`;
  const positiveEntitlementRange = `$K$${memberStartRow}:$K$${memberEndRow}`;
  const reserveWeightRange = `$L$${memberStartRow}:$L$${memberEndRow}`;
  const reserveBaseRange = `$M$${memberStartRow}:$M$${memberEndRow}`;

  const positiveCashHeldApp = roundMoney(
    snapshot.memberSummaries.reduce(
      (sum, summary) => sum + Math.max(summary.projectCashCustody, 0),
      0
    )
  );
  const positiveEntitlementApp = roundMoney(
    cashClaimView.rows.reduce(
      (sum, row) => sum + Math.max(row.cashEntitlement, 0),
      0
    )
  );

  const metricDefinitions: Array<{
    key: CalcMetricKey;
    label: string;
    row: number;
    formula: string;
    appValue: number;
  }> = [
    {
      key: "totalProjectCash",
      label: "Money in the project now",
      row: 3,
      formula: `ROUND(SUM(${projectMoneyRange}),2)`,
      appValue: snapshot.totalProjectCash,
    },
    {
      key: "membersHoldingProjectCashTotal",
      label: "Members holding project money",
      row: 4,
      formula: `ROUND(SUMIF(${projectMoneyRange},\">0\",${projectMoneyRange}),2)`,
      appValue: snapshot.membersHoldingProjectCashTotal,
    },
    {
      key: "frontedByMembersTotal",
      label: "Members fronting their own money",
      row: 5,
      formula: `ROUND(SUM(${frontedRange}),2)`,
      appValue: snapshot.frontedByMembersTotal,
    },
    {
      key: "totalCapitalOutstanding",
      label: "Capital invested",
      row: 6,
      formula: `ROUND(SUM(${capitalRange}),2)`,
      appValue: snapshot.totalCapitalOutstanding,
    },
    {
      key: "estimatedProfitToday",
      label: "Estimated profit if distributed today",
      row: 7,
      formula: `ROUND(SUM(${estimatedProfitRange}),2)`,
      appValue: snapshot.undistributedProfit,
    },
    {
      key: "sharedLoanPrincipalOutstanding",
      label: "Shared loan principal outstanding",
      row: 8,
      formula:
        `ROUND(` +
        `SUMIFS(Transactions!$G:$G,Transactions!$B:$B,\"posted\",Transactions!$${transactionSheet.hiddenEntryTypeKeyColumn}:$${transactionSheet.hiddenEntryTypeKeyColumn},\"shared_loan_drawdown\")` +
        `-SUMIFS(Transactions!$G:$G,Transactions!$B:$B,\"posted\",Transactions!$${transactionSheet.hiddenEntryTypeKeyColumn}:$${transactionSheet.hiddenEntryTypeKeyColumn},\"shared_loan_repayment_principal\")` +
        `,2)`,
      appValue: snapshot.sharedLoanPrincipalOutstanding,
    },
    {
      key: "projectOperatingIncome",
      label: "Project operating income",
      row: 9,
      formula:
        `ROUND(SUMIFS(Transactions!$G:$G,Transactions!$B:$B,\"posted\",Transactions!$${transactionSheet.hiddenEntryTypeKeyColumn}:$${transactionSheet.hiddenEntryTypeKeyColumn},\"operating_income\"),2)`,
      appValue: snapshot.projectOperatingIncome,
    },
    {
      key: "projectOperatingExpense",
      label: "Project operating expense",
      row: 10,
      formula:
        `ROUND(` +
        `SUMIFS(Transactions!$G:$G,Transactions!$B:$B,\"posted\",Transactions!$${transactionSheet.hiddenEntryTypeKeyColumn}:$${transactionSheet.hiddenEntryTypeKeyColumn},\"operating_expense\")` +
        `+SUMIFS(Transactions!$G:$G,Transactions!$B:$B,\"posted\",Transactions!$${transactionSheet.hiddenEntryTypeKeyColumn}:$${transactionSheet.hiddenEntryTypeKeyColumn},\"shared_loan_interest_payment\")` +
        `,2)`,
      appValue: snapshot.projectOperatingExpense,
    },
    {
      key: "sharedLoanInterestPaid",
      label: "Shared loan interest paid",
      row: 11,
      formula:
        `ROUND(SUMIFS(Transactions!$G:$G,Transactions!$B:$B,\"posted\",Transactions!$${transactionSheet.hiddenEntryTypeKeyColumn}:$${transactionSheet.hiddenEntryTypeKeyColumn},\"shared_loan_interest_payment\"),2)`,
      appValue: snapshot.sharedLoanInterestPaidTotal,
    },
    {
      key: "reserveCashTotal",
      label: "Reserve cash total",
      row: 12,
      formula: `ROUND($B$3-SUM(${entitlementRange}),2)`,
      appValue: cashClaimView.reserveCashTotal,
    },
    {
      key: "positiveCashHeldTotal",
      label: "Positive cash held total",
      row: 13,
      formula: `ROUND(SUM(${positiveCashRange}),2)`,
      appValue: positiveCashHeldApp,
    },
    {
      key: "positiveEntitlementTotal",
      label: "Positive entitlement total",
      row: 14,
      formula: `ROUND(SUM(${positiveEntitlementRange}),2)`,
      appValue: positiveEntitlementApp,
    },
  ];

  const metricRefs = {} as Record<CalcMetricKey, CalcMetricRef>;

  for (const metric of metricDefinitions) {
    sheet.getCell(`A${metric.row}`).value = metric.label;
    sheet.getCell(`B${metric.row}`).value = {
      formula: metric.formula,
      result: metric.appValue,
    };
    sheet.getCell(`C${metric.row}`).value = metric.appValue;
    sheet.getCell(`D${metric.row}`).value = {
      formula: `ROUND(B${metric.row}-C${metric.row},2)`,
      result: 0,
    };
    sheet.getCell(`B${metric.row}`).numFmt = MONEY_FORMAT;
    sheet.getCell(`C${metric.row}`).numFmt = MONEY_FORMAT;
    sheet.getCell(`D${metric.row}`).numFmt = MONEY_FORMAT;
    metricRefs[metric.key] = {
      workbookCell: `B${metric.row}`,
      appCell: `C${metric.row}`,
      deltaCell: `D${metric.row}`,
    };
  }

  sheet.getCell("A15").value = "Max reserve weight";
  sheet.getCell("B15").value = {
    formula: `MAX(${reserveWeightRange})`,
    result: 0,
  };
  sheet.getCell("A16").value = "Reserve remainder";
  sheet.getCell("B16").value = {
    formula: `ROUND($B$12-SUM(${reserveBaseRange}),2)`,
    result: 0,
  };
  sheet.getCell("B15").numFmt = PERCENT_FORMAT;
  sheet.getCell("B16").numFmt = MONEY_FORMAT;

  sheet.getCell("A18").value = "Order";
  sheet.getCell("B18").value = "Project member ID";
  sheet.getCell("C18").value = "Member";
  sheet.getCell("D18").value = "Project money held";
  sheet.getCell("E18").value = "Fronted own money";
  sheet.getCell("F18").value = "Expense reimbursement (engine)";
  sheet.getCell("G18").value = "Capital invested";
  sheet.getCell("H18").value = "Estimated profit today (engine)";
  sheet.getCell("I18").value = "Cash entitlement";
  sheet.getCell("J18").value = "Positive cash held";
  sheet.getCell("K18").value = "Positive entitlement";
  sheet.getCell("L18").value = "Reserve weight";
  sheet.getCell("M18").value = "Reserve base";
  sheet.getCell("N18").value = "Reserve allocation";
  sheet.getCell("O18").value = "Distributable cash held";
  sheet.getCell("P18").value = "Team owes you";
  sheet.getCell("Q18").value = "You owe team";
  sheet.getCell("R18").value = "Profit weight";
  sheet.getCell("S18").value = "App project money held";
  sheet.getCell("T18").value = "App fronted own money";
  sheet.getCell("U18").value = "App capital invested";
  sheet.getCell("V18").value = "App estimated profit today";
  sheet.getCell("W18").value = "App team owes you";
  sheet.getCell("X18").value = "App you owe team";
  setHeaderStyle(sheet.getRow(18));

  const memberRefs: CalcMemberRef[] = [];

  for (const [index, row] of memberDirectory.entries()) {
    const excelRow = memberStartRow + index;
    const claimRow = claimRowById.get(row.projectMemberId);
    const summary = row.summary;
    const capitalWeight = capitalWeightById.get(row.projectMemberId) ?? 0;
    const countIfRange = `$L$${memberStartRow}:$L${excelRow}`;

    sheet.getCell(`A${excelRow}`).value = row.order;
    sheet.getCell(`B${excelRow}`).value = row.projectMemberId;
    sheet.getCell(`C${excelRow}`).value = row.displayName;
    sheet.getCell(`D${excelRow}`).value = {
      formula:
        `ROUND(` +
        `SUMIFS(Transactions!$G:$G,Transactions!$B:$B,\"posted\",Transactions!$${transactionSheet.hiddenCashInIdColumn}:$${transactionSheet.hiddenCashInIdColumn},$B${excelRow})` +
        `-SUMIFS(Transactions!$G:$G,Transactions!$B:$B,\"posted\",Transactions!$${transactionSheet.hiddenCashOutIdColumn}:$${transactionSheet.hiddenCashOutIdColumn},$B${excelRow})` +
        `,2)`,
      result: summary.projectCashCustody,
    };
    sheet.getCell(`E${excelRow}`).value = {
      formula: `ROUND(MAX(-D${excelRow},0),2)`,
      result: summary.frontedOwnMoney,
    };
    sheet.getCell(`F${excelRow}`).value = summary.expenseReimbursementBalance;
    sheet.getCell(`G${excelRow}`).value = {
      formula:
        `ROUND(` +
        `SUMIFS(_allocations!$H:$H,_allocations!$B:$B,\"posted\",_allocations!$D:$D,\"capital_contribution\",_allocations!$E:$E,$B${excelRow},_allocations!$G:$G,\"capital_owner\")` +
        `-SUMIFS(_allocations!$H:$H,_allocations!$B:$B,\"posted\",_allocations!$D:$D,\"capital_return\",_allocations!$E:$E,$B${excelRow},_allocations!$G:$G,\"capital_owner\")` +
        `,2)`,
      result: summary.capitalBalance,
    };
    sheet.getCell(`H${excelRow}`).value = summary.estimatedProfitShare;
    sheet.getCell(`I${excelRow}`).value = {
      formula: `ROUND(G${excelRow}+H${excelRow}+F${excelRow},2)`,
      result:
        claimRow?.cashEntitlement ??
        roundMoney(
          summary.capitalBalance +
            summary.estimatedProfitShare +
            summary.expenseReimbursementBalance
        ),
    };
    sheet.getCell(`J${excelRow}`).value = {
      formula: `ROUND(MAX(D${excelRow},0),2)`,
      result: Math.max(summary.projectCashCustody, 0),
    };
    sheet.getCell(`K${excelRow}`).value = {
      formula: `ROUND(MAX(I${excelRow},0),2)`,
      result: Math.max(claimRow?.cashEntitlement ?? 0, 0),
    };
    sheet.getCell(`L${excelRow}`).value = {
      formula:
        `IF(ABS($B$12)<=0.01,0,` +
        `IF($B$13>0.01,J${excelRow}/$B$13,` +
        `IF($B$14>0.01,K${excelRow}/$B$14,` +
        `IF(A${excelRow}=MIN($A$${memberStartRow}:$A$${memberEndRow}),1,0)` +
        `)))`,
      result: 0,
    };
    sheet.getCell(`M${excelRow}`).value = {
      formula: `ROUND($B$12*L${excelRow},2)`,
      result: claimRow?.reserveAllocation ?? 0,
    };
    sheet.getCell(`N${excelRow}`).value = {
      formula:
        `ROUND(M${excelRow}+IF(AND(ABS($B$16)>0.01,L${excelRow}=$B$15,COUNTIF(${countIfRange},$B$15)=1),$B$16,0),2)`,
      result: claimRow?.reserveAllocation ?? 0,
    };
    sheet.getCell(`O${excelRow}`).value = {
      formula: `ROUND(D${excelRow}-N${excelRow},2)`,
      result: claimRow?.distributableCashHeld ?? summary.projectCashCustody,
    };
    sheet.getCell(`P${excelRow}`).value = {
      formula: `ROUND(MAX(I${excelRow}-O${excelRow},0),2)`,
      result: claimRow?.teamOwesYou ?? 0,
    };
    sheet.getCell(`Q${excelRow}`).value = {
      formula: `ROUND(MAX(O${excelRow}-I${excelRow},0),2)`,
      result: claimRow?.youOweTeam ?? 0,
    };
    sheet.getCell(`R${excelRow}`).value = {
      formula:
        `IF(G${excelRow}>0,ROUND(G${excelRow}/SUMIF($G$${memberStartRow}:$G$${memberEndRow},\">0\",$G$${memberStartRow}:$G$${memberEndRow}),6),0)`,
      result: capitalWeight,
    };
    sheet.getCell(`S${excelRow}`).value = summary.projectCashCustody;
    sheet.getCell(`T${excelRow}`).value = summary.frontedOwnMoney;
    sheet.getCell(`U${excelRow}`).value = summary.capitalBalance;
    sheet.getCell(`V${excelRow}`).value = summary.estimatedProfitShare;
    sheet.getCell(`W${excelRow}`).value = claimRow?.teamOwesYou ?? 0;
    sheet.getCell(`X${excelRow}`).value = claimRow?.youOweTeam ?? 0;

    for (const column of [
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "M",
      "N",
      "O",
      "P",
      "Q",
      "S",
      "T",
      "U",
      "V",
      "W",
      "X",
    ]) {
      sheet.getCell(`${column}${excelRow}`).numFmt = MONEY_FORMAT;
    }

    sheet.getCell(`L${excelRow}`).numFmt = PERCENT_FORMAT;
    sheet.getCell(`R${excelRow}`).numFmt = PERCENT_FORMAT;

    memberRefs.push({
      row: excelRow,
      projectMemberId: row.projectMemberId,
      displayName: row.displayName,
    });
  }

  sheet.columns = [
    { key: "A", width: 8 },
    { key: "B", width: 36 },
    { key: "C", width: 22 },
    { key: "D", width: 16 },
    { key: "E", width: 16 },
    { key: "F", width: 18 },
    { key: "G", width: 16 },
    { key: "H", width: 18 },
    { key: "I", width: 16 },
    { key: "J", width: 16 },
    { key: "K", width: 16 },
    { key: "L", width: 12 },
    { key: "M", width: 14 },
    { key: "N", width: 14 },
    { key: "O", width: 18 },
    { key: "P", width: 16 },
    { key: "Q", width: 16 },
    { key: "R", width: 12 },
    { key: "S", width: 16 },
    { key: "T", width: 16 },
    { key: "U", width: 16 },
    { key: "V", width: 18 },
    { key: "W", width: 16 },
    { key: "X", width: 16 },
  ];

  return {
    metrics: metricRefs,
    memberRows: memberRefs,
  };
}

function buildDashboardSheet(
  sheet: ExcelJS.Worksheet,
  snapshot: ProjectSnapshot,
  refs: CalcSheetRefs,
  cashClaimView: ProjectCashClaimView
) {
  const capitalWeightById = new Map(
    snapshot.capitalWeights.map((row) => [row.projectMemberId, row.weight])
  );
  const claimRowById = cashClaimView.rowsByProjectMemberId;
  const metricRows = [
    {
      label: "Money in the project now",
      ref: refs.metrics.totalProjectCash,
      result: snapshot.totalProjectCash,
    },
    {
      label: "Members holding project money",
      ref: refs.metrics.membersHoldingProjectCashTotal,
      result: snapshot.membersHoldingProjectCashTotal,
    },
    {
      label: "Members fronting their own money",
      ref: refs.metrics.frontedByMembersTotal,
      result: snapshot.frontedByMembersTotal,
    },
    {
      label: "Capital invested",
      ref: refs.metrics.totalCapitalOutstanding,
      result: snapshot.totalCapitalOutstanding,
    },
    {
      label: "Estimated profit if distributed today",
      ref: refs.metrics.estimatedProfitToday,
      result: snapshot.undistributedProfit,
    },
    {
      label: "Shared loan principal outstanding",
      ref: refs.metrics.sharedLoanPrincipalOutstanding,
      result: snapshot.sharedLoanPrincipalOutstanding,
    },
    {
      label: "Project operating income",
      ref: refs.metrics.projectOperatingIncome,
      result: snapshot.projectOperatingIncome,
    },
    {
      label: "Project operating expense",
      ref: refs.metrics.projectOperatingExpense,
      result: snapshot.projectOperatingExpense,
    },
  ];

  sheet.views = [{ state: "frozen", ySplit: 5 }];
  sheet.getCell("A1").value = `${snapshot.dataset.project.name} audit export`;
  sheet.getCell("A1").font = { bold: true, size: 16 };
  sheet.getCell("A2").value =
    "Workbook formulas mirror the exported audit math. Helper sheets stay hidden so auditors can inspect the raw rows separately.";
  sheet.mergeCells("A2:D2");

  sheet.getCell("A4").value = "Core audit metrics";
  setSectionStyle(sheet.getRow(4));
  sheet.mergeCells("A4:D4");
  sheet.getCell("A5").value = "Metric";
  sheet.getCell("B5").value = "Workbook formula";
  sheet.getCell("C5").value = "Web snapshot";
  sheet.getCell("D5").value = "Delta";
  setHeaderStyle(sheet.getRow(5));

  for (const [index, metric] of metricRows.entries()) {
    const row = 6 + index;
    sheet.getCell(`A${row}`).value = metric.label;
    sheet.getCell(`B${row}`).value = {
      formula: `_calc!${metric.ref.workbookCell}`,
      result: metric.result,
    };
    sheet.getCell(`C${row}`).value = {
      formula: `_calc!${metric.ref.appCell}`,
      result: metric.result,
    };
    sheet.getCell(`D${row}`).value = {
      formula: `_calc!${metric.ref.deltaCell}`,
      result: 0,
    };

    sheet.getCell(`B${row}`).numFmt = MONEY_FORMAT;
    sheet.getCell(`C${row}`).numFmt = MONEY_FORMAT;
    sheet.getCell(`D${row}`).numFmt = MONEY_FORMAT;
  }

  const overviewHeaderRow = 16;
  const overviewStartRow = 17;
  const overviewEndRow = overviewStartRow + refs.memberRows.length - 1;

  sheet.getCell(`A${overviewHeaderRow - 1}`).value = "Who is holding project money";
  setSectionStyle(sheet.getRow(overviewHeaderRow - 1));
  sheet.mergeCells(`A${overviewHeaderRow - 1}:F${overviewHeaderRow - 1}`);
  sheet.getCell(`A${overviewHeaderRow}`).value = "Member";
  sheet.getCell(`B${overviewHeaderRow}`).value = "Project money held";
  sheet.getCell(`C${overviewHeaderRow}`).value = "Fronted own money";
  sheet.getCell(`D${overviewHeaderRow}`).value = "Team owes you";
  sheet.getCell(`E${overviewHeaderRow}`).value = "You owe team";
  sheet.getCell(`F${overviewHeaderRow}`).value = "Estimated profit today";
  setHeaderStyle(sheet.getRow(overviewHeaderRow));

  for (const [index, member] of refs.memberRows.entries()) {
    const row = overviewStartRow + index;
    const summary = snapshot.memberSummaries[index];
    const claimRow = claimRowById.get(member.projectMemberId);

    sheet.getCell(`A${row}`).value = member.displayName;
    sheet.getCell(`B${row}`).value = {
      formula: `_calc!D${member.row}`,
      result: summary?.projectCashCustody ?? 0,
    };
    sheet.getCell(`C${row}`).value = {
      formula: `_calc!E${member.row}`,
      result: summary?.frontedOwnMoney ?? 0,
    };
    sheet.getCell(`D${row}`).value = {
      formula: `_calc!P${member.row}`,
      result: claimRow?.teamOwesYou ?? 0,
    };
    sheet.getCell(`E${row}`).value = {
      formula: `_calc!Q${member.row}`,
      result: claimRow?.youOweTeam ?? 0,
    };
    sheet.getCell(`F${row}`).value = {
      formula: `_calc!H${member.row}`,
      result: summary?.estimatedProfitShare ?? 0,
    };

    for (const column of ["B", "C", "D", "E", "F"]) {
      sheet.getCell(`${column}${row}`).numFmt = MONEY_FORMAT;
    }
  }

  const capitalHeaderRow = overviewEndRow + 4;
  const capitalStartRow = capitalHeaderRow + 1;

  sheet.getCell(`A${capitalHeaderRow - 1}`).value =
    "Capital and profit claim today";
  setSectionStyle(sheet.getRow(capitalHeaderRow - 1));
  sheet.mergeCells(`A${capitalHeaderRow - 1}:D${capitalHeaderRow - 1}`);
  sheet.getCell(`A${capitalHeaderRow}`).value = "Member";
  sheet.getCell(`B${capitalHeaderRow}`).value = "Capital invested";
  sheet.getCell(`C${capitalHeaderRow}`).value = "Profit weight";
  sheet.getCell(`D${capitalHeaderRow}`).value = "Estimated profit today";
  setHeaderStyle(sheet.getRow(capitalHeaderRow));

  for (const [index, member] of refs.memberRows.entries()) {
    const row = capitalStartRow + index;
    const summary = snapshot.memberSummaries[index];

    sheet.getCell(`A${row}`).value = member.displayName;
    sheet.getCell(`B${row}`).value = {
      formula: `_calc!G${member.row}`,
      result: summary?.capitalBalance ?? 0,
    };
    sheet.getCell(`C${row}`).value = {
      formula: `_calc!R${member.row}`,
      result: capitalWeightById.get(member.projectMemberId) ?? 0,
    };
    sheet.getCell(`D${row}`).value = {
      formula: `_calc!H${member.row}`,
      result: summary?.estimatedProfitShare ?? 0,
    };
    sheet.getCell(`B${row}`).numFmt = MONEY_FORMAT;
    sheet.getCell(`C${row}`).numFmt = PERCENT_FORMAT;
    sheet.getCell(`D${row}`).numFmt = MONEY_FORMAT;
  }

  sheet.columns = [
    { key: "A", width: 28 },
    { key: "B", width: 18 },
    { key: "C", width: 18 },
    { key: "D", width: 18 },
    { key: "E", width: 18 },
    { key: "F", width: 18 },
  ];
  sheet.getCell("F1").value = `Currency: ${snapshot.dataset.project.currencyCode}`;
  sheet.getCell("F1").alignment = { horizontal: "right" };
}

export function createProjectAuditFileName(
  projectSlug: string,
  generatedAt = new Date()
) {
  const slug = sanitizeFileSegment(projectSlug) || "project";
  return `${slug}-audit-${toFileNameTimestamp(generatedAt)}.xlsx`;
}

export async function buildProjectAuditWorkbook({
  dataset,
  snapshot,
  generatedAt = new Date(),
}: WorkbookBuildInput) {
  const workbook = new ExcelJS.Workbook();
  const cashClaimView = buildProjectCashClaimView(snapshot);

  workbook.creator = "Codex";
  workbook.company = "Project Current";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.calcProperties.fullCalcOnLoad = true;

  const transactionSheet = buildTransactionsSheet(workbook, dataset, snapshot);
  const dashboardSheet = workbook.addWorksheet("Dashboard", {
    views: [{ state: "frozen", ySplit: 5 }],
  });
  buildMembersSheet(workbook, snapshot);
  buildAllocationsSheet(workbook, dataset, snapshot);
  const calcRefs = buildCalcSheet(workbook, snapshot, cashClaimView, transactionSheet);
  buildDashboardSheet(dashboardSheet, snapshot, calcRefs, cashClaimView);

  return {
    workbook,
    fileName: createProjectAuditFileName(dataset.project.slug, generatedAt),
  };
}
