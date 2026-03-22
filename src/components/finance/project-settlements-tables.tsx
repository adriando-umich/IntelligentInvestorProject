"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { useLocale } from "@/components/app/locale-provider";
import { TableSurface, TableToolbar } from "@/components/finance/table-toolbar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type ProjectSnapshot } from "@/lib/finance/types";
import { formatCurrency, formatSignedCurrency } from "@/lib/format";
import { normalizeSearchText } from "@/lib/search";

export function ProjectSettlementsTables({
  snapshot,
}: {
  snapshot: ProjectSnapshot;
}) {
  const { locale } = useLocale();
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSort, setMemberSort] = useState<"name_asc" | "balance_desc">(
    "balance_desc"
  );
  const [settlementSearch, setSettlementSearch] = useState("");
  const [settlementSort, setSettlementSort] = useState<
    "amount_desc" | "debtor_asc" | "creditor_asc"
  >("amount_desc");

  const copy =
    locale === "vi"
      ? {
          searchLabel: "Tìm kiếm",
          memberSearchPlaceholder: "Tìm theo tên thành viên...",
          settlementSearchPlaceholder: "Tìm theo người trả hoặc người nhận...",
          sort: "Sắp xếp",
          sortByName: "Tên A-Z",
          sortByBalance: "Số dư hoàn trả lớn nhất",
          sortByAmount: "Số tiền lớn nhất",
          sortByDebtor: "Người cần trả A-Z",
          sortByCreditor: "Người nhận A-Z",
          showingMembers: (count: number) => `${count} dòng thành viên đang hiển thị.`,
          showingSettlements: (count: number) => `${count} gợi ý đang hiển thị.`,
          noMembersMatch: "Không có dòng nào khớp với tìm kiếm hiện tại.",
          noSettlementsMatch: "Không có gợi ý nào khớp với tìm kiếm hiện tại.",
          recordRepayment: "Ghi nhận đã trả",
          pendingJoinRequired:
            "Cho ngÆ°á»i nÃ y tham gia trÆ°á»›c khi ghi nháº­n giao dá»‹ch tráº£ tiá»n.",
        }
      : {
          searchLabel: "Search",
          memberSearchPlaceholder: "Search member name...",
          settlementSearchPlaceholder: "Search debtor or creditor...",
          sort: "Sort",
          sortByName: "Name A-Z",
          sortByBalance: "Highest reimbursement balance",
          sortByAmount: "Highest amount",
          sortByDebtor: "Debtor A-Z",
          sortByCreditor: "Creditor A-Z",
          showingMembers: (count: number) => `${count} member rows shown.`,
          showingSettlements: (count: number) => `${count} settlement suggestions shown.`,
          noMembersMatch: "No member rows match the current search.",
          noSettlementsMatch: "No settlement suggestions match the current search.",
          recordRepayment: "Record repayment",
        };

  const displayedMembers = useMemo(() => {
    const normalizedSearch = normalizeSearchText(memberSearch);

    return [...snapshot.memberSummaries]
      .filter((summary) =>
        normalizedSearch
          ? normalizeSearchText(summary.profile.displayName).includes(
              normalizedSearch
            )
          : true
      )
      .sort((left, right) => {
        if (memberSort === "balance_desc") {
          return right.expenseReimbursementBalance - left.expenseReimbursementBalance;
        }

        return left.profile.displayName.localeCompare(
          right.profile.displayName,
          locale
        );
      });
  }, [locale, memberSearch, memberSort, snapshot.memberSummaries]);

  const displayedSuggestions = useMemo(() => {
    const normalizedSearch = normalizeSearchText(settlementSearch);

    return [...snapshot.settlementSuggestions]
      .filter((suggestion) => {
        if (!normalizedSearch) {
          return true;
        }

        const debtorName =
          snapshot.memberSummaries.find(
            (item) => item.projectMember.id === suggestion.fromProjectMemberId
          )?.profile.displayName ?? "";
        const creditorName =
          snapshot.memberSummaries.find(
            (item) => item.projectMember.id === suggestion.toProjectMemberId
          )?.profile.displayName ?? "";

        return (
          normalizeSearchText(debtorName).includes(normalizedSearch) ||
          normalizeSearchText(creditorName).includes(normalizedSearch)
        );
      })
      .sort((left, right) => {
        const leftDebtor =
          snapshot.memberSummaries.find(
            (item) => item.projectMember.id === left.fromProjectMemberId
          )?.profile.displayName ?? "";
        const rightDebtor =
          snapshot.memberSummaries.find(
            (item) => item.projectMember.id === right.fromProjectMemberId
          )?.profile.displayName ?? "";
        const leftCreditor =
          snapshot.memberSummaries.find(
            (item) => item.projectMember.id === left.toProjectMemberId
          )?.profile.displayName ?? "";
        const rightCreditor =
          snapshot.memberSummaries.find(
            (item) => item.projectMember.id === right.toProjectMemberId
          )?.profile.displayName ?? "";

        if (settlementSort === "debtor_asc") {
          return leftDebtor.localeCompare(rightDebtor, locale);
        }

        if (settlementSort === "creditor_asc") {
          return leftCreditor.localeCompare(rightCreditor, locale);
        }

        return right.amount - left.amount;
      });
  }, [locale, settlementSearch, settlementSort, snapshot.memberSummaries, snapshot.settlementSuggestions]);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <TableToolbar
          searchLabel={copy.searchLabel}
          searchValue={memberSearch}
          onSearchChange={setMemberSearch}
          searchPlaceholder={copy.memberSearchPlaceholder}
          resultLabel={copy.showingMembers(displayedMembers.length)}
          filters={[
            {
              key: "member-sort",
              label: copy.sort,
              value: memberSort,
              onValueChange: (value) =>
                setMemberSort(value as "name_asc" | "balance_desc"),
              options: [
                { value: "balance_desc", label: copy.sortByBalance },
                { value: "name_asc", label: copy.sortByName },
              ],
            },
          ]}
        />

        <TableSurface>
          <Table className="min-w-[880px]">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">
                  {locale === "vi" ? "Thành viên" : "Member"}
                </TableHead>
                <TableHead className="w-[190px]">
                  {locale === "vi" ? "Số dư hoàn trả" : "Reimbursement balance"}
                </TableHead>
                <TableHead className="w-[170px]">
                  {locale === "vi" ? "Team nợ bạn" : "Team owes you"}
                </TableHead>
                <TableHead className="w-[170px]">
                  {locale === "vi" ? "Bạn nợ team" : "You owe team"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedMembers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-10 text-center whitespace-normal text-slate-500"
                  >
                    {copy.noMembersMatch}
                  </TableCell>
                </TableRow>
              ) : (
                displayedMembers.map((summary) => (
                  <TableRow key={summary.projectMember.id}>
                    <TableCell>{summary.profile.displayName}</TableCell>
                    <TableCell>
                      {formatSignedCurrency(
                        summary.expenseReimbursementBalance,
                        snapshot.dataset.project.currencyCode,
                        locale
                      )}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(
                        summary.teamOwesYou,
                        snapshot.dataset.project.currencyCode,
                        locale
                      )}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(
                        summary.youOweTeam,
                        snapshot.dataset.project.currencyCode,
                        locale
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableSurface>
      </div>

      <div className="space-y-4">
        <TableToolbar
          searchLabel={copy.searchLabel}
          searchValue={settlementSearch}
          onSearchChange={setSettlementSearch}
          searchPlaceholder={copy.settlementSearchPlaceholder}
          resultLabel={copy.showingSettlements(displayedSuggestions.length)}
          filters={[
            {
              key: "settlement-sort",
              label: copy.sort,
              value: settlementSort,
              onValueChange: (value) =>
                setSettlementSort(
                  value as "amount_desc" | "debtor_asc" | "creditor_asc"
                ),
              options: [
                { value: "amount_desc", label: copy.sortByAmount },
                { value: "debtor_asc", label: copy.sortByDebtor },
                { value: "creditor_asc", label: copy.sortByCreditor },
              ],
            },
          ]}
        />

        <TableSurface>
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">
                  {locale === "vi" ? "Người cần trả" : "Debtor"}
                </TableHead>
                <TableHead className="min-w-[220px]">
                  {locale === "vi" ? "Người nhận" : "Creditor"}
                </TableHead>
                <TableHead className="w-[170px]">
                  {locale === "vi" ? "Số tiền" : "Amount"}
                </TableHead>
                <TableHead className="w-[190px] text-right">
                  {locale === "vi" ? "Thao tác" : "Action"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedSuggestions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-10 text-center whitespace-normal text-slate-500"
                  >
                    {copy.noSettlementsMatch}
                  </TableCell>
                </TableRow>
              ) : (
                displayedSuggestions.map((suggestion) => {
                  const from = snapshot.memberSummaries.find(
                    (item) => item.projectMember.id === suggestion.fromProjectMemberId
                  );
                  const to = snapshot.memberSummaries.find(
                    (item) => item.projectMember.id === suggestion.toProjectMemberId
                  );
                  return (
                    <TableRow
                      key={`${suggestion.fromProjectMemberId}-${suggestion.toProjectMemberId}`}
                    >
                      <TableCell>{from?.profile.displayName}</TableCell>
                      <TableCell>{to?.profile.displayName}</TableCell>
                      <TableCell>
                        {formatCurrency(
                          suggestion.amount,
                          snapshot.dataset.project.currencyCode,
                          locale
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/projects/${snapshot.dataset.project.id}/ledger/new?type=expense_settlement_payment&from=${suggestion.fromProjectMemberId}&to=${suggestion.toProjectMemberId}&amount=${suggestion.amount}`}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
                        >
                          {copy.recordRepayment}
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableSurface>
      </div>
    </div>
  );
}
