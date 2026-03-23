"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionState } from "@/lib/auth/session";
import {
  buildEqualAllocationShares,
  computeAllocationAmountPreviews,
  normalizeAllocationShares,
} from "@/lib/finance/allocation-shares";
import {
  getPlannerEntrySchema,
  parseTagNames,
  supportsLiveCreate,
  supportsLiveEdit,
  type PlannerEntryValues,
} from "@/lib/finance/entry-form";
import { getServerI18n } from "@/lib/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LedgerActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  redirectTo?: string;
};

const uuidResponseSchema = z.string().uuid();
const ledgerMutationIdentitySchema = z.object({
  projectId: z.string().uuid(),
  ledgerEntryId: z.string().uuid(),
});

type LedgerCopy = {
  demoBlocked: string;
  saveFailed: string;
  editBlocked: string;
  voidFailed: string;
  profitDistributionPreviewOnly: string;
  signInRequired: string;
  missingMigration: string;
  invalidResponse: string;
  saved: string;
  updated: string;
  voided: string;
};

function getLedgerCopy(locale: "en" | "vi"): LedgerCopy {
  return locale === "vi"
    ? {
        demoBlocked: "Workspace mau khong cho luu giao dich live.",
        saveFailed: "Khong the luu giao dich nay.",
        editBlocked:
          "Loai giao dich nay chua ho tro sua truc tiep trong planner.",
        voidFailed: "Khong the xoa mem giao dich nay.",
        profitDistributionPreviewOnly:
          "Luong chia loi nhuan van can man thao tac rieng. Tam thoi hay dung che do preview.",
        signInRequired: "Ban can dang nhap truoc khi luu giao dich.",
        missingMigration:
          "Database live dang thieu migration ledger moi nhat. Hay apply migration Supabase moi nhat roi thu lai.",
        invalidResponse:
          "Giao dich da duoc xu ly nhung payload phan hoi tra ve khong hop le.",
        saved: "Da luu giao dich.",
        updated: "Da cap nhat giao dich.",
        voided: "Da xoa mem giao dich.",
      }
    : {
        demoBlocked:
          "Live transaction saving is disabled in the sample workspace.",
        saveFailed: "Unable to save this transaction.",
        editBlocked:
          "This transaction type is not editable from the planner yet.",
        voidFailed: "Unable to void this transaction.",
        profitDistributionPreviewOnly:
          "Profit distribution still needs the dedicated distribution workflow. Use preview for now.",
        signInRequired: "You must be signed in before saving a transaction.",
        missingMigration:
          "The live database is missing the latest ledger migration. Apply the newest Supabase migration, then try again.",
        invalidResponse:
          "The transaction was processed, but the response payload was invalid.",
        saved: "Transaction saved.",
        updated: "Transaction updated.",
        voided: "Transaction voided.",
      };
}

function buildLedgerRpcPayload(values: PlannerEntryValues) {
  const tagNames = parseTagNames(values.tagNamesText);
  const allocationShares =
    values.allocationProjectMemberIds.length === 0
      ? []
      : values.allocationSplitMode === "equal"
        ? buildEqualAllocationShares(values.allocationProjectMemberIds)
        : normalizeAllocationShares(values.allocationShares);
  const allocationAmountRows = computeAllocationAmountPreviews(
    values.amount,
    allocationShares
  );

  return {
    p_project_id: values.projectId,
    p_entry_type: values.entryType,
    p_effective_at: new Date(values.effectiveDate).toISOString(),
    p_description: values.description,
    p_amount: values.amount,
    p_currency_code: values.currencyCode,
    p_cash_in_project_member_id: values.cashInProjectMemberId ?? null,
    p_cash_out_project_member_id: values.cashOutProjectMemberId ?? null,
    p_capital_owner_project_member_id:
      values.capitalOwnerProjectMemberId ?? null,
    p_allocation_project_member_ids:
      allocationAmountRows.length > 0
        ? allocationAmountRows.map((row) => row.projectMemberId)
        : null,
    p_allocation_amounts:
      allocationAmountRows.length > 0
        ? allocationAmountRows.map((row) => row.amount)
        : null,
    p_allocation_weight_percents:
      allocationAmountRows.length > 0
        ? allocationAmountRows.map((row) =>
            Number((row.weightPercent / 100).toFixed(5))
          )
        : null,
    p_tag_names: tagNames.length > 0 ? tagNames : null,
    p_note: values.note ?? null,
    p_external_counterparty: values.externalCounterparty ?? null,
  };
}

function buildProfitDistributionRpcPayload(values: PlannerEntryValues) {
  const tagNames = parseTagNames(values.tagNamesText);

  return {
    p_project_id: values.projectId,
    p_effective_at: new Date(values.effectiveDate).toISOString(),
    p_description: values.description,
    p_amount: values.amount,
    p_currency_code: values.currencyCode,
    p_cash_out_project_member_id: values.cashOutProjectMemberId ?? null,
    p_tag_names: tagNames.length > 0 ? tagNames : null,
    p_note: values.note ?? null,
    p_external_counterparty: values.externalCounterparty ?? null,
  };
}

function isMissingLedgerUpgrade(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "PGRST202" ||
    message.includes("project_tags") ||
    message.includes("ledger_entry_tags") ||
    message.includes("shared_loan_drawdown") ||
    message.includes("shared_loan_interest_payment") ||
    message.includes("shared_loan_repayment_principal") ||
    message.includes("update_project_ledger_entry") ||
    message.includes("void_project_ledger_entry") ||
    message.includes("create_profit_distribution_entry") ||
    message.includes("update_profit_distribution_entry") ||
    message.includes("p_allocation_amounts") ||
    message.includes("p_allocation_weight_percents")
  );
}

function revalidateLedgerPaths(projectId: string) {
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settlements`);
  revalidatePath(`/projects/${projectId}/reconciliation`);
  revalidatePath(`/projects/${projectId}/ledger/new`);
}

async function getAuthenticatedSupabase(ledgerText: LedgerCopy, supabaseMissing: string) {
  const session = await getSessionState();

  if (session.demoMode) {
    return {
      error: {
        status: "error",
        message: ledgerText.demoBlocked,
      } satisfies LedgerActionState,
      supabase: null,
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      error: {
        status: "error",
        message: supabaseMissing,
      } satisfies LedgerActionState,
      supabase: null,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: {
        status: "error",
        message: ledgerText.signInRequired,
      } satisfies LedgerActionState,
      supabase: null,
    };
  }

  return { error: null, supabase };
}

async function validatePlannerPayload(
  payload: PlannerEntryValues,
  {
    allowCreateOnly = false,
    allowEditOnly = false,
  }: {
    allowCreateOnly?: boolean;
    allowEditOnly?: boolean;
  }
) {
  const { locale, text } = await getServerI18n();
  const ledgerText = getLedgerCopy(locale);
  const parsed = getPlannerEntrySchema(locale).safeParse(payload);

  if (!parsed.success) {
    return {
      error: {
        status: "error",
        message: parsed.error.issues[0]?.message ?? ledgerText.saveFailed,
      } satisfies LedgerActionState,
      data: null,
      ledgerText,
      text,
    };
  }

  if (allowCreateOnly && !supportsLiveCreate(parsed.data.entryType)) {
    return {
      error: {
        status: "error",
        message: ledgerText.profitDistributionPreviewOnly,
      } satisfies LedgerActionState,
      data: null,
      ledgerText,
      text,
    };
  }

  if (allowEditOnly && !supportsLiveEdit(parsed.data.entryType)) {
    return {
      error: {
        status: "error",
        message: ledgerText.editBlocked,
      } satisfies LedgerActionState,
      data: null,
      ledgerText,
      text,
    };
  }

  return {
    error: null,
    data: parsed.data,
    ledgerText,
    text,
  };
}

function finalizeLedgerMutation(
  projectId: string,
  response: unknown,
  ledgerText: LedgerCopy,
  successMessage: string
): LedgerActionState {
  const parsedResponse = uuidResponseSchema.safeParse(response);

  if (!parsedResponse.success) {
    return {
      status: "error",
      message: ledgerText.invalidResponse,
    };
  }

  revalidateLedgerPaths(projectId);

  return {
    status: "success",
    message: successMessage,
    redirectTo: `/projects/${projectId}`,
  };
}

export async function createLedgerEntryAction(
  payload: PlannerEntryValues
): Promise<LedgerActionState> {
  const validation = await validatePlannerPayload(payload, {
    allowCreateOnly: true,
  });

  if (validation.error) {
    return validation.error;
  }

  const auth = await getAuthenticatedSupabase(
    validation.ledgerText,
    validation.text.actions.auth.supabaseMissing
  );

  if (auth.error) {
    return auth.error;
  }

  const { data, error } = await auth.supabase.rpc("create_project_ledger_entry", {
    ...buildLedgerRpcPayload(validation.data),
  });

  if (error) {
    return {
      status: "error",
      message: isMissingLedgerUpgrade(error)
        ? validation.ledgerText.missingMigration
        : error.message,
    };
  }

  return finalizeLedgerMutation(
    validation.data.projectId,
    data,
    validation.ledgerText,
    validation.ledgerText.saved
  );
}

export async function createProfitDistributionEntryAction(
  payload: PlannerEntryValues
): Promise<LedgerActionState> {
  const validation = await validatePlannerPayload(payload, {});

  if (validation.error) {
    return validation.error;
  }

  if (validation.data.entryType !== "profit_distribution") {
    return {
      status: "error",
      message: validation.ledgerText.saveFailed,
    };
  }

  const auth = await getAuthenticatedSupabase(
    validation.ledgerText,
    validation.text.actions.auth.supabaseMissing
  );

  if (auth.error) {
    return auth.error;
  }

  const { data, error } = await auth.supabase.rpc(
    "create_profit_distribution_entry",
    buildProfitDistributionRpcPayload(validation.data)
  );

  if (error) {
    return {
      status: "error",
      message: isMissingLedgerUpgrade(error)
        ? validation.ledgerText.missingMigration
        : error.message,
    };
  }

  return finalizeLedgerMutation(
    validation.data.projectId,
    data,
    validation.ledgerText,
    validation.ledgerText.saved
  );
}

export async function updateLedgerEntryAction(
  ledgerEntryId: string,
  payload: PlannerEntryValues
): Promise<LedgerActionState> {
  const validation = await validatePlannerPayload(payload, {
    allowEditOnly: true,
  });

  if (validation.error) {
    return validation.error;
  }

  if (!uuidResponseSchema.safeParse(ledgerEntryId).success) {
    return {
      status: "error",
      message: validation.ledgerText.saveFailed,
    };
  }

  const auth = await getAuthenticatedSupabase(
    validation.ledgerText,
    validation.text.actions.auth.supabaseMissing
  );

  if (auth.error) {
    return auth.error;
  }

  const { data, error } = await auth.supabase.rpc("update_project_ledger_entry", {
    p_ledger_entry_id: ledgerEntryId,
    ...buildLedgerRpcPayload(validation.data),
  });

  if (error) {
    return {
      status: "error",
      message: isMissingLedgerUpgrade(error)
        ? validation.ledgerText.missingMigration
        : error.message,
    };
  }

  return finalizeLedgerMutation(
    validation.data.projectId,
    data,
    validation.ledgerText,
    validation.ledgerText.updated
  );
}

export async function updateProfitDistributionEntryAction(
  ledgerEntryId: string,
  payload: PlannerEntryValues
): Promise<LedgerActionState> {
  const validation = await validatePlannerPayload(payload, {});

  if (validation.error) {
    return validation.error;
  }

  if (validation.data.entryType !== "profit_distribution") {
    return {
      status: "error",
      message: validation.ledgerText.saveFailed,
    };
  }

  if (!uuidResponseSchema.safeParse(ledgerEntryId).success) {
    return {
      status: "error",
      message: validation.ledgerText.saveFailed,
    };
  }

  const auth = await getAuthenticatedSupabase(
    validation.ledgerText,
    validation.text.actions.auth.supabaseMissing
  );

  if (auth.error) {
    return auth.error;
  }

  const { data, error } = await auth.supabase.rpc(
    "update_profit_distribution_entry",
    {
      p_ledger_entry_id: ledgerEntryId,
      ...buildProfitDistributionRpcPayload(validation.data),
    }
  );

  if (error) {
    return {
      status: "error",
      message: isMissingLedgerUpgrade(error)
        ? validation.ledgerText.missingMigration
        : error.message,
    };
  }

  return finalizeLedgerMutation(
    validation.data.projectId,
    data,
    validation.ledgerText,
    validation.ledgerText.updated
  );
}

export async function voidLedgerEntryAction(input: {
  projectId: string;
  ledgerEntryId: string;
}): Promise<LedgerActionState> {
  const { locale, text } = await getServerI18n();
  const ledgerText = getLedgerCopy(locale);
  const parsed = ledgerMutationIdentitySchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: ledgerText.voidFailed,
    };
  }

  const auth = await getAuthenticatedSupabase(
    ledgerText,
    text.actions.auth.supabaseMissing
  );

  if (auth.error) {
    return auth.error;
  }

  const { data, error } = await auth.supabase.rpc("void_project_ledger_entry", {
    p_ledger_entry_id: parsed.data.ledgerEntryId,
  });

  if (error) {
    return {
      status: "error",
      message: isMissingLedgerUpgrade(error)
        ? ledgerText.missingMigration
        : error.message,
    };
  }

  return finalizeLedgerMutation(
    parsed.data.projectId,
    data,
    ledgerText,
    ledgerText.voided
  );
}
