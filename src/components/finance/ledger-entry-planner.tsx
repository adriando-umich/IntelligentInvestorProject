"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeftRight,
  BookOpen,
  CircleAlert,
  FolderTree,
  Landmark,
  PiggyBank,
  Tags,
  Wallet,
} from "lucide-react";

import {
  createLedgerEntryAction,
  type LedgerActionState,
} from "@/app/actions/ledger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getPlannerEntryLabel,
  getPlannerEntryTypesForFamily,
  isAllocationEntryType,
  isCapitalEntryType,
  parseTagNames,
  plannerEntrySchema,
  supportsLiveCreate,
  type PlannerEntryFormValues,
  type PlannerEntryType,
  type PlannerEntryValues,
} from "@/lib/finance/entry-form";
import {
  entryFamilyLabels,
  type EntryFamily,
  getEntryFamily,
} from "@/lib/finance/types";
import { formatCurrency } from "@/lib/format";

type MemberOption = {
  id: string;
  name: string;
};

function cashOutLabel(entryType: PlannerEntryType) {
  if (entryType === "reconciliation_adjustment") {
    return "Decrease expected cash for";
  }

  if (entryType === "expense_settlement_payment") {
    return "Who is paying back";
  }

  if (entryType === "cash_handover") {
    return "Who hands the money over";
  }

  return "Money out by";
}

function cashInLabel(entryType: PlannerEntryType) {
  if (entryType === "reconciliation_adjustment") {
    return "Increase expected cash for";
  }

  if (entryType === "expense_settlement_payment") {
    return "Who gets paid back";
  }

  if (entryType === "cash_handover") {
    return "Who receives the handover";
  }

  return "Money in to";
}

function memberTransferHelperCopy(entryType: PlannerEntryType) {
  if (entryType === "reconciliation_adjustment") {
    return "Use one side only. Choose increase expected cash when the app should add project money to a member, or decrease expected cash when the app should remove it after reconciliation.";
  }

  if (entryType === "expense_settlement_payment") {
    return "Example: A paid for B earlier, then B sends the money back to A. Choose B as the payer and A as the receiver.";
  }

  if (entryType === "cash_handover") {
    return "Use this when project cash is physically moved from one member to another without settling a debt.";
  }

  return null;
}

function effectCopy(entryType: PlannerEntryType) {
  if (entryType === "capital_contribution") {
    return {
      icon: <PiggyBank className="size-4" />,
      title: "Capital will change",
      description:
        "This adds to capital balance and changes future profit-sharing weight.",
    };
  }
  if (entryType === "capital_return") {
    return {
      icon: <PiggyBank className="size-4" />,
      title: "Capital will go down",
      description:
        "This returns invested capital and reduces future profit-sharing weight.",
    };
  }
  if (entryType === "operating_income") {
    return {
      icon: <Wallet className="size-4" />,
      title: "Project cash and operating profit will go up",
      description:
        "Customer money or other operating inflow increases project cash custody and project P&L, not reimbursement.",
    };
  }
  if (entryType === "shared_loan_drawdown") {
    return {
      icon: <Landmark className="size-4" />,
      title: "Borrowed money comes into the project",
      description:
        "This brings project cash in from a lender without giving capital credit to any member. Record bank interest separately as operating expense.",
    };
  }
  if (entryType === "shared_loan_repayment_principal") {
    return {
      icon: <Landmark className="size-4" />,
      title: "Borrowed principal goes back out",
      description:
        "Use this when the project repays loan principal. It reduces project cash, but it does not count as operating expense, capital return, or profit distribution. Record loan interest separately as operating expense.",
    };
  }
  if (entryType === "shared_loan_interest_payment") {
    return {
      icon: <Landmark className="size-4" />,
      title: "Loan interest becomes a project cost",
      description:
        "Use this shortcut when the project pays shared bank interest. It lowers operating P&L, can create teammate reimbursement balances, and stays separate from loan principal.",
    };
  }
  if (entryType === "operating_expense") {
    return {
      icon: <CircleAlert className="size-4" />,
      title: "Shared-expense balances may change",
      description:
        "The payer advances cash first, then the app can suggest who owes whom based on the expense allocation.",
    };
  }
  if (entryType === "reconciliation_adjustment") {
    return {
      icon: <CircleAlert className="size-4" />,
      title: "Expected project cash gets corrected",
      description:
        "Use this correction after reconciliation when one member's expected project cash needs to move up or down. Pick only one side of the cash leg.",
    };
  }
  if (entryType === "cash_handover") {
    return {
      icon: <ArrowLeftRight className="size-4" />,
      title: "Only cash custody moves",
      description:
        "This shifts who is physically holding project money. It does not change capital, reimbursement, or profit.",
    };
  }
  if (entryType === "expense_settlement_payment") {
    return {
      icon: <ArrowLeftRight className="size-4" />,
      title: "One member pays another member back",
      description:
        "Use this when one teammate returns money to another teammate after being paid for earlier. Example: A paid for B, then B pays A back.",
    };
  }
  return {
    icon: <Wallet className="size-4" />,
    title: "Profit gets paid out",
    description:
      "This flow will need a dedicated distribution action because it depends on capital weights and distribution runs.",
  };
}

export function LedgerEntryPlanner({
  projectId,
  projectName,
  currencyCode,
  memberOptions,
  tagOptions,
  initialValues,
  liveModeEnabled,
}: {
  projectId: string;
  projectName: string;
  currencyCode: string;
  memberOptions: MemberOption[];
  tagOptions: string[];
  initialValues: Partial<PlannerEntryFormValues>;
  liveModeEnabled: boolean;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<PlannerEntryValues | null>(null);
  const [liveState, setLiveState] = useState<LedgerActionState>({
    status: "idle",
  });
  const [isSavingLive, startSavingLive] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<PlannerEntryFormValues, undefined, PlannerEntryValues>({
    resolver: zodResolver(plannerEntrySchema),
    defaultValues: {
      projectId,
      currencyCode,
      entryType: initialValues.entryType ?? "operating_expense",
      description: initialValues.description ?? "",
      amount: initialValues.amount ?? 0,
      effectiveDate: initialValues.effectiveDate ?? today,
      cashInProjectMemberId: initialValues.cashInProjectMemberId ?? "",
      cashOutProjectMemberId: initialValues.cashOutProjectMemberId ?? "",
      capitalOwnerProjectMemberId:
        initialValues.capitalOwnerProjectMemberId ?? "",
      allocationProjectMemberIds: initialValues.allocationProjectMemberIds ?? [],
      tagNamesText: initialValues.tagNamesText ?? "",
      externalCounterparty: initialValues.externalCounterparty ?? "",
      note: initialValues.note ?? "",
    },
  });

  const watched = useWatch({
    control: form.control,
  }) as Partial<PlannerEntryFormValues>;

  const watchedEntryType =
    watched.entryType ?? initialValues.entryType ?? "operating_expense";
  const currentEffect = effectCopy(watchedEntryType);
  const currentAmount =
    typeof watched.amount === "number"
      ? watched.amount
      : Number(watched.amount ?? 0);
  const watchedCashOutProjectMemberId =
    typeof watched.cashOutProjectMemberId === "string"
      ? watched.cashOutProjectMemberId
      : "";
  const watchedCashInProjectMemberId =
    typeof watched.cashInProjectMemberId === "string"
      ? watched.cashInProjectMemberId
      : "";
  const watchedCapitalOwnerProjectMemberId =
    typeof watched.capitalOwnerProjectMemberId === "string"
      ? watched.capitalOwnerProjectMemberId
      : "";
  const watchedTagNamesText =
    typeof watched.tagNamesText === "string" ? watched.tagNamesText : "";
  const selectedAllocationIds = Array.isArray(watched.allocationProjectMemberIds)
    ? watched.allocationProjectMemberIds
    : [];
  const nameById = useMemo(
    () => new Map(memberOptions.map((member) => [member.id, member.name])),
    [memberOptions]
  );
  const selectedAllocationNames = selectedAllocationIds
    .map((memberId) => nameById.get(memberId))
    .filter((value): value is string => Boolean(value));
  const selectedTagNames = parseTagNames(watchedTagNamesText);
  const liveSupported = liveModeEnabled && supportsLiveCreate(watchedEntryType);
  const transferHelperCopy = memberTransferHelperCopy(watchedEntryType);
  const currentEntryFamily = getEntryFamily(watchedEntryType);
  const availableEntryTypes = getPlannerEntryTypesForFamily(currentEntryFamily);

  function changeEntryFamily(nextFamily: EntryFamily) {
    const nextType = getPlannerEntryTypesForFamily(nextFamily)[0];

    if (!nextType || nextType === watchedEntryType) {
      return;
    }

    form.setValue("entryType", nextType, {
      shouldDirty: true,
      shouldTouch: true,
    });
  }

  function handlePreview(values: PlannerEntryValues) {
    setPreview(values);
    setLiveState({ status: "idle" });
  }

  function addSuggestedTag(tagName: string) {
    const nextTags = parseTagNames(
      [watchedTagNamesText, tagName].filter(Boolean).join(", ")
    );
    form.setValue("tagNamesText", nextTags.join(", "), {
      shouldDirty: true,
      shouldTouch: true,
    });
  }

  function handleLiveCreate(values: PlannerEntryValues) {
    startSavingLive(async () => {
      const result = await createLedgerEntryAction(values);
      setLiveState(result);

      if (result.status === "success" && result.redirectTo) {
        router.push(result.redirectTo);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle>Plan a new ledger entry</CardTitle>
          <CardDescription>
            Start by choosing whether you are recording a real business event
            or a ledger correction for {projectName}. Shared income and expense
            lines are split equally across the selected members, and tags can be
            attached for later aggregation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-950">Need the full guide?</p>
                  <p className="text-sm leading-6 text-slate-600">
                    Keep this planner compact here, then open the separate guide
                    page for the full business-versus-correction matrix.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/projects/${projectId}/ledger/guide`}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <BookOpen className="size-4" />
                    Open transaction guide
                  </Link>
                  <Link
                    href={`/projects/${projectId}/tags`}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <FolderTree className="size-4" />
                    Manage tags
                  </Link>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Entry family</Label>
                <p className="text-sm text-slate-500">
                  Choose a real business event or a correction before picking
                  the exact transaction type.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ["business", "Real money happened in the project."],
                  ["correction", "Nothing new happened in real life. You are fixing the ledger."],
                ] as const).map(([family, description]) => {
                  const isActive = currentEntryFamily === family;
                  return (
                    <button
                      key={family}
                      type="button"
                      onClick={() => changeEntryFamily(family)}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        isActive
                          ? "border-teal-300 bg-teal-50 text-teal-950"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            isActive
                              ? "rounded-full bg-teal-700 text-white"
                              : "rounded-full bg-slate-900 text-white"
                          }
                        >
                          {entryFamilyLabels[family]}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm leading-6">{description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="entryType">Entry type</Label>
                <select
                  id="entryType"
                  className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-300"
                  {...form.register("entryType")}
                >
                  {availableEntryTypes.map((entryType) => (
                    <option key={entryType} value={entryType}>
                      {getPlannerEntryLabel(entryType)}
                    </option>
                  ))}
                </select>
                {currentEntryFamily === "correction" ? (
                  <p className="text-sm leading-6 text-slate-500">
                    Reversal stays in the separate guide for now because it
                    still needs a dedicated reference-to-original-entry flow.
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  {...form.register("amount")}
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="effectiveDate">Effective date</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  {...form.register("effectiveDate")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="What happened?"
                  {...form.register("description")}
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cashOutProjectMemberId">
                  {cashOutLabel(watchedEntryType)}
                </Label>
                <select
                  id="cashOutProjectMemberId"
                  className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-300"
                  {...form.register("cashOutProjectMemberId")}
                >
                  <option value="">No payer selected</option>
                  {memberOptions.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cashInProjectMemberId">
                  {cashInLabel(watchedEntryType)}
                </Label>
                <select
                  id="cashInProjectMemberId"
                  className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-300"
                  {...form.register("cashInProjectMemberId")}
                >
                  <option value="">No receiver selected</option>
                  {memberOptions.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {transferHelperCopy ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                {transferHelperCopy}
              </div>
            ) : null}

            {isCapitalEntryType(watchedEntryType) ? (
              <div className="space-y-2">
                <Label htmlFor="capitalOwnerProjectMemberId">
                  Capital owner
                </Label>
                <select
                  id="capitalOwnerProjectMemberId"
                  className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-300"
                  {...form.register("capitalOwnerProjectMemberId")}
                >
                  <option value="">Choose the capital owner</option>
                  {memberOptions.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {isAllocationEntryType(watchedEntryType) ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Members sharing this amount</Label>
                  <p className="text-sm text-slate-500">
                    The live save splits this amount equally across the selected
                    members.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {memberOptions.map((member) => {
                    const checked = selectedAllocationIds.includes(member.id);
                    return (
                      <label
                        key={member.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                          checked
                            ? "border-teal-300 bg-teal-50 text-teal-900"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          value={member.id}
                          className="size-4 rounded border-slate-300"
                          {...form.register("allocationProjectMemberIds")}
                        />
                        <span>{member.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="tagNamesText">Tags</Label>
                <p className="text-sm text-slate-500">
                  Use comma-separated tags like <span className="font-medium text-slate-700">legal, deposit, bank-loan</span> so you can group inflows and expenses later.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/projects/${projectId}/tags`}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <FolderTree className="size-3.5" />
                    Create, rename, or delete tags
                  </Link>
                </div>
              </div>
              <Input
                id="tagNamesText"
                placeholder="legal, marketing, buyer-deposit"
                {...form.register("tagNamesText")}
              />
              {tagOptions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tagOptions.map((tagName) => (
                    <Button
                      key={tagName}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      onClick={() => addSuggestedTag(tagName)}
                    >
                      <Tags className="size-3.5" />
                      {tagName}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="externalCounterparty">External counterparty</Label>
                <Input
                  id="externalCounterparty"
                  placeholder="Optional vendor, buyer, or partner"
                  {...form.register("externalCounterparty")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Notes</Label>
                <Textarea
                  id="note"
                  placeholder="Optional context, allocation note, or reminder for the team."
                  {...form.register("note")}
                />
              </div>
            </div>

            {form.formState.errors.description ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {form.formState.errors.description.message}
              </div>
            ) : null}
            {form.formState.errors.amount ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {form.formState.errors.amount.message}
              </div>
            ) : null}
            {form.formState.errors.cashInProjectMemberId ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {form.formState.errors.cashInProjectMemberId.message}
              </div>
            ) : null}
            {form.formState.errors.cashOutProjectMemberId ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {form.formState.errors.cashOutProjectMemberId.message}
              </div>
            ) : null}
            {form.formState.errors.capitalOwnerProjectMemberId ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {form.formState.errors.capitalOwnerProjectMemberId.message}
              </div>
            ) : null}
            {form.formState.errors.allocationProjectMemberIds ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {form.formState.errors.allocationProjectMemberIds.message}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
                onClick={form.handleSubmit(handlePreview)}
              >
                Save preview
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!liveSupported || isSavingLive}
                onClick={form.handleSubmit(handleLiveCreate)}
              >
                {isSavingLive ? "Saving..." : "Create live entry"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {currentEffect.icon}
              {currentEffect.title}
            </CardTitle>
            <CardDescription>{currentEffect.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-slate-900 text-white">
                {entryFamilyLabels[currentEntryFamily]}
              </Badge>
              <span className="text-sm text-slate-500">
                {currentEntryFamily === "business"
                  ? "Real-world project activity"
                  : "Ledger correction only"}
              </span>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <p className="text-sm text-slate-500">Current amount</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatCurrency(currentAmount || 0, currencyCode)}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">Money out by</p>
                <p className="mt-2 font-medium text-slate-950">
                  {watchedCashOutProjectMemberId
                    ? nameById.get(watchedCashOutProjectMemberId)
                    : "Not set"}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">Money in to</p>
                <p className="mt-2 font-medium text-slate-950">
                  {watchedCashInProjectMemberId
                    ? nameById.get(watchedCashInProjectMemberId)
                    : "Not set"}
                </p>
              </div>
            </div>
            {isCapitalEntryType(watchedEntryType) ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">Capital owner</p>
                <p className="mt-2 font-medium text-slate-950">
                  {watchedCapitalOwnerProjectMemberId
                    ? nameById.get(watchedCapitalOwnerProjectMemberId)
                    : "Not set"}
                </p>
              </div>
            ) : null}
            {isAllocationEntryType(watchedEntryType) ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">Selected allocation members</p>
                <p className="mt-2 font-medium text-slate-950">
                  {selectedAllocationNames.length > 0
                    ? selectedAllocationNames.join(", ")
                    : "No members selected yet"}
                </p>
              </div>
            ) : null}
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <p className="text-sm text-slate-500">Tags</p>
              <p className="mt-2 font-medium text-slate-950">
                {selectedTagNames.length > 0
                  ? selectedTagNames.join(", ")
                  : "No tags added yet"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
          <CardHeader>
            <CardTitle>Save status</CardTitle>
            <CardDescription>
              Preview works in every mode. Live create requires Supabase plus a
              real signed-in user.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!liveModeEnabled ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                The app is currently using demo mode, so live save is disabled.
              </div>
            ) : null}
            {liveModeEnabled && !supportsLiveCreate(watchedEntryType) ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                Profit distribution still needs a dedicated posting flow, so
                this planner only previews that entry type for now.
              </div>
            ) : null}
            {liveState.status === "error" ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                {liveState.message}
              </div>
            ) : null}
            {preview ? (
              <div className="space-y-3 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                <Badge className="rounded-full bg-emerald-100 text-emerald-800">
                  Preview saved
                </Badge>
                <p>
                  <span className="font-medium text-slate-950">Type:</span>{" "}
                  {preview.entryType.replaceAll("_", " ")}
                </p>
                <p>
                  <span className="font-medium text-slate-950">Description:</span>{" "}
                  {preview.description}
                </p>
                <p>
                  <span className="font-medium text-slate-950">Amount:</span>{" "}
                  {formatCurrency(preview.amount, currencyCode)}
                </p>
                <p>
                  <span className="font-medium text-slate-950">Tags:</span>{" "}
                  {parseTagNames(preview.tagNamesText).length > 0
                    ? parseTagNames(preview.tagNamesText).join(", ")
                    : "No tags"}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
                Fill the form and click <span className="font-medium text-slate-700">Save preview</span> to inspect the pending payload.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
