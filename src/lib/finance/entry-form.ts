import { z } from "zod";

const optionalString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().optional());

const stringArray = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0
    );
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return [value];
  }

  return [];
}, z.array(z.string()).default([]));

export function parseTagNames(value: string | undefined | null) {
  if (!value) {
    return [];
  }

  const seen = new Set<string>();

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item) => {
      const normalized = item.toLowerCase();

      if (seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });
}

export const plannerEntryTypes = [
  "capital_contribution",
  "capital_return",
  "operating_income",
  "shared_loan_drawdown",
  "shared_loan_repayment_principal",
  "operating_expense",
  "cash_handover",
  "expense_settlement_payment",
  "profit_distribution",
] as const;

export type PlannerEntryType = (typeof plannerEntryTypes)[number];

export const plannerEntrySchema = z
  .object({
    projectId: z.string().min(1),
    currencyCode: z.string().length(3),
    entryType: z.enum(plannerEntryTypes),
    description: z.string().trim().min(5, "Add a short description."),
    amount: z.coerce.number().positive("Amount must be greater than 0."),
    effectiveDate: z.string().min(1, "Choose a date."),
    cashInProjectMemberId: optionalString,
    cashOutProjectMemberId: optionalString,
    capitalOwnerProjectMemberId: optionalString,
    allocationProjectMemberIds: stringArray,
    tagNamesText: optionalString,
    externalCounterparty: optionalString,
    note: optionalString,
  })
  .superRefine((value, ctx) => {
    const needsCashIn =
      value.entryType === "capital_contribution" ||
      value.entryType === "operating_income" ||
      value.entryType === "shared_loan_drawdown" ||
      value.entryType === "cash_handover" ||
      value.entryType === "expense_settlement_payment";
    const needsCashOut =
      value.entryType === "capital_return" ||
      value.entryType === "shared_loan_repayment_principal" ||
      value.entryType === "operating_expense" ||
      value.entryType === "cash_handover" ||
      value.entryType === "expense_settlement_payment" ||
      value.entryType === "profit_distribution";
    const needsCapitalOwner =
      value.entryType === "capital_contribution" ||
      value.entryType === "capital_return";
    const needsAllocation =
      value.entryType === "operating_income" ||
      value.entryType === "operating_expense";

    if (needsCashIn && !value.cashInProjectMemberId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose who receives the money.",
        path: ["cashInProjectMemberId"],
      });
    }

    if (needsCashOut && !value.cashOutProjectMemberId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose who pays the money out.",
        path: ["cashOutProjectMemberId"],
      });
    }

    if (value.entryType === "cash_handover" && value.cashInProjectMemberId === value.cashOutProjectMemberId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cash handover must move money between two different members.",
        path: ["cashInProjectMemberId"],
      });
    }

    if (
      value.entryType === "expense_settlement_payment" &&
      value.cashInProjectMemberId === value.cashOutProjectMemberId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Settlement payment must move between two different members.",
        path: ["cashInProjectMemberId"],
      });
    }

    if (needsCapitalOwner && !value.capitalOwnerProjectMemberId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose who owns this capital movement.",
        path: ["capitalOwnerProjectMemberId"],
      });
    }

    if (needsAllocation && value.allocationProjectMemberIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one member to share this amount.",
        path: ["allocationProjectMemberIds"],
      });
    }
  });

export type PlannerEntryFormValues = z.input<typeof plannerEntrySchema>;
export type PlannerEntryValues = z.output<typeof plannerEntrySchema>;

export function isCapitalEntryType(entryType: PlannerEntryType) {
  return (
    entryType === "capital_contribution" || entryType === "capital_return"
  );
}

export function isAllocationEntryType(entryType: PlannerEntryType) {
  return entryType === "operating_income" || entryType === "operating_expense";
}

export function supportsLiveCreate(entryType: PlannerEntryType) {
  return entryType !== "profit_distribution";
}
