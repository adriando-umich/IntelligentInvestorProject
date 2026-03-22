import { notFound } from "next/navigation";
import { AlertTriangle, CircleCheckBig, Hourglass } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/finance/metric-card";
import { ProjectReconciliationTable } from "@/components/finance/project-reconciliation-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProjectSnapshot } from "@/lib/data/repository";
import { getServerI18n } from "@/lib/i18n/server";
import { formatDateLabel } from "@/lib/format";

export default async function ReconciliationPage({
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

  const run = snapshot.openReconciliation;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={locale === "vi" ? "Đối chiếu" : "Reconciliation"}
        title={
          locale === "vi"
            ? `Đối chiếu cho ${snapshot.dataset.project.name}`
            : `Reconciliation for ${snapshot.dataset.project.name}`
        }
        description={
          locale === "vi"
            ? "Mỗi thành viên xác nhận họ thực tế đang giữ bao nhiêu tiền dự án trong tài khoản hoặc tiền mặt của mình. Hệ thống sẽ so con số đó với số tiền dự án mà ledger đang kỳ vọng."
            : "Members confirm how much project money they actually hold in their own bank or cash. The app compares that report against expected project cash custody."
        }
      />

      {!run ? (
        <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
          <CardContent className="py-12 text-center text-slate-600">
            {locale === "vi"
              ? "Dự án này hiện chưa có đợt đối chiếu nào đang mở."
              : "No open reconciliation run for this project yet."}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              title={locale === "vi" ? "Khớp" : "Matched"}
              value={`${run.matchedCount}`}
              description={
                locale === "vi"
                  ? "Các thành viên có số tiền dự án báo cáo trùng với số hệ thống kỳ vọng."
                  : "Members whose reported project cash matches expected cash."
              }
              tone="teal"
              icon={<CircleCheckBig className="size-5" />}
            />
            <MetricCard
              title={locale === "vi" ? "Đang chờ" : "Pending"}
              value={`${run.pendingCount}`}
              description={
                locale === "vi"
                  ? "Các thành viên chưa gửi xác nhận số tiền dự án mình đang giữ."
                  : "Members who have not submitted their project-cash check yet."
              }
              tone="amber"
              icon={<Hourglass className="size-5" />}
            />
            <MetricCard
              title={locale === "vi" ? "Có chênh lệch" : "Variance found"}
              value={`${run.varianceCount}`}
              description={
                locale === "vi"
                  ? "Các thành viên có số báo cáo không khớp với số tiền dự án mà ledger đang kỳ vọng."
                  : "Members where reported project cash does not match the current ledger expectation."
              }
              tone="red"
              icon={<AlertTriangle className="size-5" />}
            />
          </div>

          <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
            <CardHeader>
              <CardTitle>
                {locale === "vi" ? "Chi tiết đợt đang mở" : "Open run details"}
              </CardTitle>
              <CardDescription>
                {locale === "vi"
                  ? `Mở ngày ${formatDateLabel(run.run.openedAt, locale)} với mốc chốt ${formatDateLabel(run.run.asOf, locale)}.`
                  : `Opened ${formatDateLabel(run.run.openedAt, locale)} with cutoff ${formatDateLabel(run.run.asOf, locale)}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectReconciliationTable snapshot={snapshot} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
