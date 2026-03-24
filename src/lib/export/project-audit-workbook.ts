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
  type EntryType,
  type LedgerAllocation,
  type LedgerEntry,
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
const PASS_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFECFDF3" },
};
const PASS_FONT = { color: { argb: "FF166534" }, bold: true };
const FAIL_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFFEF2F2" },
};
const FAIL_FONT = { color: { argb: "FFB91C1C" }, bold: true };

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
  calcLabelCell: string;
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
  sheet: ExcelJS.Worksheet;
  rowByEntryId: Map<string, number>;
  columns: {
    status: string;
    amount: string;
    effectiveAt: string;
    description: string;
    cashInMemberId: string;
    cashOutMemberId: string;
    entryTypeKey: string;
    reversalOfEntryId: string;
    auditTrace: string;
  };
};

type EntryEffectsSheetContext = {
  sheet: ExcelJS.Worksheet;
  rowByEntryId: Map<string, number>;
  columns: {
    projectCashDelta: string;
    capitalDelta: string;
    operatingIncomeDelta: string;
    operatingExpenseDelta: string;
    profitDistributionDelta: string;
    ownerProfitPayoutDelta: string;
    sharedLoanPrincipalDelta: string;
    estimatedProfitDelta: string;
  };
};

type AuditSourceEntry = {
  sourceEntry: LedgerEntry | null;
  sign: 1 | -1 | 0;
  note: string;
};

type EntryAuditEffect = {
  includedInPostedMath: boolean;
  affectsProjectCash: boolean;
  affectsCapital: boolean;
  affectsOperatingProfit: boolean;
  affectsSharedLoanPrincipal: boolean;
  affectsMemberCashClaims: boolean;
  projectCashDelta: number;
  capitalDelta: number;
  operatingIncomeDelta: number;
  operatingExpenseDelta: number;
  profitDistributionDelta: number;
  ownerProfitPayoutDelta: number;
  sharedLoanPrincipalDelta: number;
  estimatedProfitDelta: number;
  auditDriver: string;
  auditNote: string;
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

function columnNumberToLetter(columnNumber: number) {
  let dividend = columnNumber;
  let columnName = "";

  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    columnName = String.fromCharCode(65 + modulo) + columnName;
    dividend = Math.floor((dividend - modulo) / 26);
  }

  return columnName;
}

function getColumnLetterByKey(sheet: ExcelJS.Worksheet, key: string) {
  return columnNumberToLetter(sheet.getColumn(key).number);
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

function setLinkStyle(cell: ExcelJS.Cell) {
  cell.font = { color: { argb: "FF1D4ED8" }, underline: true };
}

function quoteSheetName(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

function createInternalLink(sheetName: string, cell: string, text: string) {
  return {
    text,
    hyperlink: `#${quoteSheetName(sheetName)}!${cell}`,
  };
}

function registerColumnRange(
  workbook: ExcelJS.Workbook,
  rangeName: string,
  sheetName: string,
  columnLetter: string,
  lastDataRow: number
) {
  workbook.definedNames.add(
    rangeName,
    `${quoteSheetName(sheetName)}!$${columnLetter}$2:$${columnLetter}$${Math.max(
      lastDataRow,
      2
    )}`
  );
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function buildEntryTypeMatchFormula(cellRef: string, entryTypes: EntryType[]) {
  if (entryTypes.length === 1) {
    return `${cellRef}="${entryTypes[0]}"`;
  }

  return `OR(${entryTypes.map((entryType) => `${cellRef}="${entryType}"`).join(",")})`;
}

function withPostedSign(
  statusRef: string,
  expression: string,
  sign: AuditSourceEntry["sign"]
) {
  if (sign === 0) {
    return "0";
  }

  const signedExpression = sign === 1 ? expression : `-1*(${expression})`;
  return `ROUND(IF(${statusRef}<>"posted",0,${signedExpression}),2)`;
}

function buildAuditDriver(entryType: EntryType) {
  const drivers: string[] = [];

  if (
    entryType === "capital_contribution" ||
    entryType === "capital_return"
  ) {
    drivers.push("capital");
  }

  if (
    entryType === "operating_income" ||
    entryType === "operating_expense" ||
    entryType === "shared_loan_interest_payment"
  ) {
    drivers.push("operating profit");
  }

  if (
    entryType === "shared_loan_drawdown" ||
    entryType === "shared_loan_repayment_principal"
  ) {
    drivers.push("shared loan principal");
  }

  if (
    entryType === "profit_distribution" ||
    entryType === "owner_profit_payout"
  ) {
    drivers.push("profit paid");
  }

  if (entryType === "expense_settlement_payment") {
    drivers.push("shared-expense settlement");
  }

  if (entryType === "cash_handover") {
    drivers.push("cash custody");
  }

  if (
    entryType === "reconciliation_adjustment" ||
    entryType === "reversal"
  ) {
    drivers.push("correction / reversal");
  }

  return drivers.join(", ");
}

function resolveAuditSourceEntry(
  entry: LedgerEntry,
  entryById: Map<string, LedgerEntry>
): AuditSourceEntry {
  if (entry.entryType !== "reversal" || !entry.reversalOfEntryId) {
    return {
      sourceEntry: entry,
      sign: 1,
      note: "",
    };
  }

  const reversedEntry = entryById.get(entry.reversalOfEntryId);
  if (!reversedEntry) {
    return {
      sourceEntry: null,
      sign: 0,
      note: "Posted reversal row without a matching source entry. Workbook treats it as zero impact.",
    };
  }

  return {
    sourceEntry: reversedEntry,
    sign: -1,
    note: `Posted reversal row. Workbook negates source entry ${reversedEntry.id}.`,
  };
}

function computeEntryAuditEffect(
  entry: LedgerEntry,
  auditSource: AuditSourceEntry
): EntryAuditEffect {
  const sourceEntry = auditSource.sourceEntry;
  const includedInPostedMath =
    entry.status === "posted" && auditSource.sign !== 0 && Boolean(sourceEntry);

  if (!sourceEntry || !includedInPostedMath) {
    return {
      includedInPostedMath,
      affectsProjectCash: false,
      affectsCapital: false,
      affectsOperatingProfit: false,
      affectsSharedLoanPrincipal: false,
      affectsMemberCashClaims: false,
      projectCashDelta: 0,
      capitalDelta: 0,
      operatingIncomeDelta: 0,
      operatingExpenseDelta: 0,
      profitDistributionDelta: 0,
      ownerProfitPayoutDelta: 0,
      sharedLoanPrincipalDelta: 0,
      estimatedProfitDelta: 0,
      auditDriver: sourceEntry ? buildAuditDriver(sourceEntry.entryType) : "",
      auditNote:
        auditSource.note ||
        "Visible in Transactions, but excluded from dashboard math because it is not posted.",
    };
  }

  const sign = auditSource.sign;
  const projectCashDelta =
    sign *
    ((sourceEntry.cashInMemberId ? sourceEntry.amount : 0) -
      (sourceEntry.cashOutMemberId ? sourceEntry.amount : 0));
  const capitalDelta =
    sign *
    (sourceEntry.entryType === "capital_contribution"
      ? sourceEntry.amount
      : sourceEntry.entryType === "capital_return"
        ? -sourceEntry.amount
        : 0);
  const operatingIncomeDelta =
    sign * (sourceEntry.entryType === "operating_income" ? sourceEntry.amount : 0);
  const operatingExpenseDelta =
    sign *
    (sourceEntry.entryType === "operating_expense" ||
    sourceEntry.entryType === "shared_loan_interest_payment"
      ? sourceEntry.amount
      : 0);
  const profitDistributionDelta =
    sign * (sourceEntry.entryType === "profit_distribution" ? sourceEntry.amount : 0);
  const ownerProfitPayoutDelta =
    sign * (sourceEntry.entryType === "owner_profit_payout" ? sourceEntry.amount : 0);
  const sharedLoanPrincipalDelta =
    sign *
    (sourceEntry.entryType === "shared_loan_drawdown"
      ? sourceEntry.amount
      : sourceEntry.entryType === "shared_loan_repayment_principal"
        ? -sourceEntry.amount
        : 0);
  const estimatedProfitDelta =
    operatingIncomeDelta -
    operatingExpenseDelta -
    profitDistributionDelta -
    ownerProfitPayoutDelta;
  const affectsProjectCash = Boolean(
    sourceEntry.cashInMemberId || sourceEntry.cashOutMemberId
  );
  const affectsCapital =
    sourceEntry.entryType === "capital_contribution" ||
    sourceEntry.entryType === "capital_return";
  const affectsOperatingProfit =
    sourceEntry.entryType === "operating_income" ||
    sourceEntry.entryType === "operating_expense" ||
    sourceEntry.entryType === "shared_loan_interest_payment";
  const affectsSharedLoanPrincipal =
    sourceEntry.entryType === "shared_loan_drawdown" ||
    sourceEntry.entryType === "shared_loan_repayment_principal";
  const affectsMemberCashClaims =
    affectsProjectCash ||
    affectsCapital ||
    affectsOperatingProfit ||
    affectsSharedLoanPrincipal ||
    sourceEntry.entryType === "profit_distribution" ||
    sourceEntry.entryType === "owner_profit_payout" ||
    sourceEntry.entryType === "expense_settlement_payment";

  return {
    includedInPostedMath,
    affectsProjectCash,
    affectsCapital,
    affectsOperatingProfit,
    affectsSharedLoanPrincipal,
    affectsMemberCashClaims,
    projectCashDelta: roundMoney(projectCashDelta),
    capitalDelta: roundMoney(capitalDelta),
    operatingIncomeDelta: roundMoney(operatingIncomeDelta),
    operatingExpenseDelta: roundMoney(operatingExpenseDelta),
    profitDistributionDelta: roundMoney(profitDistributionDelta),
    ownerProfitPayoutDelta: roundMoney(ownerProfitPayoutDelta),
    sharedLoanPrincipalDelta: roundMoney(sharedLoanPrincipalDelta),
    estimatedProfitDelta: roundMoney(estimatedProfitDelta),
    auditDriver: buildAuditDriver(sourceEntry.entryType),
    auditNote:
      auditSource.note || "Normalized directly from this posted transaction row.",
  };
}

function buildTransactionAuditFlags(
  entry: ProjectDataset["entries"][number],
  entryById: Map<string, LedgerEntry>
) {
  const auditEffect = computeEntryAuditEffect(
    entry,
    resolveAuditSourceEntry(entry, entryById)
  );

  return {
    includedInDashboardMath: yesNo(auditEffect.includedInPostedMath),
    affectsProjectCash: yesNo(auditEffect.affectsProjectCash),
    affectsCapital: yesNo(auditEffect.affectsCapital),
    affectsOperatingProfit: yesNo(auditEffect.affectsOperatingProfit),
    affectsSharedLoanPrincipal: yesNo(auditEffect.affectsSharedLoanPrincipal),
    affectsMemberCashClaims: yesNo(auditEffect.affectsMemberCashClaims),
    auditDriver: auditEffect.auditDriver,
  };
}

function addZeroDeltaFormatting(
  sheet: ExcelJS.Worksheet,
  _ref: string,
  staticValues: Array<{ cell: string; value: number }>
) {
  for (const { cell, value } of staticValues) {
    const target = sheet.getCell(cell);
    target.fill = Math.abs(value) <= 0.005 ? PASS_FILL : FAIL_FILL;
    target.font = Math.abs(value) <= 0.005 ? PASS_FONT : FAIL_FONT;
  }
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
  const entryById = new Map(dataset.entries.map((entry) => [entry.id, entry]));
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
    {
      header: "Included in dashboard math?",
      key: "includedInDashboardMath",
      width: 22,
    },
    { header: "Affects project cash?", key: "affectsProjectCash", width: 18 },
    { header: "Affects capital?", key: "affectsCapital", width: 16 },
    {
      header: "Affects operating profit?",
      key: "affectsOperatingProfit",
      width: 22,
    },
    {
      header: "Affects shared loan principal?",
      key: "affectsSharedLoanPrincipal",
      width: 24,
    },
    {
      header: "Affects member cash claims?",
      key: "affectsMemberCashClaims",
      width: 22,
    },
    { header: "Audit driver", key: "auditDriver", width: 26 },
    { header: "Audit trace", key: "auditTrace", width: 20 },
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
    to: `${columnNumberToLetter(sheet.columnCount)}1`,
  };

  const rowByEntryId = new Map<string, number>();

  for (const row of transactionRows) {
    const { entry } = row;
    const entryFamilyKey = getEntryFamily(entry.entryType);
    const auditFlags = buildTransactionAuditFlags(entry, entryById);

    const addedRow = sheet.addRow({
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
      includedInDashboardMath: auditFlags.includedInDashboardMath,
      affectsProjectCash: auditFlags.affectsProjectCash,
      affectsCapital: auditFlags.affectsCapital,
      affectsOperatingProfit: auditFlags.affectsOperatingProfit,
      affectsSharedLoanPrincipal: auditFlags.affectsSharedLoanPrincipal,
      affectsMemberCashClaims: auditFlags.affectsMemberCashClaims,
      auditDriver: auditFlags.auditDriver,
      auditTrace: "Pending helper row",
      cashInMemberId: entry.cashInMemberId ?? "",
      cashOutMemberId: entry.cashOutMemberId ?? "",
      entryTypeKey: entry.entryType,
      entryFamilyKey,
    });
    rowByEntryId.set(entry.id, addedRow.number);
  }

  const lastDataRow = sheet.rowCount;
  const statusColumn = getColumnLetterByKey(sheet, "status");
  const amountColumn = getColumnLetterByKey(sheet, "amount");
  const effectiveAtColumn = getColumnLetterByKey(sheet, "effectiveAt");
  const descriptionColumn = getColumnLetterByKey(sheet, "description");
  const cashInMemberIdColumn = getColumnLetterByKey(sheet, "cashInMemberId");
  const cashOutMemberIdColumn = getColumnLetterByKey(sheet, "cashOutMemberId");
  const entryTypeKeyColumn = getColumnLetterByKey(sheet, "entryTypeKey");
  const reversalOfEntryIdColumn = getColumnLetterByKey(sheet, "reversalOfEntryId");
  const auditTraceColumn = getColumnLetterByKey(sheet, "auditTrace");

  registerColumnRange(workbook, "tx_status", "Transactions", statusColumn, lastDataRow);
  registerColumnRange(workbook, "tx_amount", "Transactions", amountColumn, lastDataRow);
  registerColumnRange(
    workbook,
    "tx_cash_in_member_id",
    "Transactions",
    cashInMemberIdColumn,
    lastDataRow
  );
  registerColumnRange(
    workbook,
    "tx_cash_out_member_id",
    "Transactions",
    cashOutMemberIdColumn,
    lastDataRow
  );
  registerColumnRange(
    workbook,
    "tx_entry_type",
    "Transactions",
    entryTypeKeyColumn,
    lastDataRow
  );

  return {
    sheet,
    rowByEntryId,
    columns: {
      status: statusColumn,
      amount: amountColumn,
      effectiveAt: effectiveAtColumn,
      description: descriptionColumn,
      cashInMemberId: cashInMemberIdColumn,
      cashOutMemberId: cashOutMemberIdColumn,
      entryTypeKey: entryTypeKeyColumn,
      reversalOfEntryId: reversalOfEntryIdColumn,
      auditTrace: auditTraceColumn,
    },
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

  const lastDataRow = sheet.rowCount;
  registerColumnRange(
    workbook,
    "alloc_entry_status",
    "_allocations",
    "B",
    lastDataRow
  );
  registerColumnRange(
    workbook,
    "alloc_entry_type",
    "_allocations",
    "D",
    lastDataRow
  );
  registerColumnRange(
    workbook,
    "alloc_member_id",
    "_allocations",
    "E",
    lastDataRow
  );
  registerColumnRange(
    workbook,
    "alloc_allocation_type",
    "_allocations",
    "G",
    lastDataRow
  );
  registerColumnRange(
    workbook,
    "alloc_amount",
    "_allocations",
    "H",
    lastDataRow
  );
}

function buildEntryEffectsSheet(
  workbook: ExcelJS.Workbook,
  dataset: ProjectDataset,
  snapshot: ProjectSnapshot,
  transactionSheet: TransactionSheetContext
): EntryEffectsSheetContext {
  const sheet = workbook.addWorksheet("_entry_effects");
  sheet.state = "hidden";
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const entryById = new Map(dataset.entries.map((entry) => [entry.id, entry]));
  const memberNameById = new Map(
    snapshot.memberSummaries.map((summary) => [
      summary.projectMember.id,
      summary.profile.displayName,
    ])
  );
  const transactionRows = createTransactionSummaries(dataset, snapshot);

  sheet.columns = [
    { header: "Transaction row", key: "transactionRow", width: 14 },
    { header: "Entry ID", key: "entryId", width: 36 },
    { header: "Status", key: "status", width: 12 },
    {
      header: "Effective date",
      key: "effectiveAt",
      width: 14,
      style: { numFmt: DATE_FORMAT },
    },
    { header: "Entry type", key: "entryTypeLabel", width: 28 },
    { header: "Description", key: "description", width: 28 },
    { header: "Money in to member", key: "cashInMemberName", width: 22 },
    { header: "Money out by", key: "cashOutMemberName", width: 22 },
    { header: "Source entry ID", key: "sourceEntryId", width: 36 },
    { header: "Source entry type", key: "sourceEntryTypeLabel", width: 28 },
    { header: "Included in posted math?", key: "includedInPostedMath", width: 22 },
    {
      header: "Project cash delta",
      key: "projectCashDelta",
      width: 16,
      style: { numFmt: MONEY_FORMAT },
    },
    {
      header: "Capital delta",
      key: "capitalDelta",
      width: 16,
      style: { numFmt: MONEY_FORMAT },
    },
    {
      header: "Operating income delta",
      key: "operatingIncomeDelta",
      width: 18,
      style: { numFmt: MONEY_FORMAT },
    },
    {
      header: "Operating expense delta",
      key: "operatingExpenseDelta",
      width: 18,
      style: { numFmt: MONEY_FORMAT },
    },
    {
      header: "Profit distribution delta",
      key: "profitDistributionDelta",
      width: 18,
      style: { numFmt: MONEY_FORMAT },
    },
    {
      header: "Owner profit payout delta",
      key: "ownerProfitPayoutDelta",
      width: 18,
      style: { numFmt: MONEY_FORMAT },
    },
    {
      header: "Shared loan principal delta",
      key: "sharedLoanPrincipalDelta",
      width: 18,
      style: { numFmt: MONEY_FORMAT },
    },
    {
      header: "Estimated profit delta",
      key: "estimatedProfitDelta",
      width: 18,
      style: { numFmt: MONEY_FORMAT },
    },
    { header: "Audit note", key: "auditNote", width: 52 },
  ];
  setHeaderStyle(sheet.getRow(1));
  sheet.autoFilter = {
    from: "A1",
    to: `${columnNumberToLetter(sheet.columnCount)}1`,
  };

  const rowByEntryId = new Map<string, number>();

  for (const transactionRow of transactionRows) {
    const entry = transactionRow.entry;
    const currentTransactionRow = transactionSheet.rowByEntryId.get(entry.id);
    if (!currentTransactionRow) {
      continue;
    }

    const auditSource = resolveAuditSourceEntry(entry, entryById);
    const auditEffect = computeEntryAuditEffect(entry, auditSource);
    const sourceEntry = auditSource.sourceEntry;
    const sourceTransactionRow =
      sourceEntry != null
        ? transactionSheet.rowByEntryId.get(sourceEntry.id) ?? null
        : null;
    const statusRef = `Transactions!$${transactionSheet.columns.status}$${currentTransactionRow}`;
    const sourceAmountRef = sourceTransactionRow
      ? `Transactions!$${transactionSheet.columns.amount}$${sourceTransactionRow}`
      : "0";
    const sourceTypeRef = sourceTransactionRow
      ? `Transactions!$${transactionSheet.columns.entryTypeKey}$${sourceTransactionRow}`
      : '""';
    const sourceCashInMemberIdRef = sourceTransactionRow
      ? `Transactions!$${transactionSheet.columns.cashInMemberId}$${sourceTransactionRow}`
      : '""';
    const sourceCashOutMemberIdRef = sourceTransactionRow
      ? `Transactions!$${transactionSheet.columns.cashOutMemberId}$${sourceTransactionRow}`
      : '""';

    const projectCashExpression =
      `IF(${sourceCashInMemberIdRef}<>"",${sourceAmountRef},0)` +
      `-IF(${sourceCashOutMemberIdRef}<>"",${sourceAmountRef},0)`;
    const capitalExpression =
      `IF(${sourceTypeRef}="capital_contribution",${sourceAmountRef},0)` +
      `-IF(${sourceTypeRef}="capital_return",${sourceAmountRef},0)`;
    const operatingIncomeExpression =
      `IF(${sourceTypeRef}="operating_income",${sourceAmountRef},0)`;
    const operatingExpenseExpression =
      `IF(${buildEntryTypeMatchFormula(sourceTypeRef, [
        "operating_expense",
        "shared_loan_interest_payment",
      ])},${sourceAmountRef},0)`;
    const profitDistributionExpression =
      `IF(${sourceTypeRef}="profit_distribution",${sourceAmountRef},0)`;
    const ownerProfitPayoutExpression =
      `IF(${sourceTypeRef}="owner_profit_payout",${sourceAmountRef},0)`;
    const sharedLoanPrincipalExpression =
      `IF(${sourceTypeRef}="shared_loan_drawdown",${sourceAmountRef},0)` +
      `-IF(${sourceTypeRef}="shared_loan_repayment_principal",${sourceAmountRef},0)`;
    const estimatedProfitExpression =
      `${operatingIncomeExpression}` +
      `-(${operatingExpenseExpression})` +
      `-(${profitDistributionExpression})` +
      `-(${ownerProfitPayoutExpression})`;

    const addedRow = sheet.addRow({
      transactionRow: currentTransactionRow,
      entryId: entry.id,
      status: entry.status,
      effectiveAt: toExcelDate(entry.effectiveAt),
      entryTypeLabel: getEntryTypeLabel(entry.entryType),
      description: entry.description,
      cashInMemberName: sourceEntry?.cashInMemberId
        ? memberNameById.get(sourceEntry.cashInMemberId) ?? sourceEntry.cashInMemberId
        : "",
      cashOutMemberName: sourceEntry?.cashOutMemberId
        ? memberNameById.get(sourceEntry.cashOutMemberId) ?? sourceEntry.cashOutMemberId
        : "",
      sourceEntryId: sourceEntry?.id ?? "",
      sourceEntryTypeLabel: sourceEntry ? getEntryTypeLabel(sourceEntry.entryType) : "",
      includedInPostedMath: yesNo(auditEffect.includedInPostedMath),
      projectCashDelta: {
        formula: withPostedSign(statusRef, projectCashExpression, auditSource.sign),
        result: auditEffect.projectCashDelta,
      },
      capitalDelta: {
        formula: withPostedSign(statusRef, capitalExpression, auditSource.sign),
        result: auditEffect.capitalDelta,
      },
      operatingIncomeDelta: {
        formula: withPostedSign(statusRef, operatingIncomeExpression, auditSource.sign),
        result: auditEffect.operatingIncomeDelta,
      },
      operatingExpenseDelta: {
        formula: withPostedSign(statusRef, operatingExpenseExpression, auditSource.sign),
        result: auditEffect.operatingExpenseDelta,
      },
      profitDistributionDelta: {
        formula: withPostedSign(statusRef, profitDistributionExpression, auditSource.sign),
        result: auditEffect.profitDistributionDelta,
      },
      ownerProfitPayoutDelta: {
        formula: withPostedSign(statusRef, ownerProfitPayoutExpression, auditSource.sign),
        result: auditEffect.ownerProfitPayoutDelta,
      },
      sharedLoanPrincipalDelta: {
        formula: withPostedSign(statusRef, sharedLoanPrincipalExpression, auditSource.sign),
        result: auditEffect.sharedLoanPrincipalDelta,
      },
      estimatedProfitDelta: {
        formula: withPostedSign(statusRef, estimatedProfitExpression, auditSource.sign),
        result: auditEffect.estimatedProfitDelta,
      },
      auditNote: auditEffect.auditNote,
    });

    addedRow.getCell("transactionRow").value = createInternalLink(
      "Transactions",
      `A${currentTransactionRow}`,
      String(currentTransactionRow)
    );
    setLinkStyle(addedRow.getCell("transactionRow"));

    rowByEntryId.set(entry.id, addedRow.number);
  }

  const lastDataRow = sheet.rowCount;
  const projectCashDeltaColumn = getColumnLetterByKey(sheet, "projectCashDelta");
  const capitalDeltaColumn = getColumnLetterByKey(sheet, "capitalDelta");
  const operatingIncomeDeltaColumn = getColumnLetterByKey(sheet, "operatingIncomeDelta");
  const operatingExpenseDeltaColumn = getColumnLetterByKey(
    sheet,
    "operatingExpenseDelta"
  );
  const profitDistributionDeltaColumn = getColumnLetterByKey(
    sheet,
    "profitDistributionDelta"
  );
  const ownerProfitPayoutDeltaColumn = getColumnLetterByKey(
    sheet,
    "ownerProfitPayoutDelta"
  );
  const sharedLoanPrincipalDeltaColumn = getColumnLetterByKey(
    sheet,
    "sharedLoanPrincipalDelta"
  );
  const estimatedProfitDeltaColumn = getColumnLetterByKey(
    sheet,
    "estimatedProfitDelta"
  );

  registerColumnRange(
    workbook,
    "entryfx_project_cash_delta",
    "_entry_effects",
    projectCashDeltaColumn,
    lastDataRow
  );
  registerColumnRange(
    workbook,
    "entryfx_capital_delta",
    "_entry_effects",
    capitalDeltaColumn,
    lastDataRow
  );
  registerColumnRange(
    workbook,
    "entryfx_operating_income_delta",
    "_entry_effects",
    operatingIncomeDeltaColumn,
    lastDataRow
  );
  registerColumnRange(
    workbook,
    "entryfx_operating_expense_delta",
    "_entry_effects",
    operatingExpenseDeltaColumn,
    lastDataRow
  );
  registerColumnRange(
    workbook,
    "entryfx_profit_distribution_delta",
    "_entry_effects",
    profitDistributionDeltaColumn,
    lastDataRow
  );
  registerColumnRange(
    workbook,
    "entryfx_owner_profit_payout_delta",
    "_entry_effects",
    ownerProfitPayoutDeltaColumn,
    lastDataRow
  );
  registerColumnRange(
    workbook,
    "entryfx_shared_loan_principal_delta",
    "_entry_effects",
    sharedLoanPrincipalDeltaColumn,
    lastDataRow
  );
  registerColumnRange(
    workbook,
    "entryfx_estimated_profit_delta",
    "_entry_effects",
    estimatedProfitDeltaColumn,
    lastDataRow
  );

  return {
    sheet,
    rowByEntryId,
    columns: {
      projectCashDelta: projectCashDeltaColumn,
      capitalDelta: capitalDeltaColumn,
      operatingIncomeDelta: operatingIncomeDeltaColumn,
      operatingExpenseDelta: operatingExpenseDeltaColumn,
      profitDistributionDelta: profitDistributionDeltaColumn,
      ownerProfitPayoutDelta: ownerProfitPayoutDeltaColumn,
      sharedLoanPrincipalDelta: sharedLoanPrincipalDeltaColumn,
      estimatedProfitDelta: estimatedProfitDeltaColumn,
    },
  };
}

function attachTransactionAuditLinks(
  transactionSheet: TransactionSheetContext,
  entryEffectsSheet: EntryEffectsSheetContext
) {
  for (const [entryId, transactionRow] of transactionSheet.rowByEntryId.entries()) {
    const entryEffectsRow = entryEffectsSheet.rowByEntryId.get(entryId);
    if (!entryEffectsRow) {
      continue;
    }

    const cell = transactionSheet.sheet.getCell(
      `${transactionSheet.columns.auditTrace}${transactionRow}`
    );
    cell.value = createInternalLink(
      "_entry_effects",
      `A${entryEffectsRow}`,
      `_entry_effects row ${entryEffectsRow}`
    );
    setLinkStyle(cell);
  }
}

function buildCalcSheet(
  workbook: ExcelJS.Workbook,
  snapshot: ProjectSnapshot,
  cashClaimView: ProjectCashClaimView,
  _entryEffectsSheet: EntryEffectsSheetContext
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
      formula: `ROUND(SUM(entryfx_project_cash_delta),2)`,
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
      formula: `ROUND(SUM(entryfx_capital_delta),2)`,
      appValue: snapshot.totalCapitalOutstanding,
    },
    {
      key: "estimatedProfitToday",
      label: "Estimated profit if distributed today",
      row: 7,
      formula: `ROUND(SUM(entryfx_estimated_profit_delta),2)`,
      appValue: snapshot.undistributedProfit,
    },
    {
      key: "sharedLoanPrincipalOutstanding",
      label: "Shared loan principal outstanding",
      row: 8,
      formula: `ROUND(SUM(entryfx_shared_loan_principal_delta),2)`,
      appValue: snapshot.sharedLoanPrincipalOutstanding,
    },
    {
      key: "projectOperatingIncome",
      label: "Project operating income",
      row: 9,
      formula: `ROUND(SUM(entryfx_operating_income_delta),2)`,
      appValue: snapshot.projectOperatingIncome,
    },
    {
      key: "projectOperatingExpense",
      label: "Project operating expense",
      row: 10,
      formula: `ROUND(SUM(entryfx_operating_expense_delta),2)`,
      appValue: snapshot.projectOperatingExpense,
    },
    {
      key: "sharedLoanInterestPaid",
      label: "Shared loan interest paid",
      row: 11,
      formula:
        `ROUND(SUMIFS(tx_amount,tx_status,\"posted\",tx_entry_type,\"shared_loan_interest_payment\"),2)`,
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
      calcLabelCell: `A${metric.row}`,
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

  sheet.getCell("A17").value = "Per-member cash-claim audit model";
  sheet.mergeCells("A17:X17");
  setSectionStyle(sheet.getRow(17));

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
        `SUMIFS(tx_amount,tx_status,\"posted\",tx_cash_in_member_id,$B${excelRow})` +
        `-SUMIFS(tx_amount,tx_status,\"posted\",tx_cash_out_member_id,$B${excelRow})` +
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
        `SUMIFS(alloc_amount,alloc_entry_status,\"posted\",alloc_entry_type,\"capital_contribution\",alloc_member_id,$B${excelRow},alloc_allocation_type,\"capital_owner\")` +
        `-SUMIFS(alloc_amount,alloc_entry_status,\"posted\",alloc_entry_type,\"capital_return\",alloc_member_id,$B${excelRow},alloc_allocation_type,\"capital_owner\")` +
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
  cashClaimView: ProjectCashClaimView,
  entryEffectsSheet: EntryEffectsSheetContext
) {
  const capitalWeightById = new Map(
    snapshot.capitalWeights.map((row) => [row.projectMemberId, row.weight])
  );
  const claimRowById = cashClaimView.rowsByProjectMemberId;
  const memberSummaryById = new Map(
    snapshot.memberSummaries.map((summary) => [summary.projectMember.id, summary])
  );
  const entryEffectsSheetName = entryEffectsSheet.sheet.name;
  const parityGuideAnchorRow = 23 + refs.memberRows.length * 2;
  const metricRows = [
    {
      key: "totalProjectCash" as const,
      label: "Money in the project now",
      ref: refs.metrics.totalProjectCash,
      result: snapshot.totalProjectCash,
      traceSheet: entryEffectsSheetName,
      traceCell: "A1",
      traceLabel: "See cash deltas",
    },
    {
      key: "membersHoldingProjectCashTotal" as const,
      label: "Members holding project money",
      ref: refs.metrics.membersHoldingProjectCashTotal,
      result: snapshot.membersHoldingProjectCashTotal,
      traceSheet: "_calc",
      traceCell: refs.metrics.membersHoldingProjectCashTotal.calcLabelCell,
      traceLabel: "See positive cash rows",
    },
    {
      key: "frontedByMembersTotal" as const,
      label: "Members fronting their own money",
      ref: refs.metrics.frontedByMembersTotal,
      result: snapshot.frontedByMembersTotal,
      traceSheet: "_calc",
      traceCell: refs.metrics.frontedByMembersTotal.calcLabelCell,
      traceLabel: "See fronted cash rows",
    },
    {
      key: "totalCapitalOutstanding" as const,
      label: "Capital invested",
      ref: refs.metrics.totalCapitalOutstanding,
      result: snapshot.totalCapitalOutstanding,
      traceSheet: entryEffectsSheetName,
      traceCell: "A1",
      traceLabel: "See capital deltas",
    },
    {
      key: "estimatedProfitToday" as const,
      label: "Estimated profit if distributed today",
      ref: refs.metrics.estimatedProfitToday,
      result: snapshot.undistributedProfit,
      traceSheet: entryEffectsSheetName,
      traceCell: "A1",
      traceLabel: "See profit deltas",
    },
    {
      key: "sharedLoanPrincipalOutstanding" as const,
      label: "Shared loan principal outstanding",
      ref: refs.metrics.sharedLoanPrincipalOutstanding,
      result: snapshot.sharedLoanPrincipalOutstanding,
      traceSheet: entryEffectsSheetName,
      traceCell: "A1",
      traceLabel: "See loan principal deltas",
    },
    {
      key: "projectOperatingIncome" as const,
      label: "Project operating income",
      ref: refs.metrics.projectOperatingIncome,
      result: snapshot.projectOperatingIncome,
      traceSheet: entryEffectsSheetName,
      traceCell: "A1",
      traceLabel: "See income deltas",
    },
    {
      key: "projectOperatingExpense" as const,
      label: "Project operating expense",
      ref: refs.metrics.projectOperatingExpense,
      result: snapshot.projectOperatingExpense,
      traceSheet: entryEffectsSheetName,
      traceCell: "A1",
      traceLabel: "See expense deltas",
    },
  ];
  const guideRows = [
    {
      step: "1",
      what: "Read raw transaction rows",
      goTo: createInternalLink("Transactions", "A1", "Transactions!A1"),
      why: "One row per ledger entry. Voided rows stay visible, but only posted rows feed formulas.",
    },
    {
      step: "2",
      what: "Inspect normalized entry effects",
      goTo: createInternalLink(
        entryEffectsSheetName,
        "A1",
        `${entryEffectsSheetName}!A1`
      ),
      why: "Each transaction is converted into cash, capital, profit, and loan deltas so dashboard math is traceable row by row.",
    },
    {
      step: "3",
      what: "Check ownership allocations",
      goTo: createInternalLink("_allocations", "A1", "_allocations!A1"),
      why: "Capital owners, expense shares, and profit-share lines explain who carries each amount.",
    },
    {
      step: "4",
      what: "Inspect member claim math",
      goTo: createInternalLink("_calc", "A17", "_calc!A17"),
      why: "This is the helper model behind project cash held, capital, reserve allocation, and claim balances.",
    },
    {
      step: "5",
      what: "Use parity deltas below",
      goTo: createInternalLink(
        "Dashboard",
        `A${parityGuideAnchorRow}`,
        "Dashboard parity block"
      ),
      why: "Every delta should stay at 0. Any non-zero cell means the workbook drifted from the exported web snapshot.",
    },
  ];
  const metricDeltaCells: Array<{ cell: string; value: number }> = [];
  const memberParityDeltaCells: Array<{ cell: string; value: number }> = [];

  sheet.views = [{ state: "frozen", ySplit: 5 }];
  sheet.getCell("A1").value = `${snapshot.dataset.project.name} audit export`;
  sheet.getCell("A1").font = { bold: true, size: 16 };
  sheet.getCell("A2").value =
    "Workbook formulas mirror the exported audit math. Unhide helper sheets if you need to trace the formula chain from raw rows to normalized entry effects and final member claims.";
  sheet.mergeCells("A2:I2");

  sheet.getCell("A4").value = "Core audit metrics";
  setSectionStyle(sheet.getRow(4));
  sheet.mergeCells("A4:E4");
  sheet.getCell("A5").value = "Metric";
  sheet.getCell("B5").value = "Workbook formula";
  sheet.getCell("C5").value = "Web snapshot";
  sheet.getCell("D5").value = "Delta";
  sheet.getCell("E5").value = "Audit trace";
  setHeaderStyle(sheet.getRow(5));

  for (const [index, metric] of metricRows.entries()) {
    const row = 6 + index;
    sheet.getCell(`A${row}`).value = createInternalLink(
      "_calc",
      refs.metrics[metric.key].calcLabelCell,
      metric.label
    );
    setLinkStyle(sheet.getCell(`A${row}`));
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
    sheet.getCell(`E${row}`).value = createInternalLink(
      metric.traceSheet,
      metric.traceCell,
      metric.traceLabel
    );
    setLinkStyle(sheet.getCell(`E${row}`));

    sheet.getCell(`B${row}`).numFmt = MONEY_FORMAT;
    sheet.getCell(`C${row}`).numFmt = MONEY_FORMAT;
    sheet.getCell(`D${row}`).numFmt = MONEY_FORMAT;
    metricDeltaCells.push({ cell: `D${row}`, value: 0 });
  }

  sheet.getCell("F4").value = "How to audit this workbook";
  setSectionStyle(sheet.getRow(4));
  sheet.mergeCells("F4:I4");
  sheet.getCell("F5").value = "Step";
  sheet.getCell("G5").value = "What to inspect";
  sheet.getCell("H5").value = "Go to";
  sheet.getCell("I5").value = "Why it matters";
  setHeaderStyle(sheet.getRow(5));

  for (const [index, guideRow] of guideRows.entries()) {
    const row = 6 + index;
    sheet.getCell(`F${row}`).value = guideRow.step;
    sheet.getCell(`G${row}`).value = guideRow.what;
    sheet.getCell(`H${row}`).value = guideRow.goTo;
    setLinkStyle(sheet.getCell(`H${row}`));
    sheet.getCell(`I${row}`).value = guideRow.why;
    sheet.getCell(`F${row}`).alignment = { horizontal: "center" };
    sheet.getCell(`I${row}`).alignment = { wrapText: true, vertical: "top" };
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
    const summary = memberSummaryById.get(member.projectMemberId);
    const claimRow = claimRowById.get(member.projectMemberId);

    sheet.getCell(`A${row}`).value = createInternalLink(
      "_calc",
      `A${member.row}`,
      member.displayName
    );
    setLinkStyle(sheet.getCell(`A${row}`));
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
    const summary = memberSummaryById.get(member.projectMemberId);

    sheet.getCell(`A${row}`).value = createInternalLink(
      "_calc",
      `A${member.row}`,
      member.displayName
    );
    setLinkStyle(sheet.getCell(`A${row}`));
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

  const parityHeaderRow = capitalStartRow + refs.memberRows.length + 3;
  const parityStartRow = parityHeaderRow + 1;
  const parityEndRow = parityStartRow + refs.memberRows.length - 1;

  sheet.getCell(`A${parityHeaderRow - 1}`).value = "Member parity checks";
  setSectionStyle(sheet.getRow(parityHeaderRow - 1));
  sheet.mergeCells(`A${parityHeaderRow - 1}:F${parityHeaderRow - 1}`);
  sheet.getCell(`A${parityHeaderRow}`).value = "Member";
  sheet.getCell(`B${parityHeaderRow}`).value = "Project money delta";
  sheet.getCell(`C${parityHeaderRow}`).value = "Capital delta";
  sheet.getCell(`D${parityHeaderRow}`).value = "Profit delta";
  sheet.getCell(`E${parityHeaderRow}`).value = "Team owes delta";
  sheet.getCell(`F${parityHeaderRow}`).value = "You owe delta";
  setHeaderStyle(sheet.getRow(parityHeaderRow));

  for (const [index, member] of refs.memberRows.entries()) {
    const row = parityStartRow + index;

    sheet.getCell(`A${row}`).value = createInternalLink(
      "_calc",
      `A${member.row}`,
      member.displayName
    );
    setLinkStyle(sheet.getCell(`A${row}`));
    sheet.getCell(`B${row}`).value = {
      formula: `ROUND(_calc!D${member.row}-_calc!S${member.row},2)`,
      result: 0,
    };
    sheet.getCell(`C${row}`).value = {
      formula: `ROUND(_calc!G${member.row}-_calc!U${member.row},2)`,
      result: 0,
    };
    sheet.getCell(`D${row}`).value = {
      formula: `ROUND(_calc!H${member.row}-_calc!V${member.row},2)`,
      result: 0,
    };
    sheet.getCell(`E${row}`).value = {
      formula: `ROUND(_calc!P${member.row}-_calc!W${member.row},2)`,
      result: 0,
    };
    sheet.getCell(`F${row}`).value = {
      formula: `ROUND(_calc!Q${member.row}-_calc!X${member.row},2)`,
      result: 0,
    };

    for (const column of ["B", "C", "D", "E", "F"]) {
      sheet.getCell(`${column}${row}`).numFmt = MONEY_FORMAT;
      memberParityDeltaCells.push({ cell: `${column}${row}`, value: 0 });
    }
  }

  const parityNoteRow = parityEndRow + 2;
  sheet.getCell(`A${parityNoteRow}`).value =
    "Audit note: every delta block in this sheet should stay at 0. If a delta drifts, unhide _calc and trace the linked member row or metric source.";
  sheet.mergeCells(`A${parityNoteRow}:F${parityNoteRow}`);
  sheet.getCell(`A${parityNoteRow}`).alignment = { wrapText: true };
  sheet.getCell(`A${parityNoteRow}`).fill = SECTION_FILL;

  sheet.columns = [
    { key: "A", width: 28 },
    { key: "B", width: 18 },
    { key: "C", width: 18 },
    { key: "D", width: 18 },
    { key: "E", width: 18 },
    { key: "F", width: 18 },
    { key: "G", width: 22 },
    { key: "H", width: 22 },
    { key: "I", width: 38 },
  ];
  sheet.getCell("F1").value = `Currency: ${snapshot.dataset.project.currencyCode}`;
  sheet.getCell("F1").alignment = { horizontal: "right" };

  addZeroDeltaFormatting(
    sheet,
    `D6:D${5 + metricRows.length}`,
    metricDeltaCells
  );
  addZeroDeltaFormatting(
    sheet,
    `B${parityStartRow}:F${parityEndRow}`,
    memberParityDeltaCells
  );
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
  const entryEffectsSheet = buildEntryEffectsSheet(
    workbook,
    dataset,
    snapshot,
    transactionSheet
  );
  attachTransactionAuditLinks(transactionSheet, entryEffectsSheet);
  const calcRefs = buildCalcSheet(
    workbook,
    snapshot,
    cashClaimView,
    entryEffectsSheet
  );
  buildDashboardSheet(
    dashboardSheet,
    snapshot,
    calcRefs,
    cashClaimView,
    entryEffectsSheet
  );

  return {
    workbook,
    fileName: createProjectAuditFileName(dataset.project.slug, generatedAt),
  };
}
