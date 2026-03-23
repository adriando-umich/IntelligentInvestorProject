import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, FolderTree } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { LedgerEntryPlanner } from "@/components/finance/ledger-entry-planner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionState } from "@/lib/auth/session";
import { getProjectSnapshot } from "@/lib/data/repository";
import {
  buildAllocationSharesFromAllocations,
  inferAllocationSplitMode,
} from "@/lib/finance/allocation-shares";
import {
  isPlannerEntryType,
  type PlannerEntryFormValues,
  type PlannerEntryType,
} from "@/lib/finance/entry-form";
import { type ProjectSnapshot } from "@/lib/finance/types";
import { getServerI18n } from "@/lib/i18n/server";

function getQueryValue(
  query: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = query[key];
  return Array.isArray(value) ? value[0] : value;
}

function buildEditInitialValues(
  snapshot: ProjectSnapshot,
  entryId: string
): {
  entryId: string;
  entryType: PlannerEntryType;
  initialValues: Partial<PlannerEntryFormValues>;
} | null {
  const entry = snapshot.dataset.entries.find((candidate) => candidate.id === entryId);

  if (!entry || entry.status !== "posted" || !isPlannerEntryType(entry.entryType)) {
    return null;
  }

  const allocationType =
    entry.entryType === "operating_expense" ||
    entry.entryType === "shared_loan_interest_payment"
      ? "expense_share"
      : null;

  const capitalOwnerProjectMemberId =
    entry.entryType === "capital_contribution" ||
    entry.entryType === "capital_return"
      ? (
          snapshot.dataset.allocations.find(
            (allocation) =>
              allocation.ledgerEntryId === entry.id &&
              allocation.allocationType === "capital_owner"
          )?.projectMemberId ?? ""
        )
      : "";

  const allocationProjectMemberIds = allocationType
    ? snapshot.dataset.allocations
        .filter(
          (allocation) =>
            allocation.ledgerEntryId === entry.id &&
            allocation.allocationType === allocationType
        )
        .map((allocation) => allocation.projectMemberId)
    : [];
  const allocationRows = allocationType
    ? snapshot.dataset.allocations.filter(
        (allocation) =>
          allocation.ledgerEntryId === entry.id &&
          allocation.allocationType === allocationType
      )
    : [];
  const allocationShares = allocationType
    ? buildAllocationSharesFromAllocations(
        allocationProjectMemberIds,
        entry.amount,
        allocationRows
      )
    : [];
  const allocationSplitMode = inferAllocationSplitMode(allocationShares);

  const entryTagIds = snapshot.dataset.entryTags
    .filter((entryTag) => entryTag.ledgerEntryId === entry.id)
    .map((entryTag) => entryTag.projectTagId);

  const tagNamesText = snapshot.dataset.tags
    .filter((tag) => entryTagIds.includes(tag.id))
    .map((tag) => tag.name)
    .join(", ");

  return {
    entryId: entry.id,
    entryType: entry.entryType,
    initialValues: {
      projectId: snapshot.dataset.project.id,
      currencyCode: snapshot.dataset.project.currencyCode,
      entryType: entry.entryType,
      description: entry.description,
      amount: entry.amount,
      effectiveDate: entry.effectiveAt.slice(0, 10),
      cashInProjectMemberId: entry.cashInMemberId ?? "",
      cashOutProjectMemberId: entry.cashOutMemberId ?? "",
      capitalOwnerProjectMemberId,
      allocationProjectMemberIds,
      allocationSplitMode,
      allocationShares,
      tagNamesText,
      externalCounterparty: entry.externalCounterparty ?? "",
      note: entry.note ?? "",
    },
  };
}

export default async function NewLedgerEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const [{ locale }, snapshot, session] = await Promise.all([
    getServerI18n(),
    getProjectSnapshot(projectId),
    getSessionState(),
  ]);

  if (!snapshot) {
    notFound();
  }

  const queryType = getQueryValue(query, "type");
  const queryAmount = getQueryValue(query, "amount");
  const queryFrom = getQueryValue(query, "from");
  const queryTo = getQueryValue(query, "to");
  const queryEntryId = getQueryValue(query, "entryId");
  const editState = queryEntryId
    ? buildEditInitialValues(snapshot, queryEntryId)
    : null;

  if (queryEntryId && !editState) {
    notFound();
  }

  const initialValues =
    editState?.initialValues ?? {
      projectId: snapshot.dataset.project.id,
      currencyCode: snapshot.dataset.project.currencyCode,
      entryType: isPlannerEntryType(queryType) ? queryType : undefined,
      amount: queryAmount ? Number(queryAmount) : undefined,
      cashOutProjectMemberId: queryFrom,
      cashInProjectMemberId: queryTo,
      description:
        queryType === "expense_settlement_payment" && queryFrom && queryTo
          ? "Member repayment recorded from suggestion"
          : "",
    };

  const pageCopy =
    locale === "vi"
      ? {
          eyebrow: editState ? "Sua giao dich" : "Form giao dich",
          title: editState
            ? `Sua giao dich cho ${snapshot.dataset.project.name}`
            : `Them giao dich cho ${snapshot.dataset.project.name}`,
          description: editState
            ? "Cap nhat giao dich da co. Khi luu, he thong se ghi de len transaction hien tai thay vi tao transaction moi."
            : "Dung form nay de ghi von gop, tien vao co tag, giai ngan vay chung, tra goc vay chung, tra lai vay chung, chi phi van hanh, chuyen tien noi bo hoac thanh vien tra lai tien cho nhau. Trong workspace mau, form chi o che do preview; con du an live da dang nhap co the luu truc tiep cac loai giao dich duoc ho tro len Supabase.",
          helperTitle: "Can giup chon dung loai giao dich?",
          helperDescription:
            "Form nay giu tap trung vao viec nhap lieu. Mo huong dan neu ban chua chac nen ghi loai giao dich nao, hoac sang trang tag neu can don nhom bao cao truoc.",
          openGuide: "Mo huong dan giao dich",
          manageTags: "Quan ly tag",
        }
      : {
          eyebrow: editState ? "Edit transaction" : "Ledger planner",
          title: editState
            ? `Edit a transaction for ${snapshot.dataset.project.name}`
            : `Add a transaction for ${snapshot.dataset.project.name}`,
          description: editState
            ? "Update an existing ledger entry here. Saving will overwrite the current transaction instead of creating a duplicate."
            : "Use this planner to record capital, tagged inflows, shared loan drawdowns, shared loan principal repayments, shared loan interest payments, operating expenses, project cash handovers, or member repayments. In the sample workspace it stays preview-only, while live signed-in projects can save supported transaction types directly to Supabase.",
          helperTitle: "Need help choosing the right transaction?",
          helperDescription:
            "Keep the planner focused here. Open the guide if you are unsure which transaction type to record, or jump to tag management before posting if the reporting labels need cleanup.",
          openGuide: "Open transaction guide",
          manageTags: "Manage tags",
        };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={pageCopy.eyebrow}
        title={pageCopy.title}
        description={pageCopy.description}
      />

      <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle>{pageCopy.helperTitle}</CardTitle>
          <CardDescription>{pageCopy.helperDescription}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:flex sm:flex-wrap">
          <Link
            href={`/projects/${snapshot.dataset.project.id}/ledger/guide`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 sm:w-auto"
          >
            <BookOpen className="size-4" />
            {pageCopy.openGuide}
          </Link>
          <Link
            href={`/projects/${snapshot.dataset.project.id}/tags`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            <FolderTree className="size-4" />
            {pageCopy.manageTags}
          </Link>
        </CardContent>
      </Card>

      <LedgerEntryPlanner
        projectId={snapshot.dataset.project.id}
        projectName={snapshot.dataset.project.name}
        currencyCode={snapshot.dataset.project.currencyCode}
        editingEntryId={editState?.entryId}
        editingEntryType={editState?.entryType}
        memberOptions={snapshot.memberSummaries.map((summary) => ({
          id: summary.projectMember.id,
          name: summary.profile.displayName,
          membershipStatus: summary.projectMember.membershipStatus ?? "active",
        }))}
        tagOptions={snapshot.dataset.tags.map((tag) => tag.name)}
        initialValues={initialValues}
        liveModeEnabled={!session.demoMode}
      />
    </div>
  );
}
