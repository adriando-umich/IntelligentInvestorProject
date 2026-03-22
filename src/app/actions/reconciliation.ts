"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionState } from "@/lib/auth/session";
import { getServerI18n } from "@/lib/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ReconciliationActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

function isMissingReconciliationUpgrade(
  error: { code?: string; message?: string } | null,
  functionNames: string[]
) {
  const message = error?.message?.toLowerCase() ?? "";

  return (
    error?.code === "PGRST202" ||
    functionNames.some((name) => message.includes(name.toLowerCase()))
  );
}

function revalidateProjectPaths(projectId: string) {
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/members`);
  revalidatePath(`/projects/${projectId}/reconciliation`);
}

export async function openReconciliationRunAction(payload: {
  projectId: string;
  asOf: string;
  note?: string;
}): Promise<ReconciliationActionState> {
  const { locale, text } = await getServerI18n();
  const session = await getSessionState();
  const copy =
    locale === "vi"
      ? {
          demoBlocked: "Workspace mẫu không cho mở đợt đối chiếu live.",
          invalidProject: "Thiếu project ID hợp lệ.",
          invalidDate: "Hãy chọn ngày chốt đối chiếu.",
          openFailed: "Không thể mở đợt đối chiếu.",
          signInRequired: "Bạn cần đăng nhập trước khi mở đợt đối chiếu.",
          missingMigration:
            "Database live đang thiếu migration reconciliation mới nhất. Hãy apply migration Supabase mới nhất rồi thử lại.",
          opened: "Đã mở đợt đối chiếu mới.",
        }
      : {
          demoBlocked:
            "Opening a live reconciliation run is disabled in the sample workspace.",
          invalidProject: "Missing valid project ID.",
          invalidDate: "Choose a reconciliation cutoff date.",
          openFailed: "Unable to open reconciliation run.",
          signInRequired:
            "You must be signed in before opening reconciliation.",
          missingMigration:
            "The live database is missing the latest reconciliation migration. Apply the newest Supabase migration, then try again.",
          opened: "Reconciliation run opened.",
        };

  if (session.demoMode) {
    return { status: "error", message: copy.demoBlocked };
  }

  const parsed = z
    .object({
      projectId: z.string().uuid(copy.invalidProject),
      asOf: z.string().min(1, copy.invalidDate),
      note: z
        .string()
        .trim()
        .optional()
        .transform((value) => (value && value.length > 0 ? value : undefined)),
    })
    .safeParse(payload);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? copy.openFailed,
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
    return { status: "error", message: copy.signInRequired };
  }

  const { error } = await supabase.rpc("open_reconciliation_run", {
    p_project_id: parsed.data.projectId,
    p_as_of: new Date(parsed.data.asOf).toISOString(),
    p_note: parsed.data.note ?? null,
  });

  if (error) {
    return {
      status: "error",
      message: isMissingReconciliationUpgrade(error, ["open_reconciliation_run"])
        ? copy.missingMigration
        : error.message,
    };
  }

  revalidateProjectPaths(parsed.data.projectId);

  return {
    status: "success",
    message: copy.opened,
  };
}

export async function submitReconciliationCheckAction(payload: {
  projectId: string;
  checkId: string;
  reportedProjectCash: number;
  memberNote?: string;
}): Promise<ReconciliationActionState> {
  const { locale, text } = await getServerI18n();
  const session = await getSessionState();
  const copy =
    locale === "vi"
      ? {
          demoBlocked: "Workspace mẫu không cho gửi đối chiếu live.",
          invalidProject: "Thiếu project ID hợp lệ.",
          invalidCheck: "Thiếu reconciliation check hợp lệ.",
          invalidAmount: "Hãy nhập số tiền dự án thực tế bạn đang giữ.",
          saveFailed: "Không thể gửi số liệu đối chiếu.",
          signInRequired: "Bạn cần đăng nhập trước khi gửi đối chiếu.",
          missingMigration:
            "Database live đang thiếu migration reconciliation mới nhất. Hãy apply migration Supabase mới nhất rồi thử lại.",
          saved: "Đã gửi số liệu đối chiếu.",
        }
      : {
          demoBlocked:
            "Submitting a live reconciliation check is disabled in the sample workspace.",
          invalidProject: "Missing valid project ID.",
          invalidCheck: "Missing valid reconciliation check.",
          invalidAmount:
            "Enter the actual net project cash you are holding.",
          saveFailed: "Unable to submit reconciliation check.",
          signInRequired:
            "You must be signed in before submitting reconciliation.",
          missingMigration:
            "The live database is missing the latest reconciliation migration. Apply the newest Supabase migration, then try again.",
          saved: "Reconciliation check submitted.",
        };

  if (session.demoMode) {
    return { status: "error", message: copy.demoBlocked };
  }

  const parsed = z
    .object({
      projectId: z.string().uuid(copy.invalidProject),
      checkId: z.string().uuid(copy.invalidCheck),
      reportedProjectCash: z.number().finite(copy.invalidAmount),
      memberNote: z
        .string()
        .trim()
        .optional()
        .transform((value) => (value && value.length > 0 ? value : undefined)),
    })
    .safeParse(payload);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? copy.saveFailed,
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
    return { status: "error", message: copy.signInRequired };
  }

  const { error } = await supabase.rpc("submit_reconciliation_check", {
    p_check_id: parsed.data.checkId,
    p_reported_project_cash: parsed.data.reportedProjectCash,
    p_member_note: parsed.data.memberNote ?? null,
  });

  if (error) {
    return {
      status: "error",
      message: isMissingReconciliationUpgrade(error, ["submit_reconciliation_check"])
        ? copy.missingMigration
        : error.message,
    };
  }

  revalidateProjectPaths(parsed.data.projectId);

  return {
    status: "success",
    message: copy.saved,
  };
}

export async function acceptReconciliationCheckAction(payload: {
  projectId: string;
  checkId: string;
  reviewNote?: string;
}): Promise<ReconciliationActionState> {
  const { locale, text } = await getServerI18n();
  const session = await getSessionState();
  const copy =
    locale === "vi"
      ? {
          demoBlocked: "Workspace mẫu không cho xử lý chênh lệch live.",
          invalidProject: "Thiếu project ID hợp lệ.",
          invalidCheck: "Thiếu reconciliation check hợp lệ.",
          saveFailed: "Không thể chấp nhận chênh lệch này.",
          signInRequired: "Bạn cần đăng nhập trước khi review đối chiếu.",
          missingMigration:
            "Database live đang thiếu migration reconciliation mới nhất. Hãy apply migration Supabase mới nhất rồi thử lại.",
          saved: "Đã đánh dấu chênh lệch là đã chấp nhận.",
        }
      : {
          demoBlocked:
            "Variance review is disabled in the sample workspace.",
          invalidProject: "Missing valid project ID.",
          invalidCheck: "Missing valid reconciliation check.",
          saveFailed: "Unable to accept this reconciliation variance.",
          signInRequired:
            "You must be signed in before reviewing reconciliation.",
          missingMigration:
            "The live database is missing the latest reconciliation migration. Apply the newest Supabase migration, then try again.",
          saved: "Variance marked as accepted.",
        };

  if (session.demoMode) {
    return { status: "error", message: copy.demoBlocked };
  }

  const parsed = z
    .object({
      projectId: z.string().uuid(copy.invalidProject),
      checkId: z.string().uuid(copy.invalidCheck),
      reviewNote: z
        .string()
        .trim()
        .optional()
        .transform((value) => (value && value.length > 0 ? value : undefined)),
    })
    .safeParse(payload);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? copy.saveFailed,
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
    return { status: "error", message: copy.signInRequired };
  }

  const { error } = await supabase.rpc("accept_reconciliation_check", {
    p_check_id: parsed.data.checkId,
    p_review_note: parsed.data.reviewNote ?? null,
  });

  if (error) {
    return {
      status: "error",
      message: isMissingReconciliationUpgrade(error, ["accept_reconciliation_check"])
        ? copy.missingMigration
        : error.message,
    };
  }

  revalidateProjectPaths(parsed.data.projectId);

  return {
    status: "success",
    message: copy.saved,
  };
}

export async function postReconciliationAdjustmentAction(payload: {
  projectId: string;
  checkId: string;
  reviewNote?: string;
}): Promise<ReconciliationActionState> {
  const { locale, text } = await getServerI18n();
  const session = await getSessionState();
  const copy =
    locale === "vi"
      ? {
          demoBlocked: "Workspace mẫu không cho post adjustment live.",
          invalidProject: "Thiếu project ID hợp lệ.",
          invalidCheck: "Thiếu reconciliation check hợp lệ.",
          saveFailed: "Không thể ghi điều chỉnh sau đối chiếu.",
          signInRequired: "Bạn cần đăng nhập trước khi ghi adjustment.",
          missingMigration:
            "Database live đang thiếu migration reconciliation mới nhất. Hãy apply migration Supabase mới nhất rồi thử lại.",
          saved: "Đã ghi adjustment vào ledger.",
        }
      : {
          demoBlocked:
            "Posting a live reconciliation adjustment is disabled in the sample workspace.",
          invalidProject: "Missing valid project ID.",
          invalidCheck: "Missing valid reconciliation check.",
          saveFailed: "Unable to post reconciliation adjustment.",
          signInRequired:
            "You must be signed in before posting an adjustment.",
          missingMigration:
            "The live database is missing the latest reconciliation migration. Apply the newest Supabase migration, then try again.",
          saved: "Reconciliation adjustment posted to the ledger.",
        };

  if (session.demoMode) {
    return { status: "error", message: copy.demoBlocked };
  }

  const parsed = z
    .object({
      projectId: z.string().uuid(copy.invalidProject),
      checkId: z.string().uuid(copy.invalidCheck),
      reviewNote: z
        .string()
        .trim()
        .optional()
        .transform((value) => (value && value.length > 0 ? value : undefined)),
    })
    .safeParse(payload);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? copy.saveFailed,
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
    return { status: "error", message: copy.signInRequired };
  }

  const { error } = await supabase.rpc("post_reconciliation_adjustment", {
    p_check_id: parsed.data.checkId,
    p_effective_at: new Date().toISOString(),
    p_description: locale === "vi" ? "Điều chỉnh sau đối chiếu" : "Reconciliation adjustment",
    p_review_note: parsed.data.reviewNote ?? null,
  });

  if (error) {
    return {
      status: "error",
      message: isMissingReconciliationUpgrade(error, ["post_reconciliation_adjustment"])
        ? copy.missingMigration
        : error.message,
    };
  }

  revalidateProjectPaths(parsed.data.projectId);

  return {
    status: "success",
    message: copy.saved,
  };
}

export async function closeReconciliationRunAction(payload: {
  projectId: string;
  runId: string;
  note?: string;
}): Promise<ReconciliationActionState> {
  const { locale, text } = await getServerI18n();
  const session = await getSessionState();
  const copy =
    locale === "vi"
      ? {
          demoBlocked: "Workspace mẫu không cho đóng đợt đối chiếu live.",
          invalidProject: "Thiếu project ID hợp lệ.",
          invalidRun: "Thiếu reconciliation run hợp lệ.",
          closeFailed: "Không thể đóng đợt đối chiếu.",
          signInRequired: "Bạn cần đăng nhập trước khi đóng đợt đối chiếu.",
          missingMigration:
            "Database live đang thiếu migration reconciliation mới nhất. Hãy apply migration Supabase mới nhất rồi thử lại.",
          closed: "Đã đóng đợt đối chiếu.",
        }
      : {
          demoBlocked:
            "Closing a live reconciliation run is disabled in the sample workspace.",
          invalidProject: "Missing valid project ID.",
          invalidRun: "Missing valid reconciliation run.",
          closeFailed: "Unable to close reconciliation run.",
          signInRequired:
            "You must be signed in before closing reconciliation.",
          missingMigration:
            "The live database is missing the latest reconciliation migration. Apply the newest Supabase migration, then try again.",
          closed: "Reconciliation run closed.",
        };

  if (session.demoMode) {
    return { status: "error", message: copy.demoBlocked };
  }

  const parsed = z
    .object({
      projectId: z.string().uuid(copy.invalidProject),
      runId: z.string().uuid(copy.invalidRun),
      note: z
        .string()
        .trim()
        .optional()
        .transform((value) => (value && value.length > 0 ? value : undefined)),
    })
    .safeParse(payload);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? copy.closeFailed,
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
    return { status: "error", message: copy.signInRequired };
  }

  const { error } = await supabase.rpc("close_reconciliation_run", {
    p_run_id: parsed.data.runId,
    p_note: parsed.data.note ?? null,
  });

  if (error) {
    return {
      status: "error",
      message: isMissingReconciliationUpgrade(error, ["close_reconciliation_run"])
        ? copy.missingMigration
        : error.message,
    };
  }

  revalidateProjectPaths(parsed.data.projectId);

  return {
    status: "success",
    message: copy.closed,
  };
}
