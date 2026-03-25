"use client";

import { useMemo, useState } from "react";

import { useLocale } from "@/components/app/locale-provider";
import { TableSurface, TableToolbar } from "@/components/finance/table-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type ProjectSnapshot,
  type ReconciliationCheckView,
} from "@/lib/finance/types";
import { formatSignedCurrency } from "@/lib/format";
import { normalizeSearchText } from "@/lib/search";
import { cn } from "@/lib/utils";

function statusTone(status: string) {
  if (status === "matched") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (status === "variance_found") {
    return "bg-rose-100 text-rose-800";
  }
  if (status === "pending") {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-slate-100 text-slate-700";
}

function getStatusLabel(status: string, locale: "en" | "vi") {
  if (locale === "vi") {
    if (status === "matched") {
      return "Khop";
    }
    if (status === "variance_found") {
      return "Co chenh lech";
    }
    if (status === "accepted") {
      return "Da chap nhan";
    }
    if (status === "adjustment_posted") {
      return "Da ghi dieu chinh";
    }
    return "Dang cho";
  }

  return status.replaceAll("_", " ");
}

export type ReconciliationStatusFilter =
  | "all"
  | "pending"
  | "matched"
  | "variance_found"
  | "accepted"
  | "adjustment_posted";

function getSubmissionLabel(
  checkView: ReconciliationCheckView,
  locale: "en" | "vi",
  profilesById: Map<string, ProjectSnapshot["dataset"]["profiles"][number]>
) {
  const { check, profile } = checkView;

  if (!check.submittedAt) {
    return locale === "vi" ? "Chua gui" : "Not submitted yet";
  }

  const submittedByName =
    (check.submittedBy ? profilesById.get(check.submittedBy)?.displayName : null) ??
    (locale === "vi" ? "Da gui" : "Submitted");

  if (check.submittedBy && check.submittedBy !== profile.userId) {
    return locale === "vi"
      ? `${submittedByName} (gui ho)`
      : `${submittedByName} (on behalf)`;
  }

  return submittedByName;
}

export function ProjectReconciliationTable({
  snapshot,
  statusFilter: controlledStatusFilter,
  onStatusFilterChange,
  canResolvePending = false,
  onResolveCheck,
  activeResolveCheckId,
}: {
  snapshot: ProjectSnapshot;
  statusFilter?: ReconciliationStatusFilter;
  onStatusFilterChange?: (value: ReconciliationStatusFilter) => void;
  canResolvePending?: boolean;
  onResolveCheck?: (check: ReconciliationCheckView) => void;
  activeResolveCheckId?: string | null;
}) {
  const { locale } = useLocale();
  const run = snapshot.openReconciliation;
  const [search, setSearch] = useState("");
  const [uncontrolledStatusFilter, setUncontrolledStatusFilter] =
    useState<ReconciliationStatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<
    "variance_desc" | "name_asc" | "expected_desc"
  >("variance_desc");
  const statusFilter = controlledStatusFilter ?? uncontrolledStatusFilter;
  const setStatusFilter = onStatusFilterChange ?? setUncontrolledStatusFilter;
  const profilesById = useMemo(
    () => new Map(snapshot.dataset.profiles.map((profile) => [profile.userId, profile])),
    [snapshot.dataset.profiles]
  );

  const copy =
    locale === "vi"
      ? {
          searchLabel: "Tim kiem",
          searchPlaceholder: "Tim theo ten thanh vien, ghi chu, nguoi gui...",
          status: "Trang thai",
          sort: "Sap xep",
          allStatuses: "Tat ca trang thai",
          sortByVariance: "Chenh lech lon nhat",
          sortByName: "Ten A-Z",
          sortByExpected: "Tien he thong lon nhat",
          showing: (count: number) => `${count} dong doi chieu dang hien thi.`,
          empty: "Khong co dong doi chieu nao khop voi tim kiem hoac bo loc hien tai.",
          pending: "Dang cho",
          member: "Thanh vien",
          expectedProjectCash: "Tien du an theo he thong",
          reportedProjectCash: "Tien du an bao cao",
          variance: "Chenh lech",
          submission: "Nguoi gui",
          memberNote: "Ghi chu thanh vien",
          actions: "Thao tac",
          resolve: "Giai quyet",
        }
      : {
          searchLabel: "Search",
          searchPlaceholder: "Search member name, note, or submitter...",
          status: "Status",
          sort: "Sort",
          allStatuses: "All statuses",
          sortByVariance: "Highest variance",
          sortByName: "Name A-Z",
          sortByExpected: "Highest expected cash",
          showing: (count: number) => `${count} reconciliation rows shown.`,
          empty: "No reconciliation rows match the current search or filters.",
          pending: "Pending",
          member: "Member",
          expectedProjectCash: "Expected project cash",
          reportedProjectCash: "Reported project cash",
          variance: "Variance",
          submission: "Submitted by",
          memberNote: "Member note",
          actions: "Actions",
          resolve: "Resolve",
        };

  const displayedChecks = useMemo(() => {
    if (!run) {
      return [];
    }

    const normalizedSearch = normalizeSearchText(search);

    return [...run.checks]
      .filter((checkView) => {
        const { check, profile } = checkView;

        if (statusFilter !== "all" && check.status !== statusFilter) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return (
          normalizeSearchText(profile.displayName).includes(normalizedSearch) ||
          normalizeSearchText(check.memberNote).includes(normalizedSearch) ||
          normalizeSearchText(
            getSubmissionLabel(checkView, locale, profilesById)
          ).includes(normalizedSearch)
        );
      })
      .sort((left, right) => {
        if (sortOrder === "name_asc") {
          return left.profile.displayName.localeCompare(
            right.profile.displayName,
            locale
          );
        }

        if (sortOrder === "expected_desc") {
          return right.check.expectedProjectCash - left.check.expectedProjectCash;
        }

        return (
          Math.abs(right.check.varianceAmount ?? 0) -
          Math.abs(left.check.varianceAmount ?? 0)
        );
      });
  }, [locale, profilesById, run, search, sortOrder, statusFilter]);

  if (!run) {
    return null;
  }

  return (
    <div className="space-y-4">
      <TableToolbar
        searchLabel={copy.searchLabel}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={copy.searchPlaceholder}
        resultLabel={copy.showing(displayedChecks.length)}
        filters={[
          {
            key: "reconciliation-status",
            label: copy.status,
            value: statusFilter,
            onValueChange: (value) =>
              setStatusFilter(value as ReconciliationStatusFilter),
            options: [
              { value: "all", label: copy.allStatuses },
              { value: "pending", label: getStatusLabel("pending", locale) },
              { value: "matched", label: getStatusLabel("matched", locale) },
              {
                value: "variance_found",
                label: getStatusLabel("variance_found", locale),
              },
              { value: "accepted", label: getStatusLabel("accepted", locale) },
              {
                value: "adjustment_posted",
                label: getStatusLabel("adjustment_posted", locale),
              },
            ],
          },
          {
            key: "reconciliation-sort",
            label: copy.sort,
            value: sortOrder,
            onValueChange: (value) =>
              setSortOrder(value as "variance_desc" | "name_asc" | "expected_desc"),
            options: [
              { value: "variance_desc", label: copy.sortByVariance },
              { value: "expected_desc", label: copy.sortByExpected },
              { value: "name_asc", label: copy.sortByName },
            ],
          },
        ]}
      />

      <TableSurface>
        <Table className="min-w-[1240px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">{copy.member}</TableHead>
              <TableHead className="w-[180px]">{copy.expectedProjectCash}</TableHead>
              <TableHead className="w-[180px]">{copy.reportedProjectCash}</TableHead>
              <TableHead className="w-[160px]">{copy.variance}</TableHead>
              <TableHead className="w-[150px]">{copy.status}</TableHead>
              <TableHead className="w-[220px]">{copy.submission}</TableHead>
              <TableHead className="min-w-[260px] whitespace-normal">
                {copy.memberNote}
              </TableHead>
              <TableHead className="w-[140px]">{copy.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedChecks.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center whitespace-normal text-slate-500"
                >
                  {copy.empty}
                </TableCell>
              </TableRow>
            ) : (
              displayedChecks.map((checkView) => {
                const { check, profile } = checkView;

                return (
                  <TableRow
                    key={check.id}
                    className={cn(
                      activeResolveCheckId === check.id ? "bg-emerald-50/60" : null
                    )}
                  >
                    <TableCell>{profile.displayName}</TableCell>
                    <TableCell>
                      {formatSignedCurrency(
                        check.expectedProjectCash,
                        snapshot.dataset.project.currencyCode,
                        locale
                      )}
                    </TableCell>
                    <TableCell>
                      {check.reportedProjectCash == null
                        ? copy.pending
                        : formatSignedCurrency(
                            check.reportedProjectCash,
                            snapshot.dataset.project.currencyCode,
                            locale
                          )}
                    </TableCell>
                    <TableCell>
                      {check.varianceAmount == null
                        ? copy.pending
                        : formatSignedCurrency(
                            check.varianceAmount,
                            snapshot.dataset.project.currencyCode,
                            locale
                          )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("rounded-full", statusTone(check.status))}>
                        {getStatusLabel(check.status, locale)}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-normal text-slate-600">
                      {getSubmissionLabel(checkView, locale, profilesById)}
                    </TableCell>
                    <TableCell className="whitespace-normal text-slate-600">
                      {check.memberNote ?? "—"}
                    </TableCell>
                    <TableCell>
                      {canResolvePending &&
                      check.status === "pending" &&
                      typeof onResolveCheck === "function" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onResolveCheck(checkView)}
                        >
                          {copy.resolve}
                        </Button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableSurface>
    </div>
  );
}
