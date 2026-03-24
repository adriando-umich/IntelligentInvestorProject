import "server-only";

import fs from "node:fs";
import path from "node:path";

import React from "react";
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { format } from "date-fns";

import {
  getEntryTypeLabel,
  type LedgerAllocation,
  type LedgerEntry,
  type MemberStatementSnapshot,
  type ProjectDataset,
  type ProjectSnapshot,
} from "@/lib/finance/types";
import {
  formatCurrency as formatAppCurrency,
  formatDateLabel,
  formatSignedCurrency as formatAppSignedCurrency,
  roundMoney,
} from "@/lib/format";
import { buildProjectCashClaimView } from "@/lib/finance/project-cash-claims";
import {
  defaultAppLocale,
  getIntlLocale,
  type AppLocale,
} from "@/lib/i18n/config";

const PDF_FONT_FAMILY = "ProjectCurrentPdf";
let fontRegistered = false;

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 36,
    paddingHorizontal: 30,
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 9,
    color: "#0f172a",
    lineHeight: 1.45,
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#dbe7e3",
    paddingBottom: 12,
  },
  eyebrow: {
    fontSize: 8,
    color: "#0f766e",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1.15,
    marginBottom: 8,
  },
  subtitle: {
    color: "#475569",
    marginBottom: 0,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 10,
  },
  metaStack: {
    flexDirection: "column",
    gap: 3,
    flexGrow: 1,
  },
  metaRight: {
    maxWidth: "38%",
    alignItems: "flex-end",
  },
  metaText: {
    color: "#64748b",
    lineHeight: 1.35,
  },
  emailText: {
    color: "#475569",
    textAlign: "right",
    lineHeight: 1.35,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    width: "31.5%",
    minHeight: 72,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  metricLabel: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 4,
  },
  metricHint: {
    fontSize: 8,
    color: "#64748b",
  },
  section: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 2,
  },
  sectionDescription: {
    color: "#64748b",
    marginBottom: 8,
  },
  table: {
    borderWidth: 1,
    borderColor: "#dbe7e3",
    borderRadius: 10,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#eef6f4",
    borderBottomWidth: 1,
    borderBottomColor: "#dbe7e3",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#edf2f7",
  },
  lastTableRow: {
    borderBottomWidth: 0,
  },
  tableHeaderCell: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    fontSize: 8,
    fontWeight: 700,
    color: "#0f172a",
  },
  tableCell: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    fontSize: 8.5,
    color: "#0f172a",
  },
  amountCell: {
    textAlign: "right",
  },
  emptyState: {
    borderWidth: 1,
    borderColor: "#dbe7e3",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: "#64748b",
  },
  noteBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#dbe7e3",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  noteTitle: {
    fontWeight: 700,
    marginBottom: 4,
  },
  breakdownBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#dbe7e3",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  breakdownIntro: {
    color: "#64748b",
    marginBottom: 8,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 3,
  },
  breakdownLabel: {
    flex: 1,
    color: "#475569",
  },
  breakdownValue: {
    width: 160,
    textAlign: "right",
    color: "#0f172a",
  },
  breakdownTotalRow: {
    borderTopWidth: 1,
    borderTopColor: "#dbe7e3",
    marginTop: 6,
    paddingTop: 7,
  },
  breakdownTotalLabel: {
    flex: 1,
    fontWeight: 700,
    color: "#0f172a",
  },
  breakdownTotalValue: {
    width: 160,
    textAlign: "right",
    fontWeight: 700,
    color: "#0f172a",
  },
  sectionSummary: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#dbe7e3",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sectionSummaryLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#64748b",
    marginBottom: 3,
  },
  sectionSummaryValue: {
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 3,
  },
  sectionSummaryHint: {
    color: "#64748b",
  },
  tableDetailStack: {
    flexDirection: "column",
    gap: 4,
  },
  tablePrimaryText: {
    fontSize: 8.5,
    color: "#0f172a",
    lineHeight: 1.35,
  },
  tableSecondaryText: {
    fontSize: 8,
    color: "#64748b",
    lineHeight: 1.4,
  },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 30,
    right: 30,
    fontSize: 8,
    color: "#94a3b8",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

type MemberStatementPdfInput = {
  statement: MemberStatementSnapshot;
  dataset: ProjectDataset;
  snapshot: ProjectSnapshot;
  locale?: AppLocale;
  generatedAt?: Date;
};

type StatementLine = {
  date: string;
  type: string;
  description: string;
  amount: number;
  amountText: string;
  secondary?: string;
  tertiary?: string;
};

function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

function formatCurrency(
  amount: number,
  currencyCode: string,
  locale: AppLocale
) {
  return formatAppCurrency(Math.round(amount), currencyCode, locale);
}

function formatSignedCurrency(
  amount: number,
  currencyCode: string,
  locale: AppLocale
) {
  return formatAppSignedCurrency(Math.round(amount), currencyCode, locale);
}

function formatPercent(decimal: number, locale: AppLocale) {
  return new Intl.NumberFormat(getIntlLocale(locale), {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(decimal);
}

function ensurePdfFont() {
  if (fontRegistered) {
    return;
  }

  const regularPath = path.join(
    process.cwd(),
    "node_modules",
    "@fontsource",
    "noto-sans",
    "files",
    "noto-sans-vietnamese-400-normal.woff"
  );
  const boldPath = path.join(
    process.cwd(),
    "node_modules",
    "@fontsource",
    "noto-sans",
    "files",
    "noto-sans-vietnamese-700-normal.woff"
  );

  if (fs.existsSync(regularPath) && fs.existsSync(boldPath)) {
    Font.register({
      family: PDF_FONT_FAMILY,
      fonts: [
        { src: regularPath, fontWeight: 400 },
        { src: boldPath, fontWeight: 700 },
      ],
    });
  } else {
    Font.register({ family: PDF_FONT_FAMILY, src: "Helvetica" });
  }

  fontRegistered = true;
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

export function createMemberStatementPdfFileName(
  projectSlug: string,
  memberName: string,
  generatedAt = new Date()
) {
  const project = sanitizeFileSegment(projectSlug) || "project";
  const member = sanitizeFileSegment(memberName) || "member";
  return `${project}-${member}-statement-${toFileNameTimestamp(generatedAt)}.pdf`;
}

function buildMemberRefs(statement: MemberStatementSnapshot) {
  return new Set([
    statement.summary.projectMember.id,
    statement.summary.projectMember.userId,
  ]);
}

function buildProfileNames(statement: MemberStatementSnapshot) {
  return new Map(
    statement.memberDirectory.flatMap((item) => [
      [item.projectMemberId, item.displayName] as const,
      [item.userId, item.displayName] as const,
    ])
  );
}

function getAllocationForMember(
  entryId: string,
  allocations: LedgerAllocation[],
  projectMemberId: string,
  allocationType: LedgerAllocation["allocationType"]
) {
  return allocations.find(
    (allocation) =>
      allocation.ledgerEntryId === entryId &&
      allocation.projectMemberId === projectMemberId &&
      allocation.allocationType === allocationType
  );
}

function buildCapitalRows(
  statement: MemberStatementSnapshot,
  dataset: ProjectDataset,
  locale: AppLocale
): StatementLine[] {
  return statement.relatedEntries
    .filter(
      (entry) =>
        entry.entryType === "capital_contribution" ||
        entry.entryType === "capital_return"
    )
    .map((entry) => {
      const allocation = getAllocationForMember(
        entry.id,
        dataset.allocations,
        statement.summary.projectMember.id,
        "capital_owner"
      );

      if (!allocation) {
        return null;
      }

      return {
        date: formatDateLabel(entry.effectiveAt, locale),
        type: getEntryTypeLabel(entry.entryType, locale),
        description: entry.description,
        amount: allocation.amount,
        amountText: formatCurrency(
          allocation.amount,
          entry.currencyCode,
          locale
        ),
        secondary:
          entry.entryType === "capital_contribution"
            ? locale === "vi"
              ? "Tăng vốn góp"
              : "Adds invested capital"
            : locale === "vi"
              ? "Giảm vốn góp"
              : "Returns invested capital",
      };
    })
    .filter(isDefined);
}

function buildExpenseRows(
  statement: MemberStatementSnapshot,
  dataset: ProjectDataset,
  locale: AppLocale
): StatementLine[] {
  const profileNames = buildProfileNames(statement);

  return statement.relatedEntries
    .filter(
      (entry) =>
        entry.entryType === "operating_expense" ||
        entry.entryType === "shared_loan_interest_payment"
    )
    .map((entry) => {
      const allocation = getAllocationForMember(
        entry.id,
        dataset.allocations,
        statement.summary.projectMember.id,
        "expense_share"
      );

      if (!allocation) {
        return null;
      }

      const payerName = entry.cashOutMemberId
        ? profileNames.get(entry.cashOutMemberId) ?? entry.cashOutMemberId
        : locale === "vi"
          ? "Không có người chi"
          : "No payer selected";
      const sharePercent =
        allocation.weightPercent == null
          ? ""
          : locale === "vi"
            ? `Tỷ lệ ${allocation.weightPercent.toFixed(2)}%`
            : `Share ${allocation.weightPercent.toFixed(2)}%`;

      return {
        date: formatDateLabel(entry.effectiveAt, locale),
        type: getEntryTypeLabel(entry.entryType, locale),
        description: entry.description,
        amount: allocation.amount,
        amountText: formatCurrency(
          allocation.amount,
          entry.currencyCode,
          locale
        ),
        secondary:
          locale === "vi"
            ? `Người trả: ${payerName}`
            : `Paid by: ${payerName}`,
        tertiary: sharePercent || undefined,
      };
    })
    .filter(isDefined);
}

function buildCashRows(
  statement: MemberStatementSnapshot,
  locale: AppLocale
) {
  const profileNames = buildProfileNames(statement);
  const memberRefs = buildMemberRefs(statement);

  return statement.relatedEntries
    .filter(
      (entry) =>
        (entry.cashInMemberId && memberRefs.has(entry.cashInMemberId)) ||
        (entry.cashOutMemberId && memberRefs.has(entry.cashOutMemberId))
    )
    .map((entry) => {
      const received = entry.cashInMemberId && memberRefs.has(entry.cashInMemberId);
      const paid = entry.cashOutMemberId && memberRefs.has(entry.cashOutMemberId);
      const signedAmount =
        received && !paid
          ? entry.amount
          : paid && !received
            ? -entry.amount
            : 0;

      const counterparty = received
        ? entry.cashOutMemberId
          ? profileNames.get(entry.cashOutMemberId) ?? entry.cashOutMemberId
          : locale === "vi"
            ? "Nguồn ngoài dự án"
            : "External source"
        : entry.cashInMemberId
          ? profileNames.get(entry.cashInMemberId) ?? entry.cashInMemberId
          : locale === "vi"
            ? "Ra ngoài dự án"
            : "External destination";

      return {
        date: formatDateLabel(entry.effectiveAt, locale),
        type: getEntryTypeLabel(entry.entryType, locale),
        description: entry.description,
        amount: signedAmount,
        amountText: formatSignedCurrency(
          signedAmount,
          entry.currencyCode,
          locale
        ),
        secondary: received
          ? locale === "vi"
            ? `Tiền vào từ: ${counterparty}`
            : `Money in from: ${counterparty}`
          : locale === "vi"
            ? `Tiền ra cho: ${counterparty}`
            : `Money out to: ${counterparty}`,
      };
    });
}

function buildProfitRows(
  statement: MemberStatementSnapshot,
  dataset: ProjectDataset,
  locale: AppLocale
): StatementLine[] {
  return statement.relatedEntries
    .filter(
      (entry) =>
        entry.entryType === "profit_distribution" ||
        entry.entryType === "owner_profit_payout"
    )
    .map((entry) => {
      const allocation = getAllocationForMember(
        entry.id,
        dataset.allocations,
        statement.summary.projectMember.id,
        "profit_share"
      );

      if (!allocation) {
        return null;
      }

      return {
        date: formatDateLabel(entry.effectiveAt, locale),
        type: getEntryTypeLabel(entry.entryType, locale),
        description: entry.description,
        amount: allocation.amount,
        amountText: formatCurrency(
          allocation.amount,
          entry.currencyCode,
          locale
        ),
        secondary:
          entry.entryType === "owner_profit_payout"
            ? locale === "vi"
              ? "Khoản trả lãi riêng cho owner"
              : "Owner-specific profit payout"
            : locale === "vi"
              ? "Khoản chia lợi nhuận chung"
              : "Project-wide profit distribution",
      };
    })
    .filter(isDefined);
}

function buildAppendixRows(
  statement: MemberStatementSnapshot,
  locale: AppLocale
) {
  const profileNames = buildProfileNames(statement);

  return statement.relatedEntries.map((entry) => ({
    date: formatDateLabel(entry.effectiveAt, locale),
    type: getEntryTypeLabel(entry.entryType, locale),
    description: entry.description,
    amount: entry.amount,
    amountText: formatCurrency(entry.amount, entry.currencyCode, locale),
    secondary: [
      entry.cashInMemberId
        ? `${
            locale === "vi" ? "Vào" : "In"
          }: ${profileNames.get(entry.cashInMemberId) ?? entry.cashInMemberId}`
        : null,
      entry.cashOutMemberId
        ? `${
            locale === "vi" ? "Ra" : "Out"
          }: ${profileNames.get(entry.cashOutMemberId) ?? entry.cashOutMemberId}`
        : null,
    ]
      .filter(Boolean)
      .join(" • "),
    tertiary: entry.note ?? undefined,
  }));
}

function SummaryMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricHint}>{hint}</Text>
    </View>
  );
}

function SectionSummary({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <View style={styles.sectionSummary}>
      <Text style={styles.sectionSummaryLabel}>{label}</Text>
      <Text style={styles.sectionSummaryValue}>{value}</Text>
      <Text style={styles.sectionSummaryHint}>{hint}</Text>
    </View>
  );
}

function StatementTable({
  headers,
  rows,
  emptyLabel,
  widths,
}: {
  headers: string[];
  rows: StatementLine[];
  emptyLabel: string;
  widths: number[];
}) {
  if (rows.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        {headers.map((header, index) => (
          <View key={header} style={{ width: `${widths[index]}%` }}>
            <Text style={styles.tableHeaderCell}>{header}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, index) => {
        const isLast = index === rows.length - 1;
        return (
          <View
            key={`${row.date}-${row.type}-${row.description}-${index}`}
            style={isLast ? [styles.tableRow, styles.lastTableRow] : styles.tableRow}
          >
            <View style={{ width: `${widths[0]}%` }}>
              <Text style={styles.tableCell}>{row.date}</Text>
            </View>
            <View style={{ width: `${widths[1]}%` }}>
              <Text style={styles.tableCell}>{row.type}</Text>
            </View>
            <View style={{ width: `${widths[2]}%` }}>
              <View style={styles.tableDetailStack}>
                <Text style={styles.tablePrimaryText}>{row.description}</Text>
                {row.secondary ? (
                  <Text style={styles.tableSecondaryText}>{row.secondary}</Text>
                ) : null}
                {row.tertiary ? (
                  <Text style={styles.tableSecondaryText}>{row.tertiary}</Text>
                ) : null}
              </View>
            </View>
            <View style={{ width: `${widths[3]}%` }}>
              <Text style={[styles.tableCell, styles.amountCell]}>{row.amountText}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function MemberStatementDocument({
  statement,
  snapshot,
  dataset,
  locale,
  generatedAt,
}: Required<MemberStatementPdfInput>) {
  const capitalWeight =
    snapshot.capitalWeights.find(
      (row) => row.projectMemberId === statement.summary.projectMember.id
    )?.weight ?? 0;
  const capitalRows = buildCapitalRows(statement, dataset, locale);
  const expenseRows = buildExpenseRows(statement, dataset, locale);
  const cashRows = buildCashRows(statement, locale);
  const profitRows = buildProfitRows(statement, dataset, locale);
  const appendixRows = buildAppendixRows(statement, locale);
  const projectCashClaims = buildProjectCashClaimView(snapshot);
  const claimRow =
    projectCashClaims.rowsByProjectMemberId.get(statement.summary.projectMember.id) ??
    null;
  const totalAllocatedCost = roundMoney(
    expenseRows.reduce((sum, row) => sum + row.amount, 0)
  );
  const openProfitStillSharedByCapital = roundMoney(
    snapshot.memberSummaries.reduce(
      (sum, summary) =>
        sum + (summary.estimatedProfitShare - summary.accruedProfitBalance),
      0
    )
  );
  const capitalWeightedProfitPreview = roundMoney(
    statement.summary.estimatedProfitShare - statement.summary.accruedProfitBalance
  );
  const currentPayableAmount = roundMoney(claimRow?.teamOwesYou ?? 0);
  const memberHoldingAboveClaim = roundMoney(claimRow?.youOweTeam ?? 0);

  const copy =
    locale === "vi"
      ? {
          eyebrow: "Statement thành viên",
          generatedAt: "Xuất lúc",
          project: "Dự án",
          summary: [
            {
              label: "Vốn đang góp",
              value: formatCurrency(
                statement.summary.capitalBalance,
                statement.project.currencyCode,
                locale
              ),
              hint: "Phần vốn gốc vẫn còn nằm trong dự án.",
            },
            {
              label: "Tỷ lệ góp vốn",
              value: formatPercent(capitalWeight, locale),
              hint: "Tỷ lệ dùng để preview phần lợi nhuận hôm nay.",
            },
            {
              label: "Lợi nhuận ước tính",
              value: formatCurrency(
                statement.summary.estimatedProfitShare,
                statement.project.currencyCode,
                locale
              ),
              hint: "Phần lợi nhuận hiện tại mà thành viên này đang có quyền hưởng.",
            },
            {
              label: "Tiền dự án đang giữ",
              value: formatSignedCurrency(
                statement.summary.projectCashCustody,
                statement.project.currencyCode,
                locale
              ),
              hint: "Số dương nghĩa là tiền dự án đang nằm ở thành viên này.",
            },
            {
              label: "Team đang nợ bạn",
              value: formatCurrency(
                statement.summary.teamOwesYou,
                statement.project.currencyCode,
                locale
              ),
              hint: "Chỉ phản ánh các khoản hoàn trả chi phí chung.",
            },
            {
              label: "Bạn nợ team",
              value: formatCurrency(
                statement.summary.youOweTeam,
                statement.project.currencyCode,
                locale
              ),
              hint: "Phần nghĩa vụ hoàn lại cho team do chi phí chung.",
            },
          ],
          capitalTitle: "Chi tiết vốn góp và hoàn vốn",
          capitalDescription:
            "Các transaction làm thay đổi capital balance của thành viên này.",
          expenseTitle: "Chi phí được phân bổ cho thành viên này",
          expenseDescription:
            "Bao gồm operating expense và shared loan interest được chia cho member này.",
          cashTitle: "Dòng tiền liên quan đến thành viên này",
          cashDescription:
            "Các transaction mà thành viên này trực tiếp nhận hoặc chi project cash.",
          profitTitle: "Lợi nhuận liên quan đến thành viên này",
          profitDescription:
            "Các khoản lợi nhuận đã phân phối hoặc trả riêng cho member này.",
          appendixTitle: "Appendix giao dịch liên quan",
          appendixDescription:
            "Danh sách đầy đủ các posted entries mà member này là payer, receiver hoặc nằm trong allocation.",
          reconciliationTitle: "Đối chiếu đang mở",
          reconciliationNote: statement.openReconciliationCheck
            ? `Expected project cash: ${formatSignedCurrency(
                statement.openReconciliationCheck.check.expectedProjectCash,
                statement.project.currencyCode,
                locale
              )}`
            : "Không có đợt đối chiếu đang mở cho member này.",
          emptyCapital: "Chưa có transaction vốn góp hoặc hoàn vốn nào cho member này.",
          emptyExpense: "Chưa có chi phí phân bổ nào cho member này.",
          emptyCash: "Chưa có transaction cash in / cash out nào trực tiếp qua member này.",
          emptyProfit: "Chưa có transaction profit payout nào cho member này.",
          emptyAppendix: "Chưa có giao dịch liên quan nào.",
          noteTitle: "Audit note",
          noteBody:
            "Statement này dùng cùng snapshot với web app. Team owes you / You owe team chỉ phản ánh shared-expense reimbursement, không phải toàn bộ claim capital + profit.",
          headers: {
            date: "Ngày",
            type: "Loại",
            detail: "Chi tiết",
            amount: "Số tiền",
          },
        }
      : {
          eyebrow: "Member statement",
          generatedAt: "Generated",
          project: "Project",
          summary: [
            {
              label: "Capital invested",
              value: formatCurrency(
                statement.summary.capitalBalance,
                statement.project.currencyCode,
                locale
              ),
              hint: "The member's capital still sitting inside the project.",
            },
            {
              label: "Profit weight",
              value: formatPercent(capitalWeight, locale),
              hint: "Current capital-based weight used for profit preview.",
            },
            {
              label: "Estimated profit today",
              value: formatCurrency(
                statement.summary.estimatedProfitShare,
                statement.project.currencyCode,
                locale
              ),
              hint: "The member's current undistributed profit position.",
            },
            {
              label: "Project money held",
              value: formatSignedCurrency(
                statement.summary.projectCashCustody,
                statement.project.currencyCode,
                locale
              ),
              hint: "Positive means project cash is currently sitting with this member.",
            },
            {
              label: "Team owes you",
              value: formatCurrency(
                statement.summary.teamOwesYou,
                statement.project.currencyCode,
                locale
              ),
              hint: "Only shared-expense reimbursement owed back to this member.",
            },
            {
              label: "You owe team",
              value: formatCurrency(
                statement.summary.youOweTeam,
                statement.project.currencyCode,
                locale
              ),
              hint: "Shared-expense reimbursement this member still owes back.",
            },
          ],
          capitalTitle: "Capital contributions and returns",
          capitalDescription:
            "Transactions that directly changed this member's capital balance.",
          expenseTitle: "Costs allocated to this member",
          expenseDescription:
            "Operating expenses and shared loan interest assigned to this member.",
          expenseTotalLabel: "Total cost allocated",
          expenseTotalHint:
            "This is the full cost already assigned to this member below. It flows into the member's operating P&L share and reduces the final profit position.",
          cashTitle: "Cash movements touching this member",
          cashDescription:
            "Transactions where this member directly received or paid project cash.",
          profitTitle: "Profit activity for this member",
          profitDescription:
            "Profit distributions or owner-specific payouts received by this member.",
          claimTitle: "How much the project should pay this member now",
          claimIntro:
            "This separates capital still invested, estimated profit today, and shared-expense reimbursement, then shows how much project cash is already sitting with this member.",
          claimCapital: "Capital still invested",
          claimProfit: "Estimated profit today",
          claimReimbursement: "Shared-expense reimbursement balance",
          claimCashHeld: "Project cash already sitting with this member",
          claimReserve: "Reserve cash still kept inside the project",
          claimPayable: "Project should pay now",
          claimHeldAbove: "Member is already holding above today's claim",
          claimHint:
            "When the final amount is zero, this member's current claim is already sitting inside project cash they are holding.",
          profitFormulaTitle: "How estimated profit today is calculated",
          profitFormulaIntro:
            "Current profit preview = profit already reserved for this member plus the member's capital-weighted share of the project profit pool that is still open today.",
          profitOpenPool: "Project profit still open for capital-based sharing",
          profitWeightLabel: "Current capital weight",
          profitWeightedShare: "Current capital-weighted profit preview",
          profitAccrued: "Profit already reserved to this member",
          profitEstimated: "Estimated profit today",
          profitFormulaHint:
            "This is not the same as cash already paid out. It is the member's current profit position today.",
          appendixTitle: "Related transaction appendix",
          appendixDescription:
            "All posted entries where this member was a payer, receiver, or part of an allocation.",
          reconciliationTitle: "Open reconciliation",
          reconciliationNote: statement.openReconciliationCheck
            ? `Expected project cash: ${formatSignedCurrency(
                statement.openReconciliationCheck.check.expectedProjectCash,
                statement.project.currencyCode,
                locale
              )}`
            : "No open reconciliation item for this member right now.",
          emptyCapital: "No capital contribution or return entries for this member.",
          emptyExpense: "No allocated cost rows for this member.",
          emptyCash: "No direct money-in or money-out rows for this member.",
          emptyProfit: "No profit payout rows for this member.",
          emptyAppendix: "No related transactions found.",
          noteTitle: "Audit note",
          noteBody:
            "This PDF uses the same member statement snapshot as the web app. Team owes you / You owe team only cover shared-expense reimbursement, not the full capital-plus-profit claim.",
          headers: {
            date: "Date",
            type: "Type",
            detail: "Detail",
            amount: "Amount",
          },
        };

  const detailCopy =
    locale === "vi"
      ? {
          expenseTotalLabel: "Tá»•ng chi phÃ­ Ä‘Æ°á»£c phÃ¢n bá»•",
          expenseTotalHint:
            "Tá»•ng cÃ¡c cost rows dÆ°á»›i Ä‘Ã¢y Ä‘Ã£ Ä‘Æ°á»£c gáº¯n cho member nÃ y. Sá»‘ nÃ y Ä‘i vÃ o operating P&L share vÃ  lÃ m giáº£m pháº§n lá»£i nhuáº­n cuá»‘i cÃ¹ng.",
          claimTitle: "Sá»‘ tiá»n dá»± Ã¡n nÃªn tráº£ cho member nÃ y hÃ´m nay",
          claimIntro:
            "Khoáº£n nÃ y tÃ¡ch riÃªng capital cÃ²n trong dá»± Ã¡n, lá»£i nhuáº­n Æ°á»›c tÃ­nh hÃ´m nay, vÃ  cÃ¡c khoáº£n hoÃ n tráº£ chi phÃ­ chung. Sau Ä‘Ã³ trÃ¬nh bÃ y pháº§n project cash Ä‘Ã£ náº±m sáºµn á»Ÿ member nÃ y.",
          claimCapital: "Capital cÃ²n Ä‘ang invest",
          claimProfit: "Estimated profit hÃ´m nay",
          claimReimbursement: "Sá»‘ dÆ° hoÃ n tráº£ chi phÃ­ chung",
          claimCashHeld: "Project cash Ä‘Ã£ náº±m á»Ÿ member nÃ y",
          claimReserve: "Reserve cash táº¡m giá»¯ láº¡i trong project",
          claimPayable: "Project nÃªn tráº£ ngay",
          claimHeldAbove: "Member Ä‘ang giá»¯ nhiá»u hÆ¡n claim hiá»‡n táº¡i",
          claimHint:
            "Náº¿u con sá»‘ cuá»‘i cÃ¹ng lÃ  0, nghÄ©a lÃ  claim hiá»‡n táº¡i Ä‘Ã£ náº±m sáºµn trong project cash member nÃ y Ä‘ang giá»¯.",
          profitFormulaTitle: "Estimated profit hÃ´m nay Ä‘Æ°á»£c tÃ­nh nhÆ° tháº¿ nÃ o",
          profitFormulaIntro:
            "Preview lá»£i nhuáº­n hiá»‡n táº¡i = pháº§n lá»£i nhuáº­n Ä‘Ã£ dÃ nh riÃªng cho member nÃ y + pháº§n chia theo tá»· trá»ng vá»‘n hiá»‡n táº¡i trÃªn pool lá»£i nhuáº­n cÃ²n má»Ÿ.",
          profitOpenPool: "Project profit cÃ²n má»Ÿ Ä‘á»ƒ chia theo vá»‘n",
          profitWeightLabel: "Tá»· trá»ng vá»‘n hiá»‡n táº¡i",
          profitWeightedShare: "Pháº§n preview theo tá»· trá»ng vá»‘n",
          profitAccrued: "Lá»£i nhuáº­n Ä‘Ã£ dÃ nh riÃªng tá»« trÆ°á»›c",
          profitEstimated: "Estimated profit today",
          profitFormulaHint:
            "Khoáº£n nÃ y chÆ°a cháº¯c Ä‘Ã£ tráº£ ra tiá»n máº·t. ÄÃ¢y lÃ  vá»‹ tháº¿ lá»£i nhuáº­n hiá»‡n táº¡i cá»§a member nÃ y.",
        }
      : {
          expenseTotalLabel: "Total cost allocated",
          expenseTotalHint:
            "This is the full cost already assigned to this member below. It flows into the member's operating P&L share and reduces the final profit position.",
          claimTitle: "How much the project should pay this member now",
          claimIntro:
            "This separates capital still invested, estimated profit today, and shared-expense reimbursement, then shows how much project cash is already sitting with this member.",
          claimCapital: "Capital still invested",
          claimProfit: "Estimated profit today",
          claimReimbursement: "Shared-expense reimbursement balance",
          claimCashHeld: "Project cash already sitting with this member",
          claimReserve: "Reserve cash still kept inside the project",
          claimPayable: "Project should pay now",
          claimHeldAbove: "Member is already holding above today's claim",
          claimHint:
            "When the final amount is zero, this member's current claim is already sitting inside project cash they are holding.",
          profitFormulaTitle: "How estimated profit today is calculated",
          profitFormulaIntro:
            "Current profit preview = profit already reserved for this member plus the member's capital-weighted share of the project profit pool that is still open today.",
          profitOpenPool: "Project profit still open for capital-based sharing",
          profitWeightLabel: "Current capital weight",
          profitWeightedShare: "Current capital-weighted profit preview",
          profitAccrued: "Profit already reserved to this member",
          profitEstimated: "Estimated profit today",
          profitFormulaHint:
            "This is not the same as cash already paid out. It is the member's current profit position today.",
        };

  return (
    <Document
      title={`${statement.summary.profile.displayName} member statement`}
      author="Project Current"
      subject={`Member statement for ${statement.summary.profile.displayName}`}
      creator="Project Current"
      producer="Project Current"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
          <Text style={styles.title}>{statement.summary.profile.displayName}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaStack}>
              <Text style={styles.subtitle}>
                {copy.project}: {statement.project.name}
              </Text>
              <Text style={styles.metaText}>
                {copy.generatedAt}: {format(generatedAt, "yyyy-MM-dd HH:mm")}
              </Text>
            </View>
            <View style={styles.metaRight}>
              <Text style={styles.emailText}>
                {statement.summary.profile.email}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          {copy.summary.map((metric) => (
            <SummaryMetric
              key={metric.label}
              label={metric.label}
              value={metric.value}
              hint={metric.hint}
            />
          ))}
        </View>

        <View style={styles.breakdownBox}>
          <Text style={styles.noteTitle}>{detailCopy.claimTitle}</Text>
          <Text style={styles.breakdownIntro}>{detailCopy.claimIntro}</Text>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{detailCopy.claimCapital}</Text>
            <Text style={styles.breakdownValue}>
              {formatCurrency(
                statement.summary.capitalBalance,
                statement.project.currencyCode,
                locale
              )}
            </Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{detailCopy.claimProfit}</Text>
            <Text style={styles.breakdownValue}>
              {formatCurrency(
                statement.summary.estimatedProfitShare,
                statement.project.currencyCode,
                locale
              )}
            </Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>
              {detailCopy.claimReimbursement}
            </Text>
            <Text style={styles.breakdownValue}>
              {formatSignedCurrency(
                statement.summary.expenseReimbursementBalance,
                statement.project.currencyCode,
                locale
              )}
            </Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{detailCopy.claimCashHeld}</Text>
            <Text style={styles.breakdownValue}>
              {formatSignedCurrency(
                statement.summary.projectCashCustody,
                statement.project.currencyCode,
                locale
              )}
            </Text>
          </View>
          {claimRow && Math.abs(claimRow.reserveAllocation) > 0.009 ? (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{detailCopy.claimReserve}</Text>
              <Text style={styles.breakdownValue}>
                {formatSignedCurrency(
                  -claimRow.reserveAllocation,
                  statement.project.currencyCode,
                  locale
                )}
              </Text>
            </View>
          ) : null}
          <View style={[styles.breakdownRow, styles.breakdownTotalRow]}>
            <Text style={styles.breakdownTotalLabel}>
              {currentPayableAmount > 0
                ? detailCopy.claimPayable
                : detailCopy.claimHeldAbove}
            </Text>
            <Text style={styles.breakdownTotalValue}>
              {formatCurrency(
                currentPayableAmount > 0
                  ? currentPayableAmount
                  : memberHoldingAboveClaim,
                statement.project.currencyCode,
                locale
              )}
            </Text>
          </View>
          <Text style={[styles.metricHint, { marginTop: 6 }]}>
            {detailCopy.claimHint}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{copy.capitalTitle}</Text>
          <Text style={styles.sectionDescription}>{copy.capitalDescription}</Text>
          <StatementTable
            headers={[
              copy.headers.date,
              copy.headers.type,
              copy.headers.detail,
              copy.headers.amount,
            ]}
            rows={capitalRows}
            emptyLabel={copy.emptyCapital}
            widths={[16, 18, 46, 20]}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{copy.expenseTitle}</Text>
          <Text style={styles.sectionDescription}>{copy.expenseDescription}</Text>
          <SectionSummary
            label={detailCopy.expenseTotalLabel}
            value={formatCurrency(
              totalAllocatedCost,
              statement.project.currencyCode,
              locale
            )}
            hint={detailCopy.expenseTotalHint}
          />
          <StatementTable
            headers={[
              copy.headers.date,
              copy.headers.type,
              copy.headers.detail,
              copy.headers.amount,
            ]}
            rows={expenseRows}
            emptyLabel={copy.emptyExpense}
            widths={[16, 20, 44, 20]}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{detailCopy.profitFormulaTitle}</Text>
          <Text style={styles.sectionDescription}>
            {detailCopy.profitFormulaIntro}
          </Text>
          <View style={styles.breakdownBox}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{detailCopy.profitOpenPool}</Text>
              <Text style={styles.breakdownValue}>
                {formatCurrency(
                  openProfitStillSharedByCapital,
                  statement.project.currencyCode,
                  locale
                )}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>
                {detailCopy.profitWeightLabel}
              </Text>
              <Text style={styles.breakdownValue}>
                {formatPercent(capitalWeight, locale)}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>
                {detailCopy.profitWeightedShare}
              </Text>
              <Text style={styles.breakdownValue}>
                {formatCurrency(
                  capitalWeightedProfitPreview,
                  statement.project.currencyCode,
                  locale
                )}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{detailCopy.profitAccrued}</Text>
              <Text style={styles.breakdownValue}>
                {formatCurrency(
                  statement.summary.accruedProfitBalance,
                  statement.project.currencyCode,
                  locale
                )}
              </Text>
            </View>
            <View style={[styles.breakdownRow, styles.breakdownTotalRow]}>
              <Text style={styles.breakdownTotalLabel}>
                {detailCopy.profitEstimated}
              </Text>
              <Text style={styles.breakdownTotalValue}>
                {formatCurrency(
                  statement.summary.estimatedProfitShare,
                  statement.project.currencyCode,
                  locale
                )}
              </Text>
            </View>
            <Text style={[styles.metricHint, { marginTop: 6 }]}>
              {detailCopy.profitFormulaHint}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{copy.cashTitle}</Text>
          <Text style={styles.sectionDescription}>{copy.cashDescription}</Text>
          <StatementTable
            headers={[
              copy.headers.date,
              copy.headers.type,
              copy.headers.detail,
              copy.headers.amount,
            ]}
            rows={cashRows}
            emptyLabel={copy.emptyCash}
            widths={[16, 20, 44, 20]}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{copy.profitTitle}</Text>
          <Text style={styles.sectionDescription}>{copy.profitDescription}</Text>
          <StatementTable
            headers={[
              copy.headers.date,
              copy.headers.type,
              copy.headers.detail,
              copy.headers.amount,
            ]}
            rows={profitRows}
            emptyLabel={copy.emptyProfit}
            widths={[16, 20, 44, 20]}
          />
        </View>

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>{copy.reconciliationTitle}</Text>
          <Text>{copy.reconciliationNote}</Text>
        </View>

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>{copy.noteTitle}</Text>
          <Text>{copy.noteBody}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>{statement.project.name}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{copy.appendixTitle}</Text>
          <Text style={styles.title}>{statement.summary.profile.displayName}</Text>
          <Text style={styles.subtitle}>{copy.appendixDescription}</Text>
        </View>

        <StatementTable
          headers={[
            copy.headers.date,
            copy.headers.type,
            copy.headers.detail,
            copy.headers.amount,
          ]}
          rows={appendixRows}
          emptyLabel={copy.emptyAppendix}
          widths={[16, 20, 44, 20]}
        />

        <View style={styles.footer} fixed>
          <Text>{statement.project.name}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function buildMemberStatementPdf({
  statement,
  dataset,
  snapshot,
  locale = defaultAppLocale,
  generatedAt = new Date(),
}: MemberStatementPdfInput) {
  ensurePdfFont();

  const buffer = await renderToBuffer(
    <MemberStatementDocument
      statement={statement}
      dataset={dataset}
      snapshot={snapshot}
      locale={locale}
      generatedAt={generatedAt}
    />
  );

  return {
    fileBuffer: buffer,
    fileName: createMemberStatementPdfFileName(
      dataset.project.slug,
      statement.summary.profile.displayName,
      generatedAt
    ),
  };
}
