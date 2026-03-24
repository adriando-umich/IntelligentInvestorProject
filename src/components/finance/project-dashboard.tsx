"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  BanknoteArrowDown,
  BanknoteArrowUp,
  CircleAlert,
  FileSpreadsheet,
  HandCoins,
  Landmark,
  PiggyBank,
  Tags,
  Wallet,
} from "lucide-react";

import { useLocale } from "@/components/app/locale-provider";
import { ProfileAvatar } from "@/components/app/profile-avatar";
import { MetricCard } from "@/components/finance/metric-card";
import { ProjectManagementMenu } from "@/components/finance/project-management-menu";
import { ProjectTransactionsTable } from "@/components/finance/project-transactions-table";
import {
  EntryFamilyReport,
  ProjectCapitalVisuals,
  ProjectOverviewVisuals,
  ProjectTagVisuals,
} from "@/components/finance/project-dashboard-visuals";
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
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  getReconciliationStatusLabel,
  type EntryFamily,
  type ProjectSnapshot,
} from "@/lib/finance/types";
import { buildProjectCashClaimView } from "@/lib/finance/project-cash-claims";
import { buildSharedExpenseSettlementView } from "@/lib/finance/shared-expense-settlements";
import {
  formatCompactCurrency,
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
} from "@/lib/format";

type DashboardView =
  | "overview"
  | "settlements"
  | "tags"
  | "capital"
  | "reconciliation"
  | "advanced";

function reconciliationTone(status: string) {
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

export function ProjectDashboard({
  snapshot,
  activeView = "overview",
  canManageProject = false,
}: {
  snapshot: ProjectSnapshot;
  activeView?: DashboardView;
  canManageProject?: boolean;
}) {
  const { locale } = useLocale();
  const [activityFamilyFilter, setActivityFamilyFilter] = useState<
    "all" | EntryFamily
  >("all");
  const overviewCashClaimView = useMemo(
    () => buildProjectCashClaimView(snapshot),
    [snapshot]
  );
  const sharedExpenseSettlementView = useMemo(
    () => buildSharedExpenseSettlementView(snapshot.dataset),
    [snapshot.dataset]
  );
  const overviewMemberSummaries = useMemo(
    () =>
      snapshot.memberSummaries.map((summary) => {
        const claimRow = overviewCashClaimView.rowsByProjectMemberId.get(
          summary.projectMember.id
        );

        return claimRow
          ? {
              ...summary,
              teamOwesYou: claimRow.teamOwesYou,
              youOweTeam: claimRow.youOweTeam,
            }
          : summary;
      }),
    [overviewCashClaimView.rowsByProjectMemberId, snapshot.memberSummaries]
  );
  const sharedExpenseMemberSummaries = useMemo(
    () =>
      snapshot.memberSummaries.map((summary) => {
        const settlementBalance =
          sharedExpenseSettlementView.balancesByProjectMemberId.get(
            summary.projectMember.id
          );

        return settlementBalance
          ? {
              ...summary,
              expenseReimbursementBalance:
                settlementBalance.expenseReimbursementBalance,
              teamOwesYou: settlementBalance.teamOwesYou,
              youOweTeam: settlementBalance.youOweTeam,
            }
          : summary;
      }),
    [sharedExpenseSettlementView.balancesByProjectMemberId, snapshot.memberSummaries]
  );
  const overviewSettlementSuggestions = overviewCashClaimView.settlementSuggestions;
  const sharedExpenseSettlementSuggestions =
    sharedExpenseSettlementView.settlementSuggestions;
  const capitalWeightByMemberId = useMemo(
    () =>
      new Map(
        snapshot.capitalWeights.map((row) => [row.projectMemberId, row.weight])
      ),
    [snapshot.capitalWeights]
  );
  const claimSettlementRows = useMemo(
    () =>
      snapshot.memberSummaries
        .filter(
          (summary) =>
            summary.capitalBalance > 0 || summary.estimatedProfitShare > 0
        )
        .map((summary) => ({
          projectMemberId: summary.projectMember.id,
          displayName: summary.profile.displayName,
          capitalBalance: summary.capitalBalance,
          estimatedProfitShare: summary.estimatedProfitShare,
          weight: capitalWeightByMemberId.get(summary.projectMember.id) ?? 0,
        }))
        .sort((left, right) => {
          if (right.capitalBalance !== left.capitalBalance) {
            return right.capitalBalance - left.capitalBalance;
          }

          return right.estimatedProfitShare - left.estimatedProfitShare;
        }),
    [capitalWeightByMemberId, snapshot.memberSummaries]
  );
  const copy =
    locale === "vi"
      ? {
          addTransaction: "Thêm giao dịch",
          transactionGuide: "Hướng dẫn giao dịch",
          inviteMembers: "Mời thành viên",
          manageTags: "Quản lý tag",
          metricMoneyNowTitle: "Tiền hiện có trong dự án",
          metricMoneyNowDescription:
            "Đây là lượng tiền dự án hiện được kỳ vọng đang tồn tại rải trên các tài khoản/cash do thành viên giữ.",
          metricHoldingCashTitle: "Thành viên đang giữ tiền dự án",
          metricHoldingCashDescription:
            "Số dương nghĩa là người đó đang giữ tiền của dự án.",
          metricFrontingMoneyTitle: "Thành viên đang ứng tiền riêng",
          metricFrontingMoneyDescription:
            "Cash custody âm nghĩa là dự án đang nợ lại tiền cá nhân mà thành viên đó đã ứng.",
          metricCapitalTitle: "Vốn đang góp",
          metricCapitalDescription:
            "Chỉ vốn góp mới làm đổi tỷ trọng chia lợi nhuận. Chi phí chung không làm đổi con số này.",
          metricProfitPreviewTitle: "Lợi nhuận ước tính nếu chia hôm nay",
          metricProfitPreviewDescription:
            "Đây là lợi nhuận vận hành chưa chia. Chỉ là số preview cho tới khi quản lý thực hiện lệnh chia lợi nhuận.",
          metricSettlementTitle: "Việc đối trừ còn mở",
          metricSettlementDescription:
            "Chỉ là gợi ý chuyển tiền do chi phí chung. Hoàn toàn tách biệt với vốn và lợi nhuận.",
          whySeparateTitle: "Vì sao các con số được tách riêng",
          whySeparateDescription:
            "Dashboard này cố tình tách tiền dự án, tiền hoàn trả giữa thành viên, vốn góp và lợi nhuận để người không chuyên kế toán cũng dễ hiểu.",
          holdingMoneyTitle: "Ai đang giữ tiền dự án",
          holdingMoneyDescription:
            "Số dương nghĩa là thành viên đó đang giữ tiền dự án. “Ứng tiền riêng” nghĩa là họ đã dùng tiền cá nhân cho hoạt động của dự án.",
          member: "Thành viên",
          projectMoneyHeld: "Tiền dự án đang giữ",
          frontedOwnMoney: "Đã ứng tiền riêng",
          teamOwesYou: "Team đang nợ bạn",
          youOweTeam: "Bạn đang nợ team",
          estimatedProfitToday: "Lợi nhuận ước tính hôm nay",
          recentActivityTitle: "Hoạt động gần đây",
          recentActivityDescription:
            "Các giao dịch đã ghi nhận gần nhất trong sổ cái của dự án.",
          noEntriesForFilter: "Không có giao dịch nào khớp bộ lọc hiện tại.",
          allActivity: "Tất cả hoạt động",
          noReceivingMember: "Chưa có người nhận tiền",
          inLabel: "Vào",
          outLabel: "Ra",
          owesWhoTitle: "Ai đang nợ ai vì chi phí chung",
          owesWhoDescription:
            "Các gợi ý này chỉ để tất toán chi phí chung. Chúng không làm thay đổi quyền vốn.",
          settled: "Các khoản chi phí chung đã được đối trừ xong.",
          pays: "trả cho",
          reconciliationHealthTitle: "Tình trạng đối chiếu",
          reconciliationHealthDescription:
            "Thành viên so sánh số tiền dự án mà hệ thống kỳ vọng với số họ thực sự đang giữ trong tài khoản cá nhân.",
          matched: "Khớp",
          pending: "Đang chờ",
          variance: "Chênh lệch",
          openReconciliationDetails: "Mở chi tiết đối chiếu",
          noOpenReconciliation: "Hiện chưa có đợt đối chiếu nào đang mở.",
          settlementTableTitle: "Gợi ý đối trừ chi phí chung",
          settlementTableDescription:
            "Thuật toán được giữ đơn giản để dễ giải thích: ai đang nợ team sẽ trả cho người đã ứng nhiều nhất.",
          debtor: "Người cần trả",
          creditor: "Người nhận",
          suggestedPayment: "Số tiền gợi ý",
          action: "Thao tác",
          noOutstandingSettlements:
            "Hiện không còn khoản chi phí chung nào cần đối trừ.",
          recordAsPaid: "Ghi nhận đã trả",
          taggedMoneyInTitle: "Tiền vào theo tag",
          taggedMoneyInDescription:
            "Phần này cộng dồn các dòng tiền vào có gắn tag, gồm cả thu nhập vận hành và giải ngân khoản vay chung. Khoản vay làm tăng cash nhưng không tính là lợi nhuận.",
          noInflowTags: "Chưa có tag cho tiền vào.",
          taggedExpenseTitle: "Chi phí theo tag",
          taggedExpenseDescription:
            "Dùng tag như pháp lý, lãi vay, khảo sát hoặc marketing để xem loại chi phí nào đang tăng nhiều nhất trong dự án.",
          noExpenseTags: "Chưa có tag cho chi phí.",
          tag: "Tag",
          taggedAmount: "Giá trị gắn tag",
          entries: "Số giao dịch",
          capitalTableTitle: "Vốn góp và tỷ lệ chia lợi nhuận",
          capitalTableDescription:
            "Chỉ thành viên có vốn dương mới tham gia phần preview lợi nhuận. Sau khi làm tròn, phần lẻ được cộng vào người có vốn lớn nhất.",
          capitalInvested: "Vốn đã góp",
          profitWeight: "Tỷ trọng lợi nhuận",
          openReconciliationRunTitle: "Đợt đối chiếu đang mở",
          openReconciliationRunDescription:
            "Phần này so sánh số tiền dự án hệ thống kỳ vọng với số tiền từng thành viên báo cáo là họ thực sự đang giữ.",
          noOpenReconciliationRun: "Chưa có đợt đối chiếu nào đang mở.",
          expectedProjectCash: "Tiền dự án theo hệ thống",
          reportedProjectCash: "Tiền dự án thành viên báo cáo",
          varianceColumn: "Chênh lệch",
          status: "Trạng thái",
          advancedBreakdownTitle: "Phân tích kỹ thuật",
          advancedBreakdownDescription:
            "Dashboard thân thiện ở phía trên là mặc định. Phần này hiển thị ý nghĩa kỹ thuật ở lớp bên dưới.",
          operatingTotalsTitle: "Tổng số vận hành",
          operatingTotalsTooltip:
            "Lợi nhuận vận hành bằng tiền vào trừ chi phí vận hành, trước khi tính các lần chia lợi nhuận.",
          income: "Tiền vào",
          expense: "Chi phí",
          sharedLoanInterest: "Lãi vay chung",
          sharedLoanOutstanding: "Gốc vay chung còn lại",
          profitPaid: "Lợi nhuận đã chi",
          undistributedProfit: "Lợi nhuận chưa chia",
          modelGuardrailsTitle: "Nguyên tắc mô hình",
          modelGuardrails: [
            "Cash custody dùng để theo dõi tiền dự án đang nằm ở đâu.",
            "Reimbursement dùng để theo dõi ai nợ ai vì chi phí chung.",
            "Vốn góp quyết định tỷ lệ chia lợi nhuận.",
            "Gốc vay chung là tài trợ vốn, còn lãi vay chung là chi phí.",
            "Lợi nhuận chỉ được xem là đã trả khi quản lý thực hiện lệnh chia lợi nhuận.",
          ],
        }
      : {
          addTransaction: "Add transaction",
          transactionGuide: "Transaction guide",
          inviteMembers: "Invite members",
          manageTags: "Manage tags",
          metricMoneyNowTitle: "Money in the project now",
          metricMoneyNowDescription:
            "This is the net project money currently expected to exist across all member-held accounts.",
          metricHoldingCashTitle: "Members holding project money",
          metricHoldingCashDescription:
            "Positive balances mean the member is currently holding project money.",
          metricFrontingMoneyTitle: "Members fronting their own money",
          metricFrontingMoneyDescription:
            "Negative cash custody means the project currently owes that member their own money back.",
          metricCapitalTitle: "Capital invested",
          metricCapitalDescription:
            "Only capital changes profit-sharing weight. Shared expenses do not change this number.",
          metricProfitPreviewTitle: "Estimated profit if distributed today",
          metricProfitPreviewDescription:
            "This is undistributed operating profit. It is only a preview until a manager posts a profit distribution.",
          metricSettlementTitle: "Cash redistribution actions",
          metricSettlementDescription:
            "Suggested transfers based on capital still invested, profit earned so far, and who is already holding the project cash.",
          whySeparateTitle: "Why the numbers stay separate",
          whySeparateDescription:
            "This dashboard keeps project cash, member cash claims, shared-expense reimbursements, capital, and profit separate so each number answers one question clearly.",
          holdingMoneyTitle: "Who is holding project money",
          holdingMoneyDescription:
            "Positive numbers mean the member is holding project money. Team balances compare that cash against each member's current claim after capital, profit preview, and any true fronted-money reimbursement.",
          member: "Member",
          projectMoneyHeld: "Project money held",
          frontedOwnMoney: "Fronted own money",
          teamOwesYou: "Team owes you",
          youOweTeam: "You owe team",
          estimatedProfitToday: "Estimated profit today",
          recentActivityTitle: "Recent activity",
          recentActivityDescription:
            "Latest posted transactions in this project ledger.",
          noEntriesForFilter: "No entries match the current family filter.",
          allActivity: "All activity",
          noReceivingMember: "No receiving member",
          inLabel: "In",
          outLabel: "Out",
          owesWhoTitle: "Who should receive project cash next",
          owesWhoDescription:
            "These suggestions compare the cash people are holding now against each member's current claim after capital and profit preview.",
          settled: "Current cash already lines up with member claims.",
          pays: "pays",
          reconciliationHealthTitle: "Reconciliation health",
          reconciliationHealthDescription:
            "Members compare expected project cash with what they actually hold in their own accounts.",
          matched: "Matched",
          pending: "Pending",
          variance: "Variance",
          openReconciliationDetails: "Open reconciliation details",
          noOpenReconciliation: "No open reconciliation run right now.",
          settlementTableTitle: "Suggested settlement for shared expenses",
          settlementTableDescription:
            "The greedy matcher keeps the recommendation easy to explain: people who owe the team pay the people who fronted the most.",
          debtor: "Debtor",
          creditor: "Creditor",
          suggestedPayment: "Suggested payment",
          action: "Action",
          noOutstandingSettlements:
            "No outstanding shared-expense settlements.",
          recordAsPaid: "Record as paid",
          taggedMoneyInTitle: "Tagged money in",
          taggedMoneyInDescription:
            "This rolls up tagged inflows, including operating income and shared loan drawdowns. Loan drawdowns raise project cash, but they do not count as profit.",
          noInflowTags: "No inflow tags yet.",
          taggedExpenseTitle: "Tagged expense",
          taggedExpenseDescription:
            "Use tags like legal, bank-interest, survey, or marketing to see which kinds of cost are accumulating across the project.",
          noExpenseTags: "No expense tags yet.",
          tag: "Tag",
          taggedAmount: "Tagged amount",
          entries: "Entries",
          capitalTableTitle: "Capital and profit-sharing weight",
          capitalTableDescription:
            "Only members with positive capital participate in profit preview. The remainder is assigned to the largest capital holder after rounding.",
          capitalInvested: "Capital invested",
          profitWeight: "Profit weight",
          openReconciliationRunTitle: "Open reconciliation run",
          openReconciliationRunDescription:
            "This compares the app's expected project cash per member with what that member reports they actually hold.",
          noOpenReconciliationRun: "No open reconciliation run.",
          expectedProjectCash: "Expected project cash",
          reportedProjectCash: "Reported project cash",
          varianceColumn: "Variance",
          status: "Status",
          advancedBreakdownTitle: "Advanced technical breakdown",
          advancedBreakdownDescription:
            "The friendly dashboard above is the default. This section exposes the raw technical meaning underneath.",
          operatingTotalsTitle: "Operating totals",
          operatingTotalsTooltip:
            "Operating profit is income minus operating expense before profit distributions.",
          income: "Income",
          expense: "Expense",
          sharedLoanInterest: "Shared loan interest",
          sharedLoanOutstanding: "Shared loan principal still outstanding",
          profitPaid: "Profit paid",
          undistributedProfit: "Undistributed profit",
          modelGuardrailsTitle: "Model guardrails",
          modelGuardrails: [
            "Cash custody tracks where project money physically sits.",
            "Reimbursement tracks who owes whom because of shared expenses.",
            "Capital drives profit weight.",
            "Shared loan principal is financing, while shared loan interest is cost.",
            "Profit is only paid when a manager posts a distribution.",
          ],
        };
  const settleClaimLabel = "Settle claim";
  const actionColumnLabel = locale === "vi" ? "Thao tac" : "Action";
  const exportExcelLabel = locale === "vi" ? "Xuat Excel" : "Export Excel";
  return (
    <TooltipProvider>
      <div className="space-y-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/projects/${snapshot.dataset.project.id}/ledger/new`}
            className={cn(buttonVariants({ variant: "default", size: "lg" }), "px-4")}
          >
            {copy.addTransaction}
          </Link>
          <Link
            href={`/projects/${snapshot.dataset.project.id}/ledger/guide`}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "border-emerald-200/80 bg-emerald-50/90 px-4 text-emerald-900 hover:bg-emerald-100")}
          >
            {copy.transactionGuide}
          </Link>
          <Link
            href={`/projects/${snapshot.dataset.project.id}/members`}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-2xl px-4")}
          >
            {copy.inviteMembers}
          </Link>
          <Link
            href={`/projects/${snapshot.dataset.project.id}/export`}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "rounded-2xl px-4"
            )}
            prefetch={false}
          >
            <FileSpreadsheet className="mr-2 size-4" />
            {exportExcelLabel}
          </Link>
          <ProjectManagementMenu
            projectId={snapshot.dataset.project.id}
            projectName={snapshot.dataset.project.name}
            projectStatus={snapshot.dataset.project.status}
            canManageProject={canManageProject}
            renameRedirectTo={`/projects/${snapshot.dataset.project.id}`}
            archiveRedirectTo="/projects"
            restoreRedirectTo={`/projects/${snapshot.dataset.project.id}`}
            deleteRedirectTo="/projects"
            triggerVariant="button"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            title={copy.metricMoneyNowTitle}
            value={formatCurrency(
              snapshot.totalProjectCash,
              snapshot.dataset.project.currencyCode,
              locale
            )}
            description={copy.metricMoneyNowDescription}
            tone="teal"
            icon={<Wallet className="size-5" />}
          />
          <MetricCard
            title={copy.metricHoldingCashTitle}
            value={formatCurrency(
              snapshot.membersHoldingProjectCashTotal,
              snapshot.dataset.project.currencyCode,
              locale
            )}
            description={copy.metricHoldingCashDescription}
            tone="blue"
            icon={<BanknoteArrowDown className="size-5" />}
          />
          <MetricCard
            title={copy.metricFrontingMoneyTitle}
            value={formatCurrency(
              snapshot.frontedByMembersTotal,
              snapshot.dataset.project.currencyCode,
              locale
            )}
            description={copy.metricFrontingMoneyDescription}
            tone="amber"
            icon={<BanknoteArrowUp className="size-5" />}
          />
          <MetricCard
            title={copy.metricCapitalTitle}
            value={formatCurrency(
              snapshot.totalCapitalOutstanding,
              snapshot.dataset.project.currencyCode,
              locale
            )}
            description={copy.metricCapitalDescription}
            tone="blue"
            icon={<PiggyBank className="size-5" />}
          />
          <MetricCard
            title={copy.metricProfitPreviewTitle}
            value={formatCurrency(
              Math.max(snapshot.undistributedProfit, 0),
              snapshot.dataset.project.currencyCode,
              locale
            )}
            description={copy.metricProfitPreviewDescription}
            tone="teal"
            icon={<HandCoins className="size-5" />}
          />
          <MetricCard
            title={copy.metricSettlementTitle}
            value={`${overviewSettlementSuggestions.length}`}
            description={copy.metricSettlementDescription}
            tone={overviewSettlementSuggestions.length > 0 ? "red" : "slate"}
            icon={<ArrowLeftRight className="size-5" />}
          />
        </div>

        <Card className="rounded-[1.75rem] border-white/70 bg-[linear-gradient(135deg,rgba(240,253,250,0.96),rgba(255,255,255,0.94))] shadow-[0_26px_80px_-45px_rgba(15,23,42,0.35)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-950">
              <CircleAlert className="size-4 text-emerald-700" />
              {copy.whySeparateTitle}
            </CardTitle>
            <CardDescription className="text-slate-600">
              {copy.whySeparateDescription}
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs value={activeView} className="gap-6">

          <TabsContent value="overview" className="space-y-6">
            <ProjectOverviewVisuals
              snapshot={snapshot}
              memberSummaries={overviewMemberSummaries}
            />

            <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
              <CardHeader>
                <CardTitle>{copy.holdingMoneyTitle}</CardTitle>
                <CardDescription>
                  {copy.holdingMoneyDescription}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table className="min-w-[820px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{copy.member}</TableHead>
                      <TableHead>{copy.projectMoneyHeld}</TableHead>
                      <TableHead>{copy.frontedOwnMoney}</TableHead>
                      <TableHead>{copy.teamOwesYou}</TableHead>
                      <TableHead>{copy.youOweTeam}</TableHead>
                      <TableHead>{copy.estimatedProfitToday}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overviewMemberSummaries.map((summary) => (
                      <TableRow key={summary.projectMember.id}>
                        <TableCell className="font-medium text-slate-950">
                          <Link
                            href={`/projects/${snapshot.dataset.project.id}/members/${summary.projectMember.id}`}
                            className="flex items-center gap-3 hover:text-emerald-700"
                          >
                            <ProfileAvatar
                              name={summary.profile.displayName}
                              avatarUrl={summary.profile.avatarUrl}
                              size="sm"
                              className="after:hidden"
                            />
                            <span>{summary.profile.displayName}</span>
                          </Link>
                        </TableCell>
                        <TableCell>{formatSignedCurrency(summary.projectCashCustody, snapshot.dataset.project.currencyCode, locale)}</TableCell>
                        <TableCell>{formatCurrency(summary.frontedOwnMoney, snapshot.dataset.project.currencyCode, locale)}</TableCell>
                        <TableCell className="text-emerald-700">{formatCurrency(summary.teamOwesYou, snapshot.dataset.project.currencyCode, locale)}</TableCell>
                        <TableCell className="text-rose-700">{formatCurrency(summary.youOweTeam, snapshot.dataset.project.currencyCode, locale)}</TableCell>
                        <TableCell>{formatCurrency(summary.estimatedProfitShare, snapshot.dataset.project.currencyCode, locale)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
              <ProjectTransactionsTable snapshot={snapshot} />

              <div className="space-y-6">
                <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
                  <CardHeader>
                    <CardTitle>{copy.owesWhoTitle}</CardTitle>
                    <CardDescription>
                      {copy.owesWhoDescription}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {overviewSettlementSuggestions.length === 0 ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                        {copy.settled}
                      </div>
                    ) : (
                      overviewSettlementSuggestions.map((suggestion) => (
                        <div
                          key={`${suggestion.fromProjectMemberId}-${suggestion.toProjectMemberId}`}
                          className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4"
                        >
                          <p className="font-medium text-slate-950">
                            {overviewMemberSummaries.find((item) => item.projectMember.id === suggestion.fromProjectMemberId)?.profile.displayName} {copy.pays}{" "}
                            {overviewMemberSummaries.find((item) => item.projectMember.id === suggestion.toProjectMemberId)?.profile.displayName}
                          </p>
                          <p className="mt-2 text-sm text-slate-600">
                            {formatCurrency(suggestion.amount, snapshot.dataset.project.currencyCode, locale)}
                          </p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
                  <CardHeader>
                    <CardTitle>{copy.reconciliationHealthTitle}</CardTitle>
                    <CardDescription>
                      {copy.reconciliationHealthDescription}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {snapshot.openReconciliation ? (
                      <>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl bg-emerald-50 px-4 py-4">
                            <p className="text-sm text-emerald-700">{copy.matched}</p>
                            <p className="mt-2 text-2xl font-semibold text-emerald-900">
                              {snapshot.openReconciliation.matchedCount}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-amber-50 px-4 py-4">
                            <p className="text-sm text-amber-700">{copy.pending}</p>
                            <p className="mt-2 text-2xl font-semibold text-amber-900">
                              {snapshot.openReconciliation.pendingCount}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-rose-50 px-4 py-4">
                            <p className="text-sm text-rose-700">{copy.variance}</p>
                            <p className="mt-2 text-2xl font-semibold text-rose-900">
                              {snapshot.openReconciliation.varianceCount}
                            </p>
                          </div>
                        </div>
                        <Link
                          href={`/projects/${snapshot.dataset.project.id}/reconciliation`}
                          className={cn(buttonVariants({ variant: "outline" }), "mt-1 rounded-2xl")}
                        >
                          {copy.openReconciliationDetails}
                        </Link>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                        {copy.noOpenReconciliation}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settlements">
            <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
              <CardHeader>
                <CardTitle>{copy.settlementTableTitle}</CardTitle>
                <CardDescription>
                  {copy.settlementTableDescription}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table className="min-w-[820px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{copy.debtor}</TableHead>
                      <TableHead>{copy.creditor}</TableHead>
                      <TableHead>{copy.suggestedPayment}</TableHead>
                      <TableHead className="text-right">{copy.action}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sharedExpenseSettlementSuggestions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-slate-500">
                          {copy.noOutstandingSettlements}
                        </TableCell>
                      </TableRow>
                    ) : (
                      sharedExpenseSettlementSuggestions.map((suggestion) => (
                        <TableRow key={`${suggestion.fromProjectMemberId}-${suggestion.toProjectMemberId}-full`}>
                          <TableCell>{sharedExpenseMemberSummaries.find((item) => item.projectMember.id === suggestion.fromProjectMemberId)?.profile.displayName}</TableCell>
                          <TableCell>{sharedExpenseMemberSummaries.find((item) => item.projectMember.id === suggestion.toProjectMemberId)?.profile.displayName}</TableCell>
                          <TableCell>{formatCurrency(suggestion.amount, snapshot.dataset.project.currencyCode, locale)}</TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={`/projects/${snapshot.dataset.project.id}/ledger/new?type=expense_settlement_payment&from=${suggestion.fromProjectMemberId}&to=${suggestion.toProjectMemberId}&amount=${suggestion.amount}`}
                              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl")}
                            >
                              {copy.recordAsPaid}
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tags">
            <div className="space-y-6">
              <ProjectTagVisuals snapshot={snapshot} />

              <div className="grid gap-6 xl:grid-cols-2">
              <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Tags className="size-4 text-emerald-700" />
                        {copy.taggedMoneyInTitle}
                      </CardTitle>
                    </div>
                    <Link
                      href={`/projects/${snapshot.dataset.project.id}/tags`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl")}
                    >
                      {copy.manageTags}
                    </Link>
                  </div>
                  <CardDescription>
                    {copy.taggedMoneyInDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {snapshot.inflowTagRollups.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
                      {copy.noInflowTags}
                    </div>
                  ) : (
                    <Table className="min-w-[820px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>{copy.tag}</TableHead>
                          <TableHead>{copy.taggedAmount}</TableHead>
                          <TableHead>{copy.entries}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {snapshot.inflowTagRollups.map((row) => (
                          <TableRow key={row.projectTagId}>
                            <TableCell className="font-medium text-slate-950">
                              {row.name}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(
                                row.amount,
                                snapshot.dataset.project.currencyCode,
                                locale
                              )}
                            </TableCell>
                            <TableCell>{row.entryCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Landmark className="size-4 text-rose-700" />
                    {copy.taggedExpenseTitle}
                  </CardTitle>
                  <CardDescription>
                    {copy.taggedExpenseDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {snapshot.expenseTagRollups.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
                      {copy.noExpenseTags}
                    </div>
                  ) : (
                    <Table className="min-w-[820px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>{copy.tag}</TableHead>
                          <TableHead>{copy.taggedAmount}</TableHead>
                          <TableHead>{copy.entries}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {snapshot.expenseTagRollups.map((row) => (
                          <TableRow key={row.projectTagId}>
                            <TableCell className="font-medium text-slate-950">
                              {row.name}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(
                                row.amount,
                                snapshot.dataset.project.currencyCode,
                                locale
                              )}
                            </TableCell>
                            <TableCell>{row.entryCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="capital">
            <div className="space-y-6">
              <ProjectCapitalVisuals snapshot={snapshot} />

              <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
                <CardHeader>
                  <CardTitle>{copy.capitalTableTitle}</CardTitle>
                  <CardDescription>
                    {copy.capitalTableDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table className="min-w-[820px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>{copy.member}</TableHead>
                          <TableHead>{copy.capitalInvested}</TableHead>
                          <TableHead>{copy.profitWeight}</TableHead>
                          <TableHead>{copy.estimatedProfitToday}</TableHead>
                          <TableHead className="text-right">{actionColumnLabel}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {claimSettlementRows.map((row) => (
                          <TableRow key={row.projectMemberId}>
                            <TableCell>{row.displayName}</TableCell>
                            <TableCell>{formatCurrency(row.capitalBalance, snapshot.dataset.project.currencyCode, locale)}</TableCell>
                            <TableCell>{formatPercent(row.weight, locale)}</TableCell>
                            <TableCell>{formatCurrency(row.estimatedProfitShare, snapshot.dataset.project.currencyCode, locale)}</TableCell>
                            <TableCell className="text-right">
                              <Link
                                href={`/projects/${snapshot.dataset.project.id}/ledger/new?workflow=settle_claim&memberId=${row.projectMemberId}`}
                                className={cn(
                                  buttonVariants({ variant: "outline", size: "sm" }),
                                  "rounded-xl"
                                )}
                              >
                                {settleClaimLabel}
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reconciliation">
            <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
              <CardHeader>
                <CardTitle>{copy.openReconciliationRunTitle}</CardTitle>
                <CardDescription>
                  {copy.openReconciliationRunDescription}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!snapshot.openReconciliation ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    {copy.noOpenReconciliationRun}
                  </div>
                ) : (
                  <Table className="min-w-[820px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{copy.member}</TableHead>
                        <TableHead>{copy.expectedProjectCash}</TableHead>
                        <TableHead>{copy.reportedProjectCash}</TableHead>
                        <TableHead>{copy.varianceColumn}</TableHead>
                        <TableHead>{copy.status}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {snapshot.openReconciliation.checks.map(({ check, profile }) => (
                        <TableRow key={check.id}>
                          <TableCell>{profile.displayName}</TableCell>
                          <TableCell>{formatSignedCurrency(check.expectedProjectCash, snapshot.dataset.project.currencyCode, locale)}</TableCell>
                          <TableCell>
                            {check.reportedProjectCash == null
                              ? copy.pending
                              : formatSignedCurrency(check.reportedProjectCash, snapshot.dataset.project.currencyCode, locale)}
                          </TableCell>
                          <TableCell>
                            {check.varianceAmount == null
                              ? copy.pending
                              : formatSignedCurrency(check.varianceAmount, snapshot.dataset.project.currencyCode, locale)}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("rounded-full", reconciliationTone(check.status))}>
                              {getReconciliationStatusLabel(check.status, locale)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced">
            <div className="space-y-6">
              <EntryFamilyReport
                snapshot={snapshot}
                selectedFamily={activityFamilyFilter}
                onSelectFamily={setActivityFamilyFilter}
              />

              <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
                <CardHeader>
                  <CardTitle>{copy.advancedBreakdownTitle}</CardTitle>
                  <CardDescription>
                    {copy.advancedBreakdownDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-950">{copy.operatingTotalsTitle}</p>
                      <Tooltip>
                        <TooltipTrigger className="text-slate-400">
                          <CircleAlert className="size-4" />
                        </TooltipTrigger>
                        <TooltipContent>
                          {copy.operatingTotalsTooltip}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <p>{copy.income}: {formatCompactCurrency(snapshot.projectOperatingIncome, snapshot.dataset.project.currencyCode, locale)}</p>
                      <p>{copy.expense}: {formatCompactCurrency(snapshot.projectOperatingExpense, snapshot.dataset.project.currencyCode, locale)}</p>
                      <p>{copy.sharedLoanInterest}: {formatCompactCurrency(snapshot.sharedLoanInterestPaidTotal, snapshot.dataset.project.currencyCode, locale)}</p>
                      <p>{copy.sharedLoanOutstanding}: {formatCompactCurrency(snapshot.sharedLoanPrincipalOutstanding, snapshot.dataset.project.currencyCode, locale)}</p>
                      <p>{copy.profitPaid}: {formatCompactCurrency(snapshot.totalProfitDistributed, snapshot.dataset.project.currencyCode, locale)}</p>
                      <p className="font-medium text-slate-950">
                        {copy.undistributedProfit}: {formatCompactCurrency(snapshot.undistributedProfit, snapshot.dataset.project.currencyCode, locale)}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                    <p className="font-medium text-slate-950">{copy.modelGuardrailsTitle}</p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                      {copy.modelGuardrails.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
