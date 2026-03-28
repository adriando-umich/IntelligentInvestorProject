import { defaultAppLocale, type AppLocale } from "@/lib/i18n/config";

export const projectStatuses = ["active", "archived", "closed"] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export const memberRoles = ["owner", "manager", "member"] as const;
export type MemberRole = (typeof memberRoles)[number];

export const membershipStatuses = ["active", "pending_invite"] as const;
export type MembershipStatus = (typeof membershipStatuses)[number];

export const entryStatuses = ["posted", "voided"] as const;
export type EntryStatus = (typeof entryStatuses)[number];

export const entryFamilies = ["business", "correction"] as const;
export type EntryFamily = (typeof entryFamilies)[number];

export const entryTypeLabels = {
  capital_contribution: "Capital contribution",
  capital_return: "Capital return",
  owner_profit_payout: "Owner profit payout",
  operating_income: "Operating income",
  shared_loan_drawdown: "Shared loan drawdown",
  shared_loan_repayment_principal: "Shared loan principal repayment",
  land_purchase: "Land purchase",
  shared_loan_interest_payment: "Shared loan interest payment",
  operating_expense: "Operating expense",
  cash_handover: "Cash handover",
  expense_settlement_payment: "Member repayment",
  profit_distribution: "Profit distribution",
  reconciliation_adjustment: "Reconciliation adjustment",
  reversal: "Reversal",
} as const;

export type EntryType = keyof typeof entryTypeLabels;

export const businessEntryTypes = [
  "capital_contribution",
  "capital_return",
  "owner_profit_payout",
  "operating_income",
  "shared_loan_drawdown",
  "shared_loan_repayment_principal",
  "land_purchase",
  "shared_loan_interest_payment",
  "operating_expense",
  "cash_handover",
  "expense_settlement_payment",
  "profit_distribution",
] as const satisfies readonly EntryType[];

export type BusinessEntryType = (typeof businessEntryTypes)[number];

export const correctionEntryTypes = [
  "reconciliation_adjustment",
  "reversal",
] as const satisfies readonly EntryType[];

export type CorrectionEntryType = (typeof correctionEntryTypes)[number];

export const entryFamilyLabels = {
  business: "Business event",
  correction: "Correction",
} as const satisfies Record<EntryFamily, string>;

const localizedEntryTypeLabels = {
  en: entryTypeLabels,
  vi: {
    ...entryTypeLabels,
    owner_profit_payout: "Chi tra loi nhuan cho chu von",
    capital_contribution: "Góp vốn",
    capital_return: "Hoàn vốn",
    operating_income: "Tiền vào vận hành",
    shared_loan_drawdown: "Giải ngân khoản vay chung",
    shared_loan_repayment_principal: "Trả gốc khoản vay chung",
    land_purchase: "Mua đất",
    shared_loan_interest_payment: "Trả lãi khoản vay chung",
    operating_expense: "Chi phí vận hành",
    cash_handover: "Chuyển tiền giữa thành viên",
    expense_settlement_payment: "Thành viên trả lại tiền cho nhau",
    profit_distribution: "Chia lợi nhuận",
    reconciliation_adjustment: "Điều chỉnh sau đối chiếu",
    reversal: "Bút toán đảo ngược",
  },
} as const satisfies Record<AppLocale, Record<EntryType, string>>;

const localizedEntryFamilyLabels = {
  en: entryFamilyLabels,
  vi: {
    business: "Nghiệp vụ thật",
    correction: "Điều chỉnh sổ",
  },
} as const satisfies Record<AppLocale, Record<EntryFamily, string>>;

const localizedRoleLabels = {
  en: {
    owner: "Owner",
    manager: "Manager",
    member: "Member",
  },
  vi: {
    owner: "Chủ dự án",
    manager: "Quản lý",
    member: "Thành viên",
  },
} as const satisfies Record<AppLocale, Record<MemberRole, string>>;

const localizedReconciliationStatusLabels = {
  en: {
    pending: "Pending",
    matched: "Matched",
    variance_found: "Variance found",
    accepted: "Accepted",
    adjustment_posted: "Adjustment posted",
  },
  vi: {
    pending: "Đang chờ",
    matched: "Khớp",
    variance_found: "Có chênh lệch",
    accepted: "Đã chấp nhận",
    adjustment_posted: "Đã ghi điều chỉnh",
  },
} as const satisfies Record<
  AppLocale,
  Record<ReconciliationStatus, string>
>;

export function getEntryTypeLabel(
  entryType: EntryType,
  locale: AppLocale = defaultAppLocale
) {
  return localizedEntryTypeLabels[locale][entryType];
}

export function getEntryFamilyLabel(
  entryFamily: EntryFamily,
  locale: AppLocale = defaultAppLocale
) {
  return localizedEntryFamilyLabels[locale][entryFamily];
}

export function getMemberRoleLabel(
  role: MemberRole,
  locale: AppLocale = defaultAppLocale
) {
  return localizedRoleLabels[locale][role];
}

export function getReconciliationStatusLabel(
  status: ReconciliationStatus,
  locale: AppLocale = defaultAppLocale
) {
  return localizedReconciliationStatusLabels[locale][status];
}

export const entryFamilyByType = {
  capital_contribution: "business",
  capital_return: "business",
  owner_profit_payout: "business",
  operating_income: "business",
  shared_loan_drawdown: "business",
  shared_loan_repayment_principal: "business",
  land_purchase: "business",
  shared_loan_interest_payment: "business",
  operating_expense: "business",
  cash_handover: "business",
  expense_settlement_payment: "business",
  profit_distribution: "business",
  reconciliation_adjustment: "correction",
  reversal: "correction",
} as const satisfies Record<EntryType, EntryFamily>;

export function getEntryFamily(entryType: EntryType): EntryFamily {
  return entryFamilyByType[entryType];
}

export function getBusinessEntryType(entryType: EntryType) {
  return getEntryFamily(entryType) === "business"
    ? (entryType as BusinessEntryType)
    : null;
}

export function getCorrectionType(entryType: EntryType) {
  return getEntryFamily(entryType) === "correction"
    ? (entryType as CorrectionEntryType)
    : null;
}

export const allocationTypeLabels = {
  capital_owner: "Capital owner",
  income_share: "Income share",
  expense_share: "Expense share",
  profit_share: "Profit share",
} as const;

export type AllocationType = keyof typeof allocationTypeLabels;

export type ReconciliationStatus =
  | "pending"
  | "matched"
  | "variance_found"
  | "accepted"
  | "adjustment_posted";

export interface Profile {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  currencyCode: string;
  status: ProjectStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: MemberRole;
  isActive: boolean;
  joinedAt: string;
  leftAt?: string | null;
  membershipStatus?: MembershipStatus;
  pendingEmail?: string | null;
  displayName?: string | null;
}

export interface LedgerEntry {
  id: string;
  projectId: string;
  entryType: EntryType;
  effectiveAt: string;
  description: string;
  amount: number;
  currencyCode: string;
  cashInMemberId?: string | null;
  cashOutMemberId?: string | null;
  externalCounterparty?: string | null;
  note?: string | null;
  status: EntryStatus;
  reversalOfEntryId?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerAllocation {
  id: string;
  ledgerEntryId: string;
  projectMemberId: string;
  allocationType: AllocationType;
  amount: number;
  weightPercent?: number | null;
  note?: string | null;
}

export interface ProjectTag {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerEntryTag {
  ledgerEntryId: string;
  projectTagId: string;
}

export interface ProfitDistributionRun {
  id: string;
  projectId: string;
  asOf: string;
  distributionDate: string;
  totalAmount: number;
  cashOutMemberId?: string | null;
  cashOutProjectMemberId?: string | null;
  ledgerEntryId: string;
  createdBy: string;
  createdAt: string;
}

export interface ProfitDistributionLine {
  id: string;
  runId: string;
  projectMemberId: string;
  capitalBalanceSnapshot: number;
  weightBasisAmount: number;
  weightPercent: number;
  distributionAmount: number;
}

export interface ReconciliationRun {
  id: string;
  projectId: string;
  asOf: string;
  status: "open" | "closed";
  openedBy: string;
  openedAt: string;
  closedBy?: string | null;
  closedAt?: string | null;
  note?: string | null;
  closingNote?: string | null;
  closingDifferenceAccepted?: boolean;
  closingDifferenceAmount?: number | null;
  reportedTotalProjectCashAtClose?: number | null;
  expectedTotalProjectCashAtClose?: number | null;
}

export interface ReconciliationCheck {
  id: string;
  runId: string;
  projectMemberId: string;
  expectedProjectCash: number;
  reportedProjectCash?: number | null;
  varianceAmount?: number | null;
  status: ReconciliationStatus;
  memberNote?: string | null;
  reviewNote?: string | null;
  submittedBy?: string | null;
  submittedAt?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

export type ProjectMemberActivityEventType =
  | "ownership_transferred"
  | "member_removed";

export interface ProjectMemberActivity {
  id: string;
  projectId: string;
  actorProjectMemberId: string;
  targetProjectMemberId: string;
  eventType: ProjectMemberActivityEventType;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface ProjectDataset {
  project: Project;
  profiles: Profile[];
  members: ProjectMember[];
  entries: LedgerEntry[];
  allocations: LedgerAllocation[];
  tags: ProjectTag[];
  entryTags: LedgerEntryTag[];
  profitDistributionRuns: ProfitDistributionRun[];
  profitDistributionLines: ProfitDistributionLine[];
  reconciliationRuns: ReconciliationRun[];
  reconciliationChecks: ReconciliationCheck[];
  projectMemberActivities?: ProjectMemberActivity[];
  projectMemberCanonicalIdByAlias?: Record<string, string>;
}

export interface MemberFinanceSummary {
  projectMember: ProjectMember;
  profile: Profile;
  projectCashCustody: number;
  frontedOwnMoney: number;
  expenseReimbursementBalance: number;
  teamOwesYou: number;
  youOweTeam: number;
  capitalBalance: number;
  assetBasisBalance: number;
  operatingPnlShare: number;
  profitReceivedTotal: number;
  ownerProfitPayoutTotal: number;
  accruedProfitBalance: number;
  estimatedProfitShare: number;
}

export interface SettlementSuggestion {
  fromProjectMemberId: string;
  toProjectMemberId: string;
  amount: number;
  reason: string;
}

export interface ReconciliationCheckView {
  check: ReconciliationCheck;
  member: ProjectMember;
  profile: Profile;
}

export interface ReconciliationProjectAccountingView {
  expectedTotalProjectCash: number;
  expectedTotalCapitalOutstanding: number;
  expectedTotalDeployedAssetBasis: number;
  expectedTotalSharedLoanPrincipal: number;
  expectedTotalUndistributedProfit: number;
  reportedTotalProjectCash: number;
  differenceAmount: number;
  submittedCount: number;
  totalMemberCount: number;
  allMembersSubmitted: boolean;
}

export interface CapitalWeightRow {
  projectMemberId: string;
  displayName: string;
  capitalBalance: number;
  weight: number;
  estimatedProfitShare: number;
}

export interface TagRollupRow {
  projectTagId: string;
  name: string;
  slug: string;
  amount: number;
  entryCount: number;
}

export interface ProjectSnapshot {
  dataset: ProjectDataset;
  memberSummaries: MemberFinanceSummary[];
  totalProjectCash: number;
  membersHoldingProjectCashTotal: number;
  frontedByMembersTotal: number;
  projectOperatingIncome: number;
  projectOperatingExpense: number;
  projectOperatingProfit: number;
  totalDeployedAssetBasis: number;
  sharedLoanDrawdownTotal: number;
  sharedLoanPrincipalRepaidTotal: number;
  sharedLoanPrincipalOutstanding: number;
  sharedLoanInterestPaidTotal: number;
  totalCapitalOutstanding: number;
  totalProfitDistributed: number;
  undistributedProfit: number;
  settlementSuggestions: SettlementSuggestion[];
  openReconciliation: {
    run: ReconciliationRun;
    checks: ReconciliationCheckView[];
    matchedCount: number;
    varianceCount: number;
    pendingCount: number;
    projectAccounting: ReconciliationProjectAccountingView;
  } | null;
  capitalWeights: CapitalWeightRow[];
  inflowTagRollups: TagRollupRow[];
  expenseTagRollups: TagRollupRow[];
  recentEntries: LedgerEntry[];
}

export interface MemberStatementSnapshot {
  project: Project;
  summary: MemberFinanceSummary;
  memberDirectory: Array<{
    projectMemberId: string;
    userId: string;
    displayName: string;
  }>;
  relatedEntries: LedgerEntry[];
  openReconciliationCheck: ReconciliationCheckView | null;
}
