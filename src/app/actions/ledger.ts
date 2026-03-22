"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionState } from "@/lib/auth/session";
import {
  parseTagNames,
  getPlannerEntrySchema,
  supportsLiveCreate,
  type PlannerEntryValues,
} from "@/lib/finance/entry-form";
import { getServerI18n } from "@/lib/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LedgerActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  redirectTo?: string;
};

const rpcResponseSchema = z.string().uuid();

export async function createLedgerEntryAction(
  payload: PlannerEntryValues
): Promise<LedgerActionState> {
  const { locale, text } = await getServerI18n();
  const session = await getSessionState();
  const ledgerText =
    locale === "vi"
      ? {
          demoBlocked: "Workspace mau khong cho luu giao dich live.",
          saveFailed: "Khong the luu giao dich nay.",
          profitDistributionPreviewOnly:
            "Luong chia loi nhuan van can man thao tac rieng. Tam thoi hay dung che do preview.",
          signInRequired: "Ban can dang nhap truoc khi luu giao dich.",
          missingMigration:
            "Database live dang thieu migration ledger moi nhat. Hay apply migration Supabase moi nhat roi thu lai.",
          invalidResponse:
            "Giao dich da duoc luu nhung payload phan hoi tra ve khong hop le.",
          saved: "Da luu giao dich.",
        }
      : {
          demoBlocked:
            "Live transaction saving is disabled in the sample workspace.",
          saveFailed: "Unable to save this transaction.",
          profitDistributionPreviewOnly:
            "Profit distribution still needs the dedicated distribution workflow. Use preview for now.",
          signInRequired:
            "You must be signed in before saving a transaction.",
          missingMigration:
            "The live database is missing the latest ledger migration. Apply the newest Supabase migration, then try again.",
          invalidResponse:
            "The transaction was saved, but the response payload was invalid.",
          saved: "Transaction saved.",
        };

  if (session.demoMode) {
    return {
      status: "error",
      message: ledgerText.demoBlocked,
    };
  }

  const parsed = getPlannerEntrySchema(locale).safeParse(payload);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? ledgerText.saveFailed,
    };
  }

  if (!supportsLiveCreate(parsed.data.entryType)) {
    return {
      status: "error",
      message: ledgerText.profitDistributionPreviewOnly,
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      status: "error",
      message: text.actions.auth.supabaseMissing,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: ledgerText.signInRequired,
    };
  }

  const effectiveAt = new Date(parsed.data.effectiveDate).toISOString();
  const tagNames = parseTagNames(parsed.data.tagNamesText);

  const { data, error } = await supabase.rpc("create_project_ledger_entry", {
    p_project_id: parsed.data.projectId,
    p_entry_type: parsed.data.entryType,
    p_effective_at: effectiveAt,
    p_description: parsed.data.description,
    p_amount: parsed.data.amount,
    p_currency_code: parsed.data.currencyCode,
    p_cash_in_project_member_id: parsed.data.cashInProjectMemberId ?? null,
    p_cash_out_project_member_id: parsed.data.cashOutProjectMemberId ?? null,
    p_capital_owner_project_member_id:
      parsed.data.capitalOwnerProjectMemberId ?? null,
    p_allocation_project_member_ids:
      parsed.data.allocationProjectMemberIds.length > 0
        ? parsed.data.allocationProjectMemberIds
        : null,
    p_tag_names: tagNames.length > 0 ? tagNames : null,
    p_note: parsed.data.note ?? null,
    p_external_counterparty: parsed.data.externalCounterparty ?? null,
  });

  if (error) {
    const missingLedgerUpgrade =
      error.code === "PGRST202" ||
      error.message.toLowerCase().includes("project_tags") ||
      error.message.toLowerCase().includes("ledger_entry_tags") ||
      error.message.toLowerCase().includes("shared_loan_drawdown") ||
      error.message
        .toLowerCase()
        .includes("shared_loan_interest_payment") ||
      error.message
        .toLowerCase()
        .includes("shared_loan_repayment_principal");

    return {
      status: "error",
      message: missingLedgerUpgrade
        ? ledgerText.missingMigration
        : error.message,
    };
  }

  const entryId = rpcResponseSchema.safeParse(data);

  if (!entryId.success) {
    return {
      status: "error",
      message: ledgerText.invalidResponse,
    };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${parsed.data.projectId}`);
  revalidatePath(`/projects/${parsed.data.projectId}/settlements`);
  revalidatePath(`/projects/${parsed.data.projectId}/reconciliation`);
  revalidatePath(`/projects/${parsed.data.projectId}/ledger/new`);

  return {
    status: "success",
    message: ledgerText.saved,
    redirectTo: `/projects/${parsed.data.projectId}`,
  };
}
