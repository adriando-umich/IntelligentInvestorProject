import "server-only";

import { getSessionState } from "@/lib/auth/session";
import { getUserAvatarUrl, getUserDisplayName } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  type LedgerAllocation,
  type LedgerEntry,
  type LedgerEntryTag,
  type ProfitDistributionLine,
  type ProfitDistributionRun,
  type Profile,
  type Project,
  type ProjectDataset,
  type ProjectMember,
  type ProjectTag,
  type ReconciliationCheck,
  type ReconciliationRun,
} from "@/lib/finance/types";

type DbProfileRow = {
  user_id: string;
  display_name: string;
  email: string;
  avatar_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type DbProjectRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  currency_code: string;
  status: Project["status"];
  created_by: string;
  created_at: string;
  updated_at: string;
};

type DbProjectMemberRow = {
  id: string;
  project_id: string;
  user_id: string | null;
  role: ProjectMember["role"];
  is_active: boolean;
  joined_at: string;
  left_at: string | null;
  membership_status: "active" | "pending_invite";
  pending_email: string | null;
  display_name: string | null;
};

type DbLedgerEntryRow = {
  id: string;
  project_id: string;
  entry_type: LedgerEntry["entryType"];
  effective_at: string;
  description: string;
  amount: number | string;
  currency_code: string;
  cash_in_project_member_id: string | null;
  cash_out_project_member_id: string | null;
  cash_in_member_id: string | null;
  cash_out_member_id: string | null;
  external_counterparty: string | null;
  note: string | null;
  status: LedgerEntry["status"];
  reversal_of_entry_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type DbLedgerAllocationRow = {
  id: string;
  ledger_entry_id: string;
  project_member_id: string;
  allocation_type: LedgerAllocation["allocationType"];
  amount: number | string;
  weight_percent: number | string | null;
  note: string | null;
};

type DbProjectTagRow = {
  id: string;
  project_id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
};

type DbLedgerEntryTagRow = {
  ledger_entry_id: string;
  project_tag_id: string;
};

type DbProfitDistributionRunRow = {
  id: string;
  project_id: string;
  as_of: string;
  distribution_date: string;
  total_amount: number | string;
  cash_out_member_id: string;
  ledger_entry_id: string;
  created_by: string;
  created_at: string;
};

type DbProfitDistributionLineRow = {
  id: string;
  run_id: string;
  project_member_id: string;
  capital_balance_snapshot: number | string;
  weight_basis_amount: number | string;
  weight_percent: number | string;
  distribution_amount: number | string;
};

type DbReconciliationRunRow = {
  id: string;
  project_id: string;
  as_of: string;
  status: ReconciliationRun["status"];
  opened_by: string;
  opened_at: string;
  closed_by: string | null;
  closed_at: string | null;
  note: string | null;
};

type DbReconciliationCheckRow = {
  id: string;
  run_id: string;
  project_member_id: string;
  expected_project_cash: number | string;
  reported_project_cash: number | string | null;
  variance_amount: number | string | null;
  status: ReconciliationCheck["status"];
  member_note: string | null;
  review_note: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

function toNumber(value: number | string | null | undefined) {
  if (value == null) {
    return 0;
  }

  return typeof value === "number" ? value : Number(value);
}

function mapProfile(row: DbProfileRow): Profile {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    avatarUrl: row.avatar_url ?? null,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProject(row: DbProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    currencyCode: row.currency_code,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProjectMember(row: DbProjectMemberRow): ProjectMember {
  const fallbackUserId = `pending:${row.id}`;

  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id ?? fallbackUserId,
    role: row.role,
    isActive: row.is_active,
    joinedAt: row.joined_at,
    leftAt: row.left_at,
    membershipStatus: row.membership_status,
    pendingEmail: row.pending_email,
    displayName: row.display_name,
  };
}

function mapLedgerEntry(row: DbLedgerEntryRow): LedgerEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    entryType: row.entry_type,
    effectiveAt: row.effective_at,
    description: row.description,
    amount: toNumber(row.amount),
    currencyCode: row.currency_code,
    cashInMemberId: row.cash_in_project_member_id ?? row.cash_in_member_id,
    cashOutMemberId: row.cash_out_project_member_id ?? row.cash_out_member_id,
    externalCounterparty: row.external_counterparty,
    note: row.note,
    status: row.status,
    reversalOfEntryId: row.reversal_of_entry_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLedgerAllocation(row: DbLedgerAllocationRow): LedgerAllocation {
  return {
    id: row.id,
    ledgerEntryId: row.ledger_entry_id,
    projectMemberId: row.project_member_id,
    allocationType: row.allocation_type,
    amount: toNumber(row.amount),
    weightPercent:
      row.weight_percent == null ? null : Number(row.weight_percent),
    note: row.note,
  };
}

function mapProjectTag(row: DbProjectTagRow): ProjectTag {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    slug: row.slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLedgerEntryTag(row: DbLedgerEntryTagRow): LedgerEntryTag {
  return {
    ledgerEntryId: row.ledger_entry_id,
    projectTagId: row.project_tag_id,
  };
}

function mapProfitDistributionRun(
  row: DbProfitDistributionRunRow
): ProfitDistributionRun {
  return {
    id: row.id,
    projectId: row.project_id,
    asOf: row.as_of,
    distributionDate: row.distribution_date,
    totalAmount: toNumber(row.total_amount),
    cashOutMemberId: row.cash_out_member_id,
    ledgerEntryId: row.ledger_entry_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapProfitDistributionLine(
  row: DbProfitDistributionLineRow
): ProfitDistributionLine {
  return {
    id: row.id,
    runId: row.run_id,
    projectMemberId: row.project_member_id,
    capitalBalanceSnapshot: toNumber(row.capital_balance_snapshot),
    weightBasisAmount: toNumber(row.weight_basis_amount),
    weightPercent: toNumber(row.weight_percent),
    distributionAmount: toNumber(row.distribution_amount),
  };
}

function mapReconciliationRun(row: DbReconciliationRunRow): ReconciliationRun {
  return {
    id: row.id,
    projectId: row.project_id,
    asOf: row.as_of,
    status: row.status,
    openedBy: row.opened_by,
    openedAt: row.opened_at,
    closedBy: row.closed_by,
    closedAt: row.closed_at,
    note: row.note,
  };
}

function mapReconciliationCheck(
  row: DbReconciliationCheckRow
): ReconciliationCheck {
  return {
    id: row.id,
    runId: row.run_id,
    projectMemberId: row.project_member_id,
    expectedProjectCash: toNumber(row.expected_project_cash),
    reportedProjectCash:
      row.reported_project_cash == null ? null : Number(row.reported_project_cash),
    varianceAmount:
      row.variance_amount == null ? null : Number(row.variance_amount),
    status: row.status,
    memberNote: row.member_note,
    reviewNote: row.review_note,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
  };
}

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }

  return (
    error.code === "PGRST205" ||
    error.message?.toLowerCase().includes("relation") === true ||
    error.message?.toLowerCase().includes("does not exist") === true
  );
}

export async function shouldUseDemoData() {
  const session = await getSessionState();
  return session.demoMode;
}

export async function getLiveViewerProfile() {
  const session = await getSessionState();

  if (session.demoMode) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single<DbProfileRow>();

  if (error || !data) {
    return {
      userId: user.id,
      displayName: getUserDisplayName(user.user_metadata, user.email),
      email: user.email ?? "",
      avatarUrl: getUserAvatarUrl(user.user_metadata),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies Profile;
  }

  return {
    ...mapProfile(data),
    avatarUrl: data.avatar_url ?? getUserAvatarUrl(user.user_metadata),
  } satisfies Profile;
}

export async function listLiveProjectIds() {
  const session = await getSessionState();

  if (session.demoMode) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .order("updated_at", { ascending: false });

  if (error || !data) {
    console.error("Unable to list live projects", error);
    return [];
  }

  return data.map((row) => row.id as string);
}

export async function getLiveProjectDataset(projectId: string) {
  const session = await getSessionState();

  if (session.demoMode) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const [
    projectResult,
    membersResult,
    entriesResult,
    runResult,
    reconciliationRunResult,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single<DbProjectRow>(),
    supabase
      .from("project_members")
      .select("*")
      .eq("project_id", projectId)
      .order("joined_at", { ascending: true })
      .returns<DbProjectMemberRow[]>(),
    supabase
      .from("ledger_entries")
      .select("*")
      .eq("project_id", projectId)
      .order("effective_at", { ascending: true })
      .returns<DbLedgerEntryRow[]>(),
    supabase
      .from("profit_distribution_runs")
      .select("*")
      .eq("project_id", projectId)
      .order("distribution_date", { ascending: true })
      .returns<DbProfitDistributionRunRow[]>(),
    supabase
      .from("reconciliation_runs")
      .select("*")
      .eq("project_id", projectId)
      .order("opened_at", { ascending: true })
      .returns<DbReconciliationRunRow[]>(),
  ]);

  if (projectResult.error || !projectResult.data) {
    if (projectResult.error) {
      console.error("Unable to load live project", projectResult.error);
    }
    return null;
  }

  if (membersResult.error || entriesResult.error || runResult.error || reconciliationRunResult.error) {
    console.error("Unable to load live project dataset", {
      membersError: membersResult.error,
      entriesError: entriesResult.error,
      runsError: runResult.error,
      reconciliationRunsError: reconciliationRunResult.error,
    });
    return null;
  }

  const members = membersResult.data ?? [];
  const entries = entriesResult.data ?? [];
  const runs = runResult.data ?? [];
  const reconciliationRuns = reconciliationRunResult.data ?? [];

  const userIds = [
    ...new Set(
      members
        .map((member) => member.user_id)
        .filter((userId): userId is string => typeof userId === "string")
    ),
  ];
  const entryIds = entries.map((entry) => entry.id);
  const runIds = runs.map((run) => run.id);
  const reconciliationRunIds = reconciliationRuns.map((run) => run.id);

  const [
    profilesResult,
    allocationsResult,
    projectTagsResult,
    linesResult,
    checksResult,
  ] =
    await Promise.all([
      userIds.length > 0
        ? supabase
            .from("profiles")
            .select("*")
            .in("user_id", userIds)
            .returns<DbProfileRow[]>()
        : Promise.resolve({ data: [], error: null }),
      entryIds.length > 0
        ? supabase
            .from("ledger_allocations")
            .select("*")
            .in("ledger_entry_id", entryIds)
            .returns<DbLedgerAllocationRow[]>()
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("project_tags")
        .select("*")
        .eq("project_id", projectId)
        .order("name", { ascending: true })
        .returns<DbProjectTagRow[]>(),
      runIds.length > 0
        ? supabase
            .from("profit_distribution_lines")
            .select("*")
            .in("run_id", runIds)
            .returns<DbProfitDistributionLineRow[]>()
        : Promise.resolve({ data: [], error: null }),
      reconciliationRunIds.length > 0
        ? supabase
            .from("reconciliation_checks")
            .select("*")
            .in("run_id", reconciliationRunIds)
            .returns<DbReconciliationCheckRow[]>()
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (
    profilesResult.error ||
    allocationsResult.error ||
    (!isMissingRelationError(projectTagsResult.error) && projectTagsResult.error) ||
    linesResult.error ||
    checksResult.error
  ) {
    console.error("Unable to load live project related tables", {
      profilesError: profilesResult.error,
      allocationsError: allocationsResult.error,
      projectTagsError: projectTagsResult.error,
      linesError: linesResult.error,
      checksError: checksResult.error,
    });
    return null;
  }

  const projectTags = isMissingRelationError(projectTagsResult.error)
    ? []
    : projectTagsResult.data ?? [];
  const projectTagIds = projectTags.map((tag) => tag.id);

  const entryTagsResult =
    projectTagIds.length > 0
      ? await supabase
          .from("ledger_entry_tags")
          .select("*")
          .in("project_tag_id", projectTagIds)
          .returns<DbLedgerEntryTagRow[]>()
      : { data: [], error: null };

  if (entryTagsResult.error && !isMissingRelationError(entryTagsResult.error)) {
    console.error("Unable to load live entry tags", entryTagsResult.error);
    return null;
  }

  const actualProfiles = (profilesResult.data ?? []).map(mapProfile);
  const syntheticPendingProfiles = members
    .filter((member) => member.membership_status === "pending_invite")
    .map((member) => ({
      userId: `pending:${member.id}`,
      displayName:
        member.display_name ??
        member.pending_email?.split("@")[0]?.trim() ??
        "Pending member",
      email: member.pending_email ?? "",
      avatarUrl: null,
      isActive: member.is_active,
      createdAt: member.joined_at,
      updatedAt: member.joined_at,
    }));

  return {
    project: mapProject(projectResult.data),
    profiles: [...actualProfiles, ...syntheticPendingProfiles],
    members: members.map(mapProjectMember),
    entries: entries.map(mapLedgerEntry),
    allocations: (allocationsResult.data ?? []).map(mapLedgerAllocation),
    tags: projectTags.map(mapProjectTag),
    entryTags: (entryTagsResult.data ?? []).map(mapLedgerEntryTag),
    profitDistributionRuns: runs.map(mapProfitDistributionRun),
    profitDistributionLines: (linesResult.data ?? []).map(
      mapProfitDistributionLine
    ),
    reconciliationRuns: reconciliationRuns.map(mapReconciliationRun),
    reconciliationChecks: (checksResult.data ?? []).map(mapReconciliationCheck),
  } satisfies ProjectDataset;
}
