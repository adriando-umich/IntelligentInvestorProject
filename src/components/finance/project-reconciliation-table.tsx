"use client";

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
import { type ProjectSnapshot } from "@/lib/finance/types";
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
      return "Khớp";
    }
    if (status === "variance_found") {
      return "Có chênh lệch";
    }
    if (status === "accepted") {
      return "Đã chấp nhận";
    }
    if (status === "adjustment_posted") {
      return "Đã ghi điều chỉnh";
    }
    return "Đang chờ";
  }

  return status.replaceAll("_", " ");
}

export function ProjectReconciliationTable({
  snapshot,
}: {
  snapshot: ProjectSnapshot;
}) {
  const { locale } = useLocale();
  const run = snapshot.openReconciliation;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "matched" | "variance_found" | "accepted" | "adjustment_posted"
  >("all");
  const [sortOrder, setSortOrder] = useState<
    "variance_desc" | "name_asc" | "expected_desc"
  >("variance_desc");

  const copy =
    locale === "vi"
      ? {
          searchLabel: "Tìm kiếm",
          searchPlaceholder: "Tìm theo tên thành viên hoặc ghi chú...",
          status: "Trạng thái",
          sort: "Sắp xếp",
          allStatuses: "Tất cả trạng thái",
          sortByVariance: "Chênh lệch lớn nhất",
          sortByName: "Tên A-Z",
          sortByExpected: "Tiền hệ thống lớn nhất",
          showing: (count: number) => `${count} dòng đối chiếu đang hiển thị.`,
          empty: "Không có dòng đối chiếu nào khớp với tìm kiếm hoặc bộ lọc hiện tại.",
          pending: "Đang chờ",
          member: "Thành viên",
          expectedProjectCash: "Tiền dự án theo hệ thống",
          reportedProjectCash: "Tiền dự án báo cáo",
          variance: "Chênh lệch",
          memberNote: "Ghi chú thành viên",
        }
      : {
          searchLabel: "Search",
          searchPlaceholder: "Search member name or note...",
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
          memberNote: "Member note",
        };

  const displayedChecks = useMemo(() => {
    if (!run) {
      return [];
    }

    const normalizedSearch = normalizeSearchText(search);

    return [...run.checks]
      .filter(({ check, profile }) => {
        if (statusFilter !== "all" && check.status !== statusFilter) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return (
          normalizeSearchText(profile.displayName).includes(normalizedSearch) ||
          normalizeSearchText(check.memberNote).includes(normalizedSearch)
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

        return Math.abs(right.check.varianceAmount ?? 0) - Math.abs(left.check.varianceAmount ?? 0);
      });
  }, [locale, run, search, sortOrder, statusFilter]);

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
              setStatusFilter(
                value as
                  | "all"
                  | "pending"
                  | "matched"
                  | "variance_found"
                  | "accepted"
                  | "adjustment_posted"
              ),
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
        <Table className="min-w-[1080px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">{copy.member}</TableHead>
              <TableHead className="w-[180px]">{copy.expectedProjectCash}</TableHead>
              <TableHead className="w-[180px]">{copy.reportedProjectCash}</TableHead>
              <TableHead className="w-[160px]">{copy.variance}</TableHead>
              <TableHead className="w-[150px]">{copy.status}</TableHead>
              <TableHead className="min-w-[260px] whitespace-normal">
                {copy.memberNote}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedChecks.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center whitespace-normal text-slate-500"
                >
                  {copy.empty}
                </TableCell>
              </TableRow>
            ) : (
              displayedChecks.map(({ check, profile }) => (
                <TableRow key={check.id}>
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
                    {check.memberNote ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableSurface>
    </div>
  );
}
