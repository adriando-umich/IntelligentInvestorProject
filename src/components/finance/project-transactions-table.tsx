"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, PencilLine, Trash2 } from "lucide-react";

import { voidLedgerEntryAction } from "@/app/actions/ledger";
import { useLocale } from "@/components/app/locale-provider";
import { TableSurface, TableToolbar } from "@/components/finance/table-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  isPlannerEntryType,
} from "@/lib/finance/entry-form";
import {
  type EntryFamily,
  type EntryType,
  getEntryFamily,
  getEntryFamilyLabel,
  getEntryTypeLabel,
  type ProjectSnapshot,
} from "@/lib/finance/types";
import { formatCurrency, formatDateLabel } from "@/lib/format";
import { normalizeSearchText } from "@/lib/search";
import { cn } from "@/lib/utils";

function entryTone(entryType: EntryType) {
  if (entryType === "operating_income") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (
    entryType === "shared_loan_drawdown" ||
    entryType === "shared_loan_repayment_principal" ||
    entryType === "capital_contribution" ||
    entryType === "capital_return"
  ) {
    return "bg-sky-100 text-sky-800";
  }
  if (entryType === "shared_loan_interest_payment") {
    return "bg-amber-100 text-amber-800";
  }
  if (entryType === "land_purchase") {
    return "bg-stone-100 text-stone-800";
  }
  if (entryType === "operating_expense") {
    return "bg-rose-100 text-rose-800";
  }
  if (entryType === "profit_distribution") {
    return "bg-violet-100 text-violet-800";
  }
  if (entryType === "owner_profit_payout") {
    return "bg-fuchsia-100 text-fuchsia-800";
  }
  return "bg-slate-100 text-slate-700";
}

type ActivitySort = "newest" | "oldest" | "amount_desc" | "amount_asc";

export function ProjectTransactionsTable({
  snapshot,
}: {
  snapshot: ProjectSnapshot;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState<"all" | EntryFamily>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | EntryType>("all");
  const [sortOrder, setSortOrder] = useState<ActivitySort>("newest");
  const [voidingEntryId, setVoidingEntryId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isVoiding, startVoiding] = useTransition();

  const copy =
    locale === "vi"
      ? {
          title: "Giao dich",
          description:
            "Tim, loc, sap xep, va chinh sua cac giao dich da ghi trong so cai cua du an.",
          searchPlaceholder:
            "Tim theo mo ta, loai giao dich, thanh vien, hoac tag...",
          searchLabel: "Tim kiem",
          family: "Nhom",
          type: "Loai",
          sort: "Sap xep",
          allFamilies: "Tat ca nhom",
          allTypes: "Tat ca loai",
          newest: "Moi nhat",
          oldest: "Cu nhat",
          highestAmount: "So tien giam dan",
          lowestAmount: "So tien tang dan",
          showing: (count: number) =>
            `${count} giao dich dang hien theo bo loc hien tai.`,
          empty: "Khong co giao dich nao khop voi bo loc hien tai.",
          date: "Ngay",
          summary: "Tom tat",
          tags: "Tag",
          amount: "So tien",
          directionIn: "Vao",
          directionOut: "Ra",
          recipients: "Nguoi nhan",
          noReceivingMember: "Chua co nguoi nhan tien",
          noRecipients: "Chua co nguoi nhan loi nhuan",
          noTags: "Chua gan tag",
          noOutgoingMember: "Chua co nguoi chi tien",
          edit: "Sua",
          void: "Xoa mem",
          voiding: "Dang xoa...",
          confirmVoid:
            "Xoa mem giao dich nay? Giao dich se bien mat khoi danh sach mac dinh nhung van giu lich su audit.",
          voidFailed: "Khong the xoa mem giao dich nay.",
        }
      : {
          title: "Transactions",
          description:
            "Search, filter, sort, and update the ledger entries recorded for this project.",
          searchPlaceholder:
            "Search description, transaction type, member, or tag...",
          searchLabel: "Search",
          family: "Family",
          type: "Type",
          sort: "Sort",
          allFamilies: "All families",
          allTypes: "All types",
          newest: "Newest first",
          oldest: "Oldest first",
          highestAmount: "Highest amount",
          lowestAmount: "Lowest amount",
          showing: (count: number) =>
            `${count} transactions shown with the current filters.`,
          empty: "No transactions match the current search or filters.",
          date: "Date",
          summary: "Summary",
          tags: "Tags",
          amount: "Amount",
          directionIn: "In",
          directionOut: "Out",
          recipients: "Recipients",
          noReceivingMember: "No receiving member",
          noRecipients: "No profit recipients",
          noTags: "No tags",
          noOutgoingMember: "No outgoing member",
          edit: "Edit",
          void: "Void",
          voiding: "Voiding...",
          confirmVoid:
            "Void this transaction? It will disappear from the default list, but the audit trail stays intact.",
          voidFailed: "Unable to void this transaction.",
        };

  const profileNames = useMemo(() => {
    const map = new Map<string, string>();

    for (const summary of snapshot.memberSummaries) {
      map.set(summary.projectMember.id, summary.profile.displayName);
      map.set(summary.projectMember.userId, summary.profile.displayName);
    }

    return map;
  }, [snapshot.memberSummaries]);

  const tagNameById = useMemo(
    () => new Map(snapshot.dataset.tags.map((tag) => [tag.id, tag.name])),
    [snapshot.dataset.tags]
  );

  const tagNamesByEntryId = useMemo(() => {
    const map = new Map<string, string[]>();

    for (const entryTag of snapshot.dataset.entryTags) {
      const current = map.get(entryTag.ledgerEntryId) ?? [];
      const tagName = tagNameById.get(entryTag.projectTagId);

      if (tagName) {
        current.push(tagName);
        map.set(entryTag.ledgerEntryId, current);
      }
    }

    return map;
  }, [snapshot.dataset.entryTags, tagNameById]);

  const profitRecipientsByEntryId = useMemo(() => {
    const map = new Map<string, string[]>();

    for (const allocation of snapshot.dataset.allocations) {
      if (allocation.allocationType !== "profit_share") {
        continue;
      }

      const current = map.get(allocation.ledgerEntryId) ?? [];
      current.push(
        profileNames.get(allocation.projectMemberId) ?? allocation.projectMemberId
      );
      map.set(allocation.ledgerEntryId, current);
    }

    return map;
  }, [profileNames, snapshot.dataset.allocations]);

  const typeOptions = useMemo(
    () => [
      { value: "all", label: copy.allTypes },
      ...Array.from(
        new Set(
          snapshot.dataset.entries
            .filter((entry) => entry.status === "posted")
            .map((entry) => entry.entryType)
        )
      )
        .sort((left, right) =>
          getEntryTypeLabel(left, locale).localeCompare(
            getEntryTypeLabel(right, locale),
            locale
          )
        )
        .map((entryType) => ({
          value: entryType,
          label: getEntryTypeLabel(entryType, locale),
        })),
    ],
    [copy.allTypes, locale, snapshot.dataset.entries]
  );

  const filteredEntries = useMemo(() => {
    const normalizedSearch = normalizeSearchText(search);

    return snapshot.dataset.entries
      .filter((entry) => entry.status === "posted")
      .filter((entry) => {
        if (familyFilter !== "all" && getEntryFamily(entry.entryType) !== familyFilter) {
          return false;
        }

        if (typeFilter !== "all" && entry.entryType !== typeFilter) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const searchParts = [
          entry.description,
          entry.note ?? "",
          getEntryTypeLabel(entry.entryType, locale),
          getEntryFamilyLabel(getEntryFamily(entry.entryType), locale),
          profileNames.get(entry.cashInMemberId ?? "") ?? "",
          profileNames.get(entry.cashOutMemberId ?? "") ?? "",
          ...(profitRecipientsByEntryId.get(entry.id) ?? []),
          ...(tagNamesByEntryId.get(entry.id) ?? []),
        ];

        return searchParts.some((value) =>
          normalizeSearchText(value).includes(normalizedSearch)
        );
      })
      .sort((left, right) => {
        if (sortOrder === "oldest") {
          return (
            new Date(left.effectiveAt).getTime() -
            new Date(right.effectiveAt).getTime()
          );
        }

        if (sortOrder === "amount_desc") {
          return right.amount - left.amount;
        }

        if (sortOrder === "amount_asc") {
          return left.amount - right.amount;
        }

        return (
          new Date(right.effectiveAt).getTime() -
          new Date(left.effectiveAt).getTime()
        );
      });
  }, [
    familyFilter,
    locale,
    profileNames,
    profitRecipientsByEntryId,
    search,
    snapshot.dataset.entries,
    sortOrder,
    tagNamesByEntryId,
    typeFilter,
  ]);

  function handleVoid(entryId: string) {
    if (!window.confirm(copy.confirmVoid)) {
      return;
    }

    setActionError(null);
    setVoidingEntryId(entryId);

    startVoiding(async () => {
      const result = await voidLedgerEntryAction({
        projectId: snapshot.dataset.project.id,
        ledgerEntryId: entryId,
      });

      if (result.status === "error") {
        setActionError(result.message ?? copy.voidFailed);
        setVoidingEntryId(null);
        return;
      }

      router.refresh();
    });
  }

  return (
    <CardShell title={copy.title} description={copy.description}>
      <TableToolbar
        searchLabel={copy.searchLabel}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={copy.searchPlaceholder}
        resultLabel={copy.showing(filteredEntries.length)}
        filters={[
          {
            key: "family",
            label: copy.family,
            value: familyFilter,
            onValueChange: (value) =>
              setFamilyFilter(value as "all" | EntryFamily),
            options: [
              { value: "all", label: copy.allFamilies },
              {
                value: "business",
                label: getEntryFamilyLabel("business", locale),
              },
              {
                value: "correction",
                label: getEntryFamilyLabel("correction", locale),
              },
            ],
          },
          {
            key: "type",
            label: copy.type,
            value: typeFilter,
            onValueChange: (value) => setTypeFilter(value as "all" | EntryType),
            options: typeOptions,
          },
          {
            key: "sort",
            label: copy.sort,
            value: sortOrder,
            onValueChange: (value) => setSortOrder(value as ActivitySort),
            options: [
              { value: "newest", label: copy.newest },
              { value: "oldest", label: copy.oldest },
              { value: "amount_desc", label: copy.highestAmount },
              { value: "amount_asc", label: copy.lowestAmount },
            ],
          },
        ]}
      />

      {actionError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {actionError}
        </div>
      ) : null}

      <TableSurface>
        <Table className="min-w-[1060px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[130px]">{copy.date}</TableHead>
              <TableHead className="w-[220px]">{copy.type}</TableHead>
              <TableHead className="min-w-[420px] whitespace-normal">
                {copy.summary}
              </TableHead>
              <TableHead className="min-w-[220px] whitespace-normal">
                {copy.tags}
              </TableHead>
              <TableHead className="w-[170px] text-right">{copy.amount}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center whitespace-normal text-slate-500"
                >
                  {copy.empty}
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((entry) => {
                const tags = tagNamesByEntryId.get(entry.id) ?? [];
                const inName = profileNames.get(entry.cashInMemberId ?? "");
                const outName = profileNames.get(entry.cashOutMemberId ?? "");
                const profitRecipients = profitRecipientsByEntryId.get(entry.id) ?? [];
                const canEdit = isPlannerEntryType(entry.entryType);
                const isRowVoiding = isVoiding && voidingEntryId === entry.id;

                return (
                  <TableRow key={entry.id}>
                    <TableCell className="align-top text-sm text-slate-600">
                      {formatDateLabel(entry.effectiveAt, locale)}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap gap-2">
                        <Badge className={cn("rounded-full", entryTone(entry.entryType))}>
                          {getEntryTypeLabel(entry.entryType, locale)}
                        </Badge>
                        <Badge className="rounded-full bg-white text-slate-700 ring-1 ring-slate-200">
                          {getEntryFamilyLabel(getEntryFamily(entry.entryType), locale)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="align-top whitespace-normal">
                      <div className="space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-2">
                            <p className="font-medium text-slate-950">{entry.description}</p>
                            <div className="space-y-1 text-sm text-slate-500">
                              {entry.entryType === "profit_distribution" ||
                              entry.entryType === "owner_profit_payout" ? (
                                <p>
                                  {copy.recipients}:{" "}
                                  {profitRecipients.length > 0
                                    ? profitRecipients.join(", ")
                                    : copy.noRecipients}
                                </p>
                              ) : (
                                <p>
                                  {copy.directionIn}: {inName ?? copy.noReceivingMember}
                                </p>
                              )}
                              <p>
                                {copy.directionOut}: {outName ?? copy.noOutgoingMember}
                              </p>
                              {entry.note ? <p>{entry.note}</p> : null}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            {canEdit ? (
                              <Link
                                href={`/projects/${snapshot.dataset.project.id}/ledger/new?entryId=${entry.id}`}
                                className={cn(
                                  buttonVariants({ variant: "outline", size: "xs" }),
                                  "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                                )}
                              >
                                <PencilLine className="size-3.5" />
                                {copy.edit}
                              </Link>
                            ) : null}
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              disabled={isRowVoiding}
                              onClick={() => handleVoid(entry.id)}
                            >
                              {isRowVoiding ? (
                                <LoaderCircle className="size-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="size-3.5" />
                              )}
                              {isRowVoiding ? copy.voiding : copy.void}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top whitespace-normal">
                      {tags.length === 0 ? (
                        <span className="text-sm text-slate-400">{copy.noTags}</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {tags.map((tagName) => (
                            <Badge
                              key={`${entry.id}-${tagName}`}
                              className="rounded-full bg-slate-100 text-slate-700"
                            >
                              {tagName}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="align-top text-right font-semibold text-slate-950">
                      {formatCurrency(entry.amount, entry.currencyCode, locale)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableSurface>
    </CardShell>
  );
}

function CardShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6">
      <div className="mb-5 space-y-1">
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
