"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftRight, CircleAlert, PiggyBank, Wallet } from "lucide-react";

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
  isAllocationEntryType,
  isCapitalEntryType,
  plannerEntrySchema,
  supportsLiveCreate,
  type PlannerEntryFormValues,
  type PlannerEntryType,
  type PlannerEntryValues,
} from "@/lib/finance/entry-form";
import { formatCurrency } from "@/lib/format";

type MemberOption = {
  id: string;
  name: string;
};

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
  if (entryType === "operating_expense") {
    return {
      icon: <CircleAlert className="size-4" />,
      title: "Shared-expense balances may change",
      description:
        "The payer advances cash first, then the app can suggest who owes whom based on the expense allocation.",
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
      title: "Shared-expense debt gets settled",
      description:
        "This records a real payment between teammates to reduce outstanding reimbursement balances.",
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
  initialValues,
  liveModeEnabled,
}: {
  projectId: string;
  projectName: string;
  currencyCode: string;
  memberOptions: MemberOption[];
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
  const liveSupported = liveModeEnabled && supportsLiveCreate(watchedEntryType);

  function handlePreview(values: PlannerEntryValues) {
    setPreview(values);
    setLiveState({ status: "idle" });
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
            This form now collects enough information for live create on the
            main transaction types for {projectName}. Shared income and expense
            lines are split equally across the selected members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="entryType">Entry type</Label>
                <select
                  id="entryType"
                  className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-300"
                  {...form.register("entryType")}
                >
                  <option value="capital_contribution">Capital contribution</option>
                  <option value="capital_return">Capital return</option>
                  <option value="operating_income">Operating income</option>
                  <option value="operating_expense">Operating expense</option>
                  <option value="cash_handover">Cash handover</option>
                  <option value="expense_settlement_payment">
                    Expense settlement payment
                  </option>
                  <option value="profit_distribution">Profit distribution</option>
                </select>
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
                <Label htmlFor="cashOutProjectMemberId">Money out by</Label>
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
                <Label htmlFor="cashInProjectMemberId">Money in to</Label>
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
