"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionState } from "@/lib/auth/session";
import {
  plannerEntrySchema,
  supportsLiveCreate,
  type PlannerEntryValues,
} from "@/lib/finance/entry-form";
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
  const session = await getSessionState();

  if (session.demoMode) {
    return {
      status: "error",
      message:
        "Live save is disabled in demo mode. Configure Supabase and sign in with a real account to persist entries.",
    };
  }

  const parsed = plannerEntrySchema.safeParse(payload);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Unable to save this entry.",
    };
  }

  if (!supportsLiveCreate(parsed.data.entryType)) {
    return {
      status: "error",
      message:
        "Profit distribution needs a dedicated posting flow. Use the preview dashboard for now.",
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      status: "error",
      message: "Supabase is not configured.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: "You must be signed in to save a live ledger entry.",
    };
  }

  const effectiveAt = new Date(parsed.data.effectiveDate).toISOString();

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
    p_note: parsed.data.note ?? null,
    p_external_counterparty: parsed.data.externalCounterparty ?? null,
  });

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  const entryId = rpcResponseSchema.safeParse(data);

  if (!entryId.success) {
    return {
      status: "error",
      message: "Entry was created, but the response payload was invalid.",
    };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${parsed.data.projectId}`);
  revalidatePath(`/projects/${parsed.data.projectId}/settlements`);
  revalidatePath(`/projects/${parsed.data.projectId}/reconciliation`);
  revalidatePath(`/projects/${parsed.data.projectId}/ledger/new`);

  return {
    status: "success",
    message: "Ledger entry saved.",
    redirectTo: `/projects/${parsed.data.projectId}`,
  };
}
