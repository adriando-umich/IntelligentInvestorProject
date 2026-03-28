import { z } from "zod";

import { type AllocationShareInput } from "@/lib/finance/allocation-shares";
import {
  getEntryTypeLabel,
  type EntryFamily,
} from "@/lib/finance/types";
import { defaultAppLocale, type AppLocale } from "@/lib/i18n/config";

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

const allocationSplitModes = ["capital", "equal", "custom"] as const;

const allocationShareSchema = z.object({
  projectMemberId: z.string().min(1),
  weightPercent: z.coerce.number(),
});

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

export const businessPlannerEntryTypes = [
  "capital_contribution",
  "capital_return",
  "operating_income",
  "shared_loan_drawdown",
  "shared_loan_repayment_principal",
  "land_purchase",
  "shared_loan_interest_payment",
  "operating_expense",
  "cash_handover",
  "expense_settlement_payment",
  "profit_distribution",
] as const;

export const correctionPlannerEntryTypes = [
  "reconciliation_adjustment",
] as const;

export const plannerEntryTypes = [
  ...businessPlannerEntryTypes,
  ...correctionPlannerEntryTypes,
] as const;

export type PlannerEntryType = (typeof plannerEntryTypes)[number];

export function isPlannerEntryType(
  value: string | null | undefined
): value is PlannerEntryType {
  return plannerEntryTypes.includes(value as PlannerEntryType);
}

export const plannerEntryTypesByFamily = {
  business: businessPlannerEntryTypes,
  correction: correctionPlannerEntryTypes,
} as const satisfies Record<EntryFamily, readonly PlannerEntryType[]>;

export function getPlannerEntryTypesForFamily(entryFamily: EntryFamily) {
  return plannerEntryTypesByFamily[entryFamily];
}

export function entryTypeNeedsCashIn(entryType: PlannerEntryType) {
  return (
    entryType === "capital_contribution" ||
    entryType === "operating_income" ||
    entryType === "shared_loan_drawdown" ||
    entryType === "cash_handover" ||
    entryType === "expense_settlement_payment"
  );
}

export function entryTypeNeedsCashOut(entryType: PlannerEntryType) {
  return (
    entryType === "capital_return" ||
    entryType === "shared_loan_repayment_principal" ||
    entryType === "land_purchase" ||
    entryType === "shared_loan_interest_payment" ||
    entryType === "operating_expense" ||
    entryType === "cash_handover" ||
    entryType === "expense_settlement_payment" ||
    entryType === "profit_distribution"
  );
}

export function entryTypeNeedsCapitalOwner(entryType: PlannerEntryType) {
  return (
    entryType === "capital_contribution" ||
    entryType === "capital_return"
  );
}

export function entryTypeNeedsAllocation(entryType: PlannerEntryType) {
  return (
    entryType === "land_purchase" ||
    entryType === "operating_expense" ||
    entryType === "shared_loan_interest_payment"
  );
}

export function entryTypeNeedsSingleCashSide(entryType: PlannerEntryType) {
  return entryType === "reconciliation_adjustment";
}

export function getPlannerEntryLabel(
  entryType: PlannerEntryType,
  locale: AppLocale = defaultAppLocale
) {
  return getEntryTypeLabel(entryType, locale);
}

function createPlannerEntrySchemaForLocale(locale: AppLocale) {
  const validation =
    locale === "vi"
      ? {
          description:
            "Hay viet mo ta ngan de ca team hieu giao dich nay la gi.",
          amount: "So tien phai lon hon 0.",
          date: "Hay chon ngay hieu luc cua giao dich.",
          chooseReceiver: "Hay chon nguoi nhan tien du an.",
          choosePayer: "Hay chon nguoi chi tien du an.",
          handoverDifferentMembers:
            "Chuyen tien noi bo can 2 thanh vien khac nhau.",
          repaymentDifferentMembers:
            "Khoan thanh vien tra lai tien can 1 nguoi tra va 1 nguoi nhan khac nhau.",
          chooseCapitalOwner: "Hay chon nguoi co so du von can thay doi.",
          chooseAllocationMembers:
            "Hay chon cac thanh vien cung chia khoan nay.",
          allocationWeightsRequired:
            "Hay nhap ty le chia cho cac thanh vien da chon.",
          allocationWeightsMismatch:
            "Danh sach thanh vien duoc chon va ty le chia dang khong khop nhau.",
          allocationWeightsTotal:
            "Tong ty le chia phai bang 100%.",
          allocationWeightsPositive:
            "Moi thanh vien duoc chon phai co ty le chia lon hon 0%.",
          chooseOneAdjustmentSide:
            "Hay chon mot ben de dieu chinh tien du an ky vong.",
          correctionOneSideOnly:
            "Dieu chinh doi chieu chi duoc dung mot ben moi lan.",
        }
      : {
          description:
            "Add a short description so the team understands the entry.",
          amount: "Amount must be greater than zero.",
          date: "Choose the effective date for this entry.",
          chooseReceiver: "Choose who receives the project money.",
          choosePayer: "Choose who pays the project money out.",
          handoverDifferentMembers:
            "Cash handover needs two different members.",
          repaymentDifferentMembers:
            "Member repayment needs a payer and a receiver that are different members.",
          chooseCapitalOwner: "Choose whose capital balance should change.",
          chooseAllocationMembers:
            "Choose the members who should share this amount.",
          allocationWeightsRequired:
            "Add a percentage split for the selected members.",
          allocationWeightsMismatch:
            "The selected members and split rows do not match.",
          allocationWeightsTotal:
            "Split percentages must total 100%.",
          allocationWeightsPositive:
            "Each selected member must have a percentage greater than 0%.",
          chooseOneAdjustmentSide:
            "Choose one side to adjust expected project cash.",
          correctionOneSideOnly:
            "Reconciliation adjustment can only move one side at a time.",
        };

  return z
  .object({
    projectId: z.string().min(1),
    currencyCode: z.string().length(3),
    entryType: z.enum(plannerEntryTypes),
    description: z.string().trim().min(5, validation.description),
    amount: z.coerce.number().positive(validation.amount),
    effectiveDate: z.string().min(1, validation.date),
    cashInProjectMemberId: optionalString,
    cashOutProjectMemberId: optionalString,
    capitalOwnerProjectMemberId: optionalString,
    allocationProjectMemberIds: stringArray,
    allocationSplitMode: z.enum(allocationSplitModes).default("capital"),
    allocationShares: z.array(allocationShareSchema).default([]),
    tagNamesText: optionalString,
    externalCounterparty: optionalString,
    note: optionalString,
  })
  .superRefine((value, ctx) => {
    const needsCashIn = entryTypeNeedsCashIn(value.entryType);
    const needsCashOut = entryTypeNeedsCashOut(value.entryType);
    const needsCapitalOwner = entryTypeNeedsCapitalOwner(value.entryType);
    const needsAllocation = entryTypeNeedsAllocation(value.entryType);
    const needsSingleCashSide = entryTypeNeedsSingleCashSide(value.entryType);

    if (needsCashIn && !value.cashInProjectMemberId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: validation.chooseReceiver,
        path: ["cashInProjectMemberId"],
      });
    }

    if (needsCashOut && !value.cashOutProjectMemberId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: validation.choosePayer,
        path: ["cashOutProjectMemberId"],
      });
    }

    if (value.entryType === "cash_handover" && value.cashInProjectMemberId === value.cashOutProjectMemberId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: validation.handoverDifferentMembers,
        path: ["cashInProjectMemberId"],
      });
    }

    if (
      value.entryType === "expense_settlement_payment" &&
      value.cashInProjectMemberId === value.cashOutProjectMemberId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: validation.repaymentDifferentMembers,
        path: ["cashInProjectMemberId"],
      });
    }

    if (needsCapitalOwner && !value.capitalOwnerProjectMemberId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: validation.chooseCapitalOwner,
        path: ["capitalOwnerProjectMemberId"],
      });
    }

    if (needsAllocation && value.allocationProjectMemberIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: validation.chooseAllocationMembers,
        path: ["allocationProjectMemberIds"],
      });
    }

    if (needsAllocation) {
      const normalizedMemberIds = [...new Set(value.allocationProjectMemberIds)];
      const normalizedShareIds = [
        ...new Set(value.allocationShares.map((share) => share.projectMemberId)),
      ];
      const totalWeight = value.allocationShares.reduce(
        (sum, share) => sum + share.weightPercent,
        0
      );
      const sameMembership =
        normalizedMemberIds.length === normalizedShareIds.length &&
        normalizedMemberIds.every((memberId) =>
          normalizedShareIds.includes(memberId)
        );

      if (value.allocationShares.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: validation.allocationWeightsRequired,
          path: ["allocationShares"],
        });
      } else if (!sameMembership) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: validation.allocationWeightsMismatch,
          path: ["allocationShares"],
        });
      } else if (
        value.allocationShares.some(
          (share) => !Number.isFinite(share.weightPercent) || share.weightPercent <= 0
        )
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: validation.allocationWeightsPositive,
          path: ["allocationShares"],
        });
      } else if (Math.abs(totalWeight - 100) > 0.01) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: validation.allocationWeightsTotal,
          path: ["allocationShares"],
        });
      }
    }

    if (
      needsSingleCashSide &&
      !value.cashInProjectMemberId &&
      !value.cashOutProjectMemberId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: validation.chooseOneAdjustmentSide,
        path: ["cashInProjectMemberId"],
      });
    }

    if (
      needsSingleCashSide &&
      value.cashInProjectMemberId &&
      value.cashOutProjectMemberId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: validation.correctionOneSideOnly,
        path: ["cashInProjectMemberId"],
      });
    }
  });
}

export const plannerEntrySchema = createPlannerEntrySchemaForLocale(
  defaultAppLocale
);

export function getPlannerEntrySchema(locale: AppLocale) {
  return createPlannerEntrySchemaForLocale(locale);
}

export type PlannerEntryFormValues = z.input<typeof plannerEntrySchema>;
export type PlannerEntryValues = z.output<typeof plannerEntrySchema>;
export type PlannerAllocationSplitMode = (typeof allocationSplitModes)[number];
export type PlannerAllocationShare = AllocationShareInput;

export function isCapitalEntryType(entryType: PlannerEntryType) {
  return (
    entryType === "capital_contribution" || entryType === "capital_return"
  );
}

export function isAllocationEntryType(entryType: PlannerEntryType) {
  return (
    entryType === "land_purchase" ||
    entryType === "operating_expense" ||
    entryType === "shared_loan_interest_payment"
  );
}

export function supportsLiveCreate(entryType: PlannerEntryType) {
  return entryType !== "profit_distribution";
}

export function supportsLiveEdit(entryType: PlannerEntryType) {
  return plannerEntryTypes.includes(entryType);
}
