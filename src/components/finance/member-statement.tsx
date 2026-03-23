"use client";

import Link from "next/link";
import { CircleAlert, PiggyBank, ReceiptText, Wallet } from "lucide-react";

import { useLocale } from "@/components/app/locale-provider";
import { ProfileAvatar } from "@/components/app/profile-avatar";
import { MetricCard } from "@/components/finance/metric-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  getEntryTypeLabel,
  type MemberStatementSnapshot,
} from "@/lib/finance/types";
import {
  formatCurrency,
  formatDateLabel,
  formatSignedCurrency,
} from "@/lib/format";

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

function getReconciliationLabel(status: string, locale: "en" | "vi") {
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

export function MemberStatement({
  statement,
}: {
  statement: MemberStatementSnapshot;
}) {
  const { locale } = useLocale();
  const profileNames = new Map(
    statement.memberDirectory.flatMap((item) => [
      [item.projectMemberId, item.displayName] as const,
      [item.userId, item.displayName] as const,
    ])
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/projects/${statement.project.id}`}
          className={cn(buttonVariants({ variant: "outline" }), "rounded-2xl")}
        >
          {locale === "vi" ? "Quay lại dự án" : "Back to project"}
        </Link>
        <Link
          href={`/projects/${statement.project.id}/ledger/new`}
          className={cn(
            buttonVariants({ variant: "default" }),
            "rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
          )}
        >
          {locale === "vi" ? "Thêm giao dịch" : "Add transaction"}
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title={locale === "vi" ? "Tiền dự án bạn đang giữ" : "Project money you are holding"}
          value={formatCurrency(
            Math.max(statement.summary.projectCashCustody, 0),
            statement.project.currencyCode,
            locale
          )}
          description={
            locale === "vi"
              ? "Số dương nghĩa là tiền dự án hiện đang nằm ở thành viên này."
              : "Positive custody means project money is currently sitting with this member."
          }
          tone="teal"
          icon={<Wallet className="size-5" />}
        />
        <MetricCard
          title={locale === "vi" ? "Bạn đã ứng tiền riêng" : "You fronted your own money"}
          value={formatCurrency(
            statement.summary.frontedOwnMoney,
            statement.project.currencyCode,
            locale
          )}
          description={
            locale === "vi"
              ? "Đây là tiền cá nhân đã ứng trước vào dự án."
              : "This is personal money already advanced into the project."
          }
          tone="amber"
          icon={<ReceiptText className="size-5" />}
        />
        <MetricCard
          title={locale === "vi" ? "Team đang nợ bạn" : "Team owes you"}
          value={formatCurrency(
            statement.summary.teamOwesYou,
            statement.project.currencyCode,
            locale
          )}
          description={
            locale === "vi"
              ? "Chi phí chung khiến thành viên này đang ở vị thế được team hoàn lại."
              : "Shared expenses left this member in credit against teammates."
          }
          tone="teal"
          icon={<CircleAlert className="size-5" />}
        />
        <MetricCard
          title={locale === "vi" ? "Vốn bạn đang góp" : "Your invested capital"}
          value={formatCurrency(
            statement.summary.capitalBalance,
            statement.project.currencyCode,
            locale
          )}
          description={
            locale === "vi"
              ? "Chỉ vốn góp mới làm thay đổi tỷ trọng chia lợi nhuận của thành viên này."
              : "Only capital changes this member's profit-sharing weight."
          }
          tone="blue"
          icon={<PiggyBank className="size-5" />}
        />
      </div>

      <Card className="rounded-[1.75rem] border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(240,249,255,0.95))]">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <ProfileAvatar
              name={statement.summary.profile.displayName}
              avatarUrl={statement.summary.profile.avatarUrl}
              size="lg"
              className="after:hidden"
            />
            <span>
              {locale === "vi"
                ? `Statement của ${statement.summary.profile.displayName}`
                : `${statement.summary.profile.displayName}'s statement`}
            </span>
          </CardTitle>
          <CardDescription>
            {locale === "vi"
              ? "Bản xem ưu tiên sự dễ hiểu cho thành viên này. Khoản hoàn trả chi phí chung, tiền dự án đang giữ, vốn góp và lợi nhuận luôn được tách riêng có chủ đích."
              : "This member view keeps project cash, reimbursements, capital, and profit separate so the numbers stay easy to follow."}
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="overview" className="gap-6">
        <TabsList className="rounded-2xl bg-slate-100 p-1">
          <TabsTrigger value="overview">{locale === "vi" ? "Tổng quan" : "Overview"}</TabsTrigger>
          <TabsTrigger value="activity">{locale === "vi" ? "Hoạt động" : "Activity"}</TabsTrigger>
          <TabsTrigger value="advanced">{locale === "vi" ? "Chi tiết kỹ thuật" : "Advanced view"}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
            <CardHeader>
              <CardTitle>
                {locale === "vi" ? "Hiểu đơn giản thì các số này nói gì" : "What this means in plain language"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-7 text-slate-600">
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="font-medium text-slate-950">
                  {locale === "vi" ? "Tiền dự án bạn đang giữ" : "Project money you are holding"}
                </p>
                <p className="mt-2">
                  {formatSignedCurrency(
                    statement.summary.projectCashCustody,
                    statement.project.currencyCode,
                    locale
                  )}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="font-medium text-slate-950">
                  {locale === "vi" ? "Số dư chi phí chung" : "Shared-expense balance"}
                </p>
                <p className="mt-2">
                  {statement.summary.expenseReimbursementBalance >= 0
                    ? locale === "vi"
                      ? `Team đang nợ thành viên này ${formatCurrency(statement.summary.teamOwesYou, statement.project.currencyCode, locale)}`
                      : `Team owes this member ${formatCurrency(statement.summary.teamOwesYou, statement.project.currencyCode, locale)}`
                    : locale === "vi"
                      ? `Thành viên này đang nợ team ${formatCurrency(statement.summary.youOweTeam, statement.project.currencyCode, locale)}`
                      : `This member owes the team ${formatCurrency(statement.summary.youOweTeam, statement.project.currencyCode, locale)}`}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="font-medium text-slate-950">
                  {locale === "vi" ? "Vị thế lợi nhuận" : "Profit position"}
                </p>
                <p className="mt-2">
                  {locale === "vi" ? "Ước tính hôm nay" : "Estimated today"}:{" "}
                  {formatCurrency(
                    statement.summary.estimatedProfitShare,
                    statement.project.currencyCode,
                    locale
                  )}
                </p>
                <p className="mt-1">
                  {locale === "vi" ? "Đã trả" : "Already paid"}:{" "}
                  {formatCurrency(
                    statement.summary.profitReceivedTotal,
                    statement.project.currencyCode,
                    locale
                  )}
                </p>
              </div>
              {statement.openReconciliationCheck ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <p className="font-medium text-slate-950">
                    {locale === "vi" ? "Đợt đối chiếu đang mở" : "Open reconciliation"}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge
                      className={cn(
                        "rounded-full",
                        statusTone(statement.openReconciliationCheck.check.status)
                      )}
                    >
                      {getReconciliationLabel(
                        statement.openReconciliationCheck.check.status,
                        locale
                      )}
                    </Badge>
                    <span className="text-sm text-slate-500">
                      {locale === "vi" ? "Kỳ vọng" : "Expected"}{" "}
                      {formatSignedCurrency(
                        statement.openReconciliationCheck.check.expectedProjectCash,
                        statement.project.currencyCode,
                        locale
                      )}
                    </span>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
            <CardHeader>
              <CardTitle>
                {locale === "vi" ? "Các số dư của thành viên này" : "Balances for this member"}
              </CardTitle>
              <CardDescription>
                {locale === "vi"
                  ? "Những con số này được tách riêng có chủ đích để người dùng không phải giải mã một số dư tổng khó hiểu."
                  : "These numbers are intentionally separated so the user does not need to decode one giant net balance."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{locale === "vi" ? "Chỉ số" : "Balance"}</TableHead>
                    <TableHead>{locale === "vi" ? "Số tiền" : "Amount"}</TableHead>
                    <TableHead>{locale === "vi" ? "Ý nghĩa" : "Meaning"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>{locale === "vi" ? "Tiền dự án đang giữ" : "Project cash custody"}</TableCell>
                    <TableCell>
                      {formatSignedCurrency(
                        statement.summary.projectCashCustody,
                        statement.project.currencyCode,
                        locale
                      )}
                    </TableCell>
                    <TableCell>
                      {locale === "vi"
                        ? "Tiền dự án hiện đang nằm ở thành viên này."
                        : "Where project money currently sits for this member."}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>{locale === "vi" ? "Hoàn trả chi phí" : "Expense reimbursement"}</TableCell>
                    <TableCell>
                      {formatSignedCurrency(
                        statement.summary.expenseReimbursementBalance,
                        statement.project.currencyCode,
                        locale
                      )}
                    </TableCell>
                    <TableCell>
                      {locale === "vi"
                        ? "Số dương nghĩa là team nợ thành viên này. Số âm nghĩa là thành viên này nợ team."
                        : "Positive means teammates owe this member. Negative means this member owes teammates."}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>{locale === "vi" ? "Vốn đã góp" : "Capital invested"}</TableCell>
                    <TableCell>
                      {formatCurrency(
                        statement.summary.capitalBalance,
                        statement.project.currencyCode,
                        locale
                      )}
                    </TableCell>
                    <TableCell>
                      {locale === "vi"
                        ? "Cơ sở để tính tỷ trọng chia lợi nhuận."
                        : "The basis for profit-sharing weight."}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>{locale === "vi" ? "Phần P&L vận hành" : "Operating P&L share"}</TableCell>
                    <TableCell>
                      {formatSignedCurrency(
                        statement.summary.operatingPnlShare,
                        statement.project.currencyCode,
                        locale
                      )}
                    </TableCell>
                    <TableCell>
                      {locale === "vi"
                        ? "Tiền vào vận hành được phân bổ trừ chi phí vận hành được phân bổ."
                        : "Allocated operating income minus allocated operating expenses."}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>{locale === "vi" ? "Lợi nhuận đã trả" : "Profit already paid"}</TableCell>
                    <TableCell>
                      {formatCurrency(
                        statement.summary.profitReceivedTotal,
                        statement.project.currencyCode,
                        locale
                      )}
                    </TableCell>
                    <TableCell>
                      {locale === "vi"
                        ? "Số tiền đã được trả ra dưới dạng lợi nhuận."
                        : "Money already distributed as profit."}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
            <CardHeader>
              <CardTitle>
                {locale === "vi" ? "Các giao dịch liên quan thành viên này" : "Entries touching this member"}
              </CardTitle>
              <CardDescription>
                {locale === "vi"
                  ? "Bao gồm các giao dịch mà thành viên này là người chi, người nhận hoặc nằm trong nhóm phân bổ."
                  : "Includes transactions where this member paid, received, or was part of an allocation."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{locale === "vi" ? "Ngày" : "Date"}</TableHead>
                    <TableHead>{locale === "vi" ? "Loại" : "Type"}</TableHead>
                    <TableHead>{locale === "vi" ? "Mô tả" : "Description"}</TableHead>
                    <TableHead>{locale === "vi" ? "Tiền vào" : "Money in"}</TableHead>
                    <TableHead>{locale === "vi" ? "Tiền ra" : "Money out"}</TableHead>
                    <TableHead>{locale === "vi" ? "Số tiền" : "Amount"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statement.relatedEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDateLabel(entry.effectiveAt, locale)}</TableCell>
                      <TableCell>{getEntryTypeLabel(entry.entryType, locale)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-950">{entry.description}</p>
                          <p className="text-xs text-slate-500">
                            {entry.cashInMemberId
                              ? `${locale === "vi" ? "Vào" : "In"}: ${profileNames.get(entry.cashInMemberId)}`
                              : locale === "vi"
                                ? "Chưa có người nhận"
                                : "No receiver"}
                            {entry.cashOutMemberId
                              ? ` • ${locale === "vi" ? "Ra" : "Out"}: ${profileNames.get(entry.cashOutMemberId)}`
                              : ""}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{entry.cashInMemberId ? profileNames.get(entry.cashInMemberId) : "-"}</TableCell>
                      <TableCell>{entry.cashOutMemberId ? profileNames.get(entry.cashOutMemberId) : "-"}</TableCell>
                      <TableCell>{formatCurrency(entry.amount, entry.currencyCode, locale)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced">
          <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
            <CardHeader>
              <CardTitle>{locale === "vi" ? "Chi tiết kỹ thuật" : "Advanced view"}</CardTitle>
              <CardDescription>
                {locale === "vi"
                  ? "Dùng phần này khi team muốn xem cách diễn giải kỹ thuật. Các thẻ dễ hiểu ở phía trên vẫn là mặc định."
                  : "Use this view when the team wants the technical wording behind the member balances."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-slate-600">
              <p>
                {locale === "vi"
                  ? "`project_cash_custody` được tính từ tổng tiền vào trừ tiền ra ở các ledger entry mà thành viên này là người giữ tiền."
                  : "`project_cash_custody` is derived from money in minus money out on ledger entries where this member is a cash holder."}
              </p>
              <p>
                {locale === "vi"
                  ? "`expense_reimbursement_balance` được tính từ chi phí chung và các khoản thanh toán đối trừ, dùng bộ ghép chủ nợ/người nợ kiểu Splitwise ở cấp dự án."
                  : "`expense_reimbursement_balance` is derived from shared expenses and settlement payments, using the project-level creditor and debtor matcher."}
              </p>
              <p>
                {locale === "vi"
                  ? "`capital_balance` quyết định tỷ trọng preview lợi nhuận. Hoạt động vận hành thông thường không làm thay đổi con số này."
                  : "`capital_balance` controls profit preview weight. Normal operating activity never changes that number."}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
