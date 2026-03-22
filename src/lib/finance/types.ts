export const projectStatuses = ["active", "archived", "closed"] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export const memberRoles = ["owner", "manager", "member"] as const;
export type MemberRole = (typeof memberRoles)[number];

export const entryStatuses = ["posted", "voided"] as const;
export type EntryStatus = (typeof entryStatuses)[number];

export const entryTypeLabels = {
  capital_contribution: "Capital contribution",
  capital_return: "Capital return",
  operating_income: "Operating income",
  shared_loan_drawdown: "Shared loan drawdown",
  operating_expense: "Operating expense",
  cash_handover: "Cash handover",
  expense_settlement_payment: "Member repayment",
  profit_distribution: "Profit distribution",
  reconciliation_adjustment: "Reconciliation adjustment",
  reversal: "Reversal",
} as const;

export type EntryType = keyof typeof entryTypeLabels;

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
  cashOutMemberId: string;
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
  operatingPnlShare: number;
  profitReceivedTotal: number;
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
