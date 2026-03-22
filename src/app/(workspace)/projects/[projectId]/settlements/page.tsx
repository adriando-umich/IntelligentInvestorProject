import { notFound } from "next/navigation";
import { ArrowLeftRight, Scale } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/finance/metric-card";
import { ProjectSettlementsTables } from "@/components/finance/project-settlements-tables";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProjectSnapshot } from "@/lib/data/repository";
import { getServerI18n } from "@/lib/i18n/server";
import { formatCurrency } from "@/lib/format";

export default async function SettlementsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [{ locale }, snapshot] = await Promise.all([
    getServerI18n(),
    getProjectSnapshot(projectId),
  ]);

  if (!snapshot) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={locale === "vi" ? "Đối trừ" : "Settlements"}
        title={
          locale === "vi"
            ? `Đối trừ chi phí chung cho ${snapshot.dataset.project.name}`
            : `Shared-expense settlement for ${snapshot.dataset.project.name}`
        }
        description={
          locale === "vi"
            ? "Trang này chỉ cho biết ai nên trả ai để tất toán chi phí chung. Ví dụ A trả hộ B trước đó, trang này sẽ giúp ghi nhận B trả lại A. Nó không phải là chia lợi nhuận hay hoàn vốn."
            : "This page only shows who should pay whom to settle shared expenses. Example: if A paid for B earlier, this page helps record B paying A back. It does not represent profit payout or capital return."
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard
          title={locale === "vi" ? "Gợi ý chuyển tiền" : "Suggested transfers"}
          value={`${snapshot.settlementSuggestions.length}`}
          description={
            locale === "vi"
              ? "Thuật toán cố giữ số lần chuyển ít và dễ giải thích."
              : "The matcher keeps the number of transfers small and easy to explain."
          }
          tone={snapshot.settlementSuggestions.length > 0 ? "amber" : "teal"}
          icon={<ArrowLeftRight className="size-5" />}
        />
        <MetricCard
          title={locale === "vi" ? "Tổng chênh lệch của team" : "Total team imbalance"}
          value={formatCurrency(
            snapshot.memberSummaries.reduce(
              (sum, summary) => sum + Math.max(summary.teamOwesYou, 0),
              0
            ),
            snapshot.dataset.project.currencyCode,
            locale
          )}
          description={
            locale === "vi"
              ? "Đây là tổng số dư hoàn trả dương vẫn đang chờ được đối trừ."
              : "This is the total positive reimbursement still waiting to be settled."
          }
          tone="blue"
          icon={<Scale className="size-5" />}
        />
      </div>

      <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle>
            {locale === "vi" ? "Bảng đối trừ chi tiết" : "Detailed settlement tables"}
          </CardTitle>
          <CardDescription>
            {locale === "vi"
              ? "Bạn có thể tìm nhanh thành viên, sắp xếp số dư hoàn trả và lọc các gợi ý chuyển tiền ở ngay đây."
              : "Search members, sort reimbursement balances, and filter the suggested transfer list from here."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectSettlementsTables snapshot={snapshot} />
        </CardContent>
      </Card>
    </div>
  );
}
