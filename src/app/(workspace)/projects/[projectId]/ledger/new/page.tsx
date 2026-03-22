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
import { type PlannerEntryType } from "@/lib/finance/entry-form";
import { getServerI18n } from "@/lib/i18n/server";

function isEntryType(value: string | undefined): value is PlannerEntryType {
  return (
    value === "capital_contribution" ||
    value === "capital_return" ||
    value === "operating_income" ||
    value === "shared_loan_drawdown" ||
    value === "shared_loan_repayment_principal" ||
    value === "shared_loan_interest_payment" ||
    value === "operating_expense" ||
    value === "cash_handover" ||
    value === "expense_settlement_payment" ||
    value === "profit_distribution" ||
    value === "reconciliation_adjustment"
  );
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

  const queryType = Array.isArray(query.type) ? query.type[0] : query.type;
  const queryAmount = Array.isArray(query.amount) ? query.amount[0] : query.amount;
  const queryFrom = Array.isArray(query.from) ? query.from[0] : query.from;
  const queryTo = Array.isArray(query.to) ? query.to[0] : query.to;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={locale === "vi" ? "Form giao dịch" : "Ledger planner"}
        title={
          locale === "vi"
            ? `Thêm giao dịch cho ${snapshot.dataset.project.name}`
            : `Add a transaction for ${snapshot.dataset.project.name}`
        }
        description={
          locale === "vi"
            ? "Dùng form này để ghi vốn góp, tiền vào có tag, giải ngân vay chung, trả gốc vay chung, trả lãi vay chung, chi phí vận hành, chuyển tiền nội bộ hoặc thành viên trả lại tiền cho nhau. Ví dụ A trả hộ B trước đó và B trả lại A, hãy ghi ở đây dưới loại thành viên trả lại tiền. Trong workspace mẫu, form chỉ ở chế độ preview; còn dự án live đã đăng nhập có thể lưu trực tiếp các loại giao dịch được hỗ trợ lên Supabase."
            : "Use this planner to record capital, tagged inflows, shared loan drawdowns, shared loan principal repayments, shared loan interest payments, operating expenses, project cash handovers, or member repayments. Example: if A paid for B earlier and B returns the money to A, record that here as a member repayment. In the sample workspace it stays preview-only, while live signed-in projects can save supported transaction types directly to Supabase."
        }
      />
      <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle>
            {locale === "vi"
              ? "Cần giúp chọn đúng loại giao dịch?"
              : "Need help choosing the right transaction?"}
          </CardTitle>
          <CardDescription>
            {locale === "vi"
              ? "Form này giữ tập trung vào việc nhập liệu. Mở hướng dẫn nếu bạn chưa chắc nên ghi loại giao dịch nào, hoặc sang trang tag nếu cần dọn nhóm báo cáo trước."
              : "Keep the planner focused here. Open the guide if you are unsure which transaction type to record, or jump to tag management before posting if the reporting labels need cleanup."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:flex sm:flex-wrap">
          <Link
            href={`/projects/${snapshot.dataset.project.id}/ledger/guide`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 sm:w-auto"
          >
            <BookOpen className="size-4" />
            {locale === "vi" ? "Mở hướng dẫn giao dịch" : "Open transaction guide"}
          </Link>
          <Link
            href={`/projects/${snapshot.dataset.project.id}/tags`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            <FolderTree className="size-4" />
            {locale === "vi" ? "Quản lý tag" : "Manage tags"}
          </Link>
        </CardContent>
      </Card>
      <LedgerEntryPlanner
        projectId={snapshot.dataset.project.id}
        projectName={snapshot.dataset.project.name}
        currencyCode={snapshot.dataset.project.currencyCode}
        memberOptions={snapshot.memberSummaries.map((summary) => ({
          id: summary.projectMember.id,
          name: summary.profile.displayName,
          membershipStatus: summary.projectMember.membershipStatus ?? "active",
        }))}
        tagOptions={snapshot.dataset.tags.map((tag) => tag.name)}
        initialValues={{
          projectId: snapshot.dataset.project.id,
          currencyCode: snapshot.dataset.project.currencyCode,
          entryType: isEntryType(queryType) ? queryType : undefined,
          amount: queryAmount ? Number(queryAmount) : undefined,
          cashOutProjectMemberId: queryFrom,
          cashInProjectMemberId: queryTo,
          description:
            queryType === "expense_settlement_payment" && queryFrom && queryTo
              ? "Member repayment recorded from suggestion"
              : "",
        }}
        liveModeEnabled={!session.demoMode}
      />
    </div>
  );
}
