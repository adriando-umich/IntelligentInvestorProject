"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { useLocale } from "@/components/app/locale-provider";
import { TableSurface, TableToolbar } from "@/components/finance/table-toolbar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type EntryFamily,
  type EntryType,
  getEntryFamily,
  getEntryFamilyLabel,
  getEntryTypeLabel,
  type ProjectSnapshot,
} from "@/lib/finance/types";
import {
  formatCurrency,
  formatDateLabel,
} from "@/lib/format";
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
  if (entryType === "operating_expense") {
    return "bg-rose-100 text-rose-800";
  }
  if (entryType === "profit_distribution") {
    return "bg-violet-100 text-violet-800";
  }
  return "bg-slate-100 text-slate-700";
}

type ActivitySort =
  | "newest"
  | "oldest"
  | "amount_desc"
  | "amount_asc";

export function ProjectTransactionsTable({
  snapshot,
}: {
  snapshot: ProjectSnapshot;
}) {
  const { locale } = useLocale();
  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState<"all" | EntryFamily>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | EntryType>("all");
  const [sortOrder, setSortOrder] = useState<ActivitySort>("newest");

  const copy =
    locale === "vi"
      ? {
          title: "Giao dịch",
          description:
            "Tim, loc va sap xep toan bo giao dich da ghi trong so cai cua du an.",
          searchPlaceholder:
            "Tim theo mo ta, loai giao dich, thanh vien, tag...",
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
          empty: "Khong co giao dich nao khop voi tim kiem hoac bo loc hien tai.",
          date: "Ngay",
          summary: "Tom tat",
          tags: "Tag",
          amount: "So tien",
          directionIn: "Vao",
          directionOut: "Ra",
          noReceivingMember: "Chua co nguoi nhan tien",
          noTags: "Chua gan tag",
          noOutgoingMember: "Chua co nguoi chi tien",
        }
      : {
          title: "Transactions",
          description:
            "Search, filter, and sort the ledger entries recorded for this project.",
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
          noReceivingMember: "No receiving member",
          noTags: "No tags",
          noOutgoingMember: "No outgoing member",
        };

  const profileNames = useMemo(
    () =>
      new Map(
        snapshot.memberSummaries.map((summary) => [
          summary.projectMember.userId,
          summary.profile.displayName,
        ])
      ),
    [snapshot.memberSummaries]
  );

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
    const rows = snapshot.dataset.entries
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
          ...(tagNamesByEntryId.get(entry.id) ?? []),
        ];

        return searchParts.some((value) =>
          normalizeSearchText(value).includes(normalizedSearch)
        );
      })
      .sort((left, right) => {
        if (sortOrder === "oldest") {
          return (
            new Date(left.effectiveAt).getTime() - new Date(right.effectiveAt).getTime()
          );
        }

        if (sortOrder === "amount_desc") {
          return right.amount - left.amount;
        }

        if (sortOrder === "amount_asc") {
          return left.amount - right.amount;
        }

        return (
          new Date(right.effectiveAt).getTime() - new Date(left.effectiveAt).getTime()
        );
      });

    return rows;
  }, [
    familyFilter,
    locale,
    profileNames,
    search,
    snapshot.dataset.entries,
    sortOrder,
    tagNamesByEntryId,
    typeFilter,
  ]);

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

      <TableSurface>
        <Table className="min-w-[1060px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[130px]">{copy.date}</TableHead>
              <TableHead className="w-[220px]">{copy.type}</TableHead>
              <TableHead className="min-w-[360px] whitespace-normal">
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
                      <div className="space-y-2">
                        <p className="font-medium text-slate-950">{entry.description}</p>
                        <div className="space-y-1 text-sm text-slate-500">
                          <p>
                            {copy.directionIn}: {inName ?? copy.noReceivingMember}
                          </p>
                          <p>
                            {copy.directionOut}: {outName ?? copy.noOutgoingMember}
                          </p>
                          {entry.note ? <p>{entry.note}</p> : null}
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
