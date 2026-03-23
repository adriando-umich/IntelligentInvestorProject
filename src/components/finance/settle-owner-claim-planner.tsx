"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeftRight, PiggyBank, Wallet } from "lucide-react";

import {
  createClaimSettlementAction,
  type LedgerActionState,
} from "@/app/actions/ledger";
import { useLocale } from "@/components/app/locale-provider";
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
import { formatCurrency } from "@/lib/format";

type ClaimMember = {
  id: string;
  name: string;
  capitalBalance: number;
  estimatedProfitShare: number;
};

type PayerOption = {
  id: string;
  name: string;
  membershipStatus: "active" | "pending_invite";
};

type ClaimSettlementFormValues = {
  effectiveDate: string;
  description: string;
  cashOutProjectMemberId: string;
  capitalReturnAmount: number;
  profitPayoutAmount: number;
  note?: string;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function buildSchema(locale: "en" | "vi", capitalAvailable: number, profitAvailable: number) {
  const copy =
    locale === "vi"
      ? {
          effectiveDate: "Hay chon ngay hieu luc.",
          description: "Hay viet mo ta ngan cho bo giao dich nay.",
          payer: "Hay chon nguoi chi tien du an.",
          amountsRequired: "Hay nhap it nhat mot so tien lon hon 0.",
          capitalLimit: "Phan hoan von vuot qua so du von hien tai.",
          profitLimit: "Phan tra loi nhuan vuot qua phan loi nhuan currently available.",
          negativeAmount: "So tien khong duoc am.",
        }
      : {
          effectiveDate: "Choose the effective date.",
          description: "Add a short description for this settlement.",
          payer: "Choose who is paying the project money out.",
          amountsRequired: "Enter at least one amount greater than zero.",
          capitalLimit: "Capital return exceeds the member's current invested capital.",
          profitLimit: "Profit payout exceeds the member's currently available profit claim.",
          negativeAmount: "Amounts cannot be negative.",
        };

  return z
    .object({
      effectiveDate: z.string().min(1, copy.effectiveDate),
      description: z.string().trim().min(5, copy.description),
      cashOutProjectMemberId: z.string().min(1, copy.payer),
      capitalReturnAmount: z.coerce.number().min(0, copy.negativeAmount),
      profitPayoutAmount: z.coerce.number().min(0, copy.negativeAmount),
      note: z.string().optional(),
    })
    .superRefine((value, ctx) => {
      if (value.capitalReturnAmount <= 0 && value.profitPayoutAmount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: copy.amountsRequired,
          path: ["capitalReturnAmount"],
        });
      }

      if (value.capitalReturnAmount - capitalAvailable > 0.01) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: copy.capitalLimit,
          path: ["capitalReturnAmount"],
        });
      }

      if (value.profitPayoutAmount - profitAvailable > 0.01) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: copy.profitLimit,
          path: ["profitPayoutAmount"],
        });
      }
    });
}

export function SettleOwnerClaimPlanner({
  projectId,
  currencyCode,
  claimMember,
  payerOptions,
  liveModeEnabled,
}: {
  projectId: string;
  currencyCode: string;
  claimMember: ClaimMember;
  payerOptions: PayerOption[];
  liveModeEnabled: boolean;
}) {
  const { locale } = useLocale();
  const router = useRouter();
  const [previewSaved, setPreviewSaved] = useState(false);
  const [liveState, setLiveState] = useState<LedgerActionState>({
    status: "idle",
  });
  const [isSavingLive, startSavingLive] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const capitalAvailable = roundMoney(Math.max(claimMember.capitalBalance, 0));
  const profitAvailable = roundMoney(Math.max(claimMember.estimatedProfitShare, 0));
  const pendingSuffix = locale === "vi" ? " (cho chap nhan)" : " (pending)";
  const schema = useMemo(
    () => buildSchema(locale, capitalAvailable, profitAvailable),
    [capitalAvailable, locale, profitAvailable]
  );
  const copy =
    locale === "vi"
      ? {
          title: "Settle owner claim",
          description:
            "Nhap mot lan de ghi nhan phan hoan von, phan tra loi nhuan, hoac ca hai cho thanh vien nay. App se tao cac transaction can thiet o phia duoi.",
          targetMember: "Thanh vien dang duoc settle",
          capitalAvailable: "Von co the hoan hien tai",
          profitAvailable: "Loi nhuan co the tra hien tai",
          effectiveDate: "Ngay hieu luc",
          descriptionLabel: "Mo ta",
          descriptionPlaceholder: "Vi du: Rut tien mat cho My Nguyen",
          paidBy: "Ai dang chi tien du an ra",
          choosePayer: "Hay chon nguoi chi tien",
          capitalReturn: "Hoan von ngay bay gio",
          profitPayout: "Tra loi nhuan ngay bay gio",
          note: "Ghi chu",
          notePlaceholder: "Tu chon",
          savePreview: "Luu preview",
          createBundle: "Tao bundle settle claim",
          saving: "Dang luu...",
          useStandardPlanner: "Mo planner thuong",
          bundlePreview: "Bundle se duoc tao",
          totalCashOut: "Tong tien mat tra ra",
          capitalLeft: "Von con lai trong du an",
          profitLeft: "Loi nhuan con lai chua tra",
          noPayerSelected: "Chua chon nguoi chi",
          previewSaved: "Preview da duoc cap nhat.",
          saveStatus: "Trang thai luu",
          saveStatusDescription:
            "Luu preview de kiem tra bundle. Luu live se tao mot hoac hai transaction thuc te.",
          demoLiveDisabled:
            "Workspace mau khong cho luu live. Hay dung preview.",
          capitalEntry: "Capital return",
          profitEntry: "Owner profit payout",
        }
      : {
          title: "Settle owner claim",
          description:
            "Enter a capital return amount, a profit payout amount, or both. The app will create the matching ledger entries underneath in one save.",
          targetMember: "Member being settled",
          capitalAvailable: "Capital available to return now",
          profitAvailable: "Profit available to pay now",
          effectiveDate: "Effective date",
          descriptionLabel: "Description",
          descriptionPlaceholder: "Example: Cash payout for My Nguyen",
          paidBy: "Who is paying the project money out",
          choosePayer: "Choose a payer",
          capitalReturn: "Capital returned now",
          profitPayout: "Profit paid now",
          note: "Note",
          notePlaceholder: "Optional",
          savePreview: "Save preview",
          createBundle: "Create claim-settlement bundle",
          saving: "Saving...",
          useStandardPlanner: "Open standard planner",
          bundlePreview: "Bundle preview",
          totalCashOut: "Total cash paid out",
          capitalLeft: "Capital left invested",
          profitLeft: "Profit left undistributed",
          noPayerSelected: "No payer selected",
          previewSaved: "Preview updated.",
          saveStatus: "Save status",
          saveStatusDescription:
            "Preview first if you want to inspect the bundle. Live save creates one or two real transactions.",
          demoLiveDisabled:
            "The sample workspace cannot create live transactions. Use preview only.",
          capitalEntry: "Capital return",
          profitEntry: "Owner profit payout",
        };

  const form = useForm<z.input<typeof schema>, undefined, ClaimSettlementFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      effectiveDate: today,
      description:
        locale === "vi"
          ? `Settle claim cho ${claimMember.name}`
          : `Settle claim for ${claimMember.name}`,
      cashOutProjectMemberId: "",
      capitalReturnAmount: 0,
      profitPayoutAmount: 0,
      note: "",
    },
  });

  const watched = useWatch({ control: form.control }) as Partial<ClaimSettlementFormValues>;
  const capitalReturnAmount =
    typeof watched.capitalReturnAmount === "number"
      ? watched.capitalReturnAmount
      : Number(watched.capitalReturnAmount ?? 0);
  const profitPayoutAmount =
    typeof watched.profitPayoutAmount === "number"
      ? watched.profitPayoutAmount
      : Number(watched.profitPayoutAmount ?? 0);
  const totalCashOut = roundMoney(
    Math.max(capitalReturnAmount, 0) + Math.max(profitPayoutAmount, 0)
  );
  const capitalLeft = roundMoney(capitalAvailable - Math.max(capitalReturnAmount, 0));
  const profitLeft = roundMoney(profitAvailable - Math.max(profitPayoutAmount, 0));
  const payerLabel =
    payerOptions.find((payer) => payer.id === watched.cashOutProjectMemberId)?.name ??
    copy.noPayerSelected;
  const previewRows = [
    capitalReturnAmount > 0
      ? { label: copy.capitalEntry, amount: capitalReturnAmount, tone: "sky" }
      : null,
    profitPayoutAmount > 0
      ? { label: copy.profitEntry, amount: profitPayoutAmount, tone: "violet" }
      : null,
  ].filter((row): row is { label: string; amount: number; tone: "sky" | "violet" } => Boolean(row));

  function handlePreview() {
    setPreviewSaved(true);
    setLiveState({ status: "idle" });
  }

  function handleLiveSave(values: ClaimSettlementFormValues) {
    startSavingLive(async () => {
      const result = await createClaimSettlementAction({
        projectId,
        currencyCode,
        effectiveDate: values.effectiveDate,
        description: values.description,
        cashOutProjectMemberId: values.cashOutProjectMemberId,
        capitalOwnerProjectMemberId: claimMember.id,
        capitalReturnAmount: values.capitalReturnAmount,
        profitPayoutAmount: values.profitPayoutAmount,
        note: values.note,
      });

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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>{copy.title}</CardTitle>
              <CardDescription>{copy.description}</CardDescription>
            </div>
            <Link
              href={`/projects/${projectId}?view=capital`}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {copy.useStandardPlanner}
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">{copy.targetMember}</p>
                <p className="mt-2 font-medium text-slate-950">{claimMember.name}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">{copy.capitalAvailable}</p>
                <p className="mt-2 font-medium text-slate-950">
                  {formatCurrency(capitalAvailable, currencyCode, locale)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">{copy.profitAvailable}</p>
                <p className="mt-2 font-medium text-slate-950">
                  {formatCurrency(profitAvailable, currencyCode, locale)}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="settle-effective-date">{copy.effectiveDate}</Label>
                <Input
                  id="settle-effective-date"
                  type="date"
                  {...form.register("effectiveDate")}
                />
                {form.formState.errors.effectiveDate ? (
                  <p className="text-sm text-rose-600">
                    {form.formState.errors.effectiveDate.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="settle-paid-by">{copy.paidBy}</Label>
                <select
                  id="settle-paid-by"
                  {...form.register("cashOutProjectMemberId")}
                  className="flex h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">{copy.choosePayer}</option>
                  {payerOptions.map((payer) => (
                    <option key={payer.id} value={payer.id}>
                      {payer.membershipStatus === "pending_invite"
                        ? `${payer.name}${pendingSuffix}`
                        : payer.name}
                    </option>
                  ))}
                </select>
                {form.formState.errors.cashOutProjectMemberId ? (
                  <p className="text-sm text-rose-600">
                    {form.formState.errors.cashOutProjectMemberId.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settle-description">{copy.descriptionLabel}</Label>
              <Input
                id="settle-description"
                placeholder={copy.descriptionPlaceholder}
                {...form.register("description")}
              />
              {form.formState.errors.description ? (
                <p className="text-sm text-rose-600">
                  {form.formState.errors.description.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="settle-capital-return">{copy.capitalReturn}</Label>
                <Input
                  id="settle-capital-return"
                  type="number"
                  min="0"
                  step="0.01"
                  {...form.register("capitalReturnAmount", { valueAsNumber: true })}
                />
                {form.formState.errors.capitalReturnAmount ? (
                  <p className="text-sm text-rose-600">
                    {form.formState.errors.capitalReturnAmount.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="settle-profit-payout">{copy.profitPayout}</Label>
                <Input
                  id="settle-profit-payout"
                  type="number"
                  min="0"
                  step="0.01"
                  {...form.register("profitPayoutAmount", { valueAsNumber: true })}
                />
                {form.formState.errors.profitPayoutAmount ? (
                  <p className="text-sm text-rose-600">
                    {form.formState.errors.profitPayoutAmount.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settle-note">{copy.note}</Label>
              <Textarea
                id="settle-note"
                rows={3}
                placeholder={copy.notePlaceholder}
                {...form.register("note")}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-2xl sm:w-auto"
                onClick={form.handleSubmit(handlePreview)}
              >
                {copy.savePreview}
              </Button>
              <Button
                type="button"
                className="w-full rounded-2xl sm:w-auto"
                disabled={!liveModeEnabled || isSavingLive}
                onClick={form.handleSubmit(handleLiveSave)}
              >
                {isSavingLive ? copy.saving : copy.createBundle}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
          <CardHeader>
            <CardTitle>{copy.bundlePreview}</CardTitle>
            <CardDescription>{copy.saveStatusDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <p className="text-sm text-slate-500">{copy.paidBy}</p>
              <p className="mt-2 font-medium text-slate-950">{payerLabel}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <p className="text-sm text-slate-500">{copy.totalCashOut}</p>
              <p className="mt-2 font-medium text-slate-950">
                {formatCurrency(totalCashOut, currencyCode, locale)}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <PiggyBank className="size-4" />
                  <span>{copy.capitalLeft}</span>
                </div>
                <p className="mt-2 font-medium text-slate-950">
                  {formatCurrency(capitalLeft, currencyCode, locale)}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Wallet className="size-4" />
                  <span>{copy.profitLeft}</span>
                </div>
                <p className="mt-2 font-medium text-slate-950">
                  {formatCurrency(profitLeft, currencyCode, locale)}
                </p>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <ArrowLeftRight className="size-4" />
                <span>{copy.bundlePreview}</span>
              </div>
              {previewRows.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {previewRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          className={
                            row.tone === "sky"
                              ? "rounded-full bg-sky-100 text-sky-800"
                              : "rounded-full bg-violet-100 text-violet-800"
                          }
                        >
                          {row.label}
                        </Badge>
                        <span className="text-sm text-slate-600">{claimMember.name}</span>
                      </div>
                      <span className="font-medium text-slate-950">
                        {formatCurrency(row.amount, currencyCode, locale)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">{copy.saveStatusDescription}</p>
              )}
            </div>
            {previewSaved ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {copy.previewSaved}
              </div>
            ) : null}
            {!liveModeEnabled ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {copy.demoLiveDisabled}
              </div>
            ) : null}
            {liveState.status === "error" ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {liveState.message}
              </div>
            ) : null}
            {liveState.status === "success" ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {liveState.message}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
