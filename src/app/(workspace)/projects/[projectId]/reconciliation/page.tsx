import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { ProjectReconciliationWorkflow } from "@/components/finance/project-reconciliation-workflow";
import { getSessionState } from "@/lib/auth/session";
import { getProjectSnapshot, getViewerProfile } from "@/lib/data/repository";
import { getServerI18n } from "@/lib/i18n/server";
import { getViewerProjectMembership } from "@/lib/projects/access";

export default async function ReconciliationPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [{ locale }, snapshot, session, viewer] = await Promise.all([
    getServerI18n(),
    getProjectSnapshot(projectId),
    getSessionState(),
    getViewerProfile(),
  ]);

  if (!snapshot) {
    notFound();
  }

  const viewerMember = getViewerProjectMembership(
    snapshot.dataset,
    viewer?.userId
  );

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
      <ProjectReconciliationWorkflow
        snapshot={snapshot}
        viewerProjectMemberId={viewerMember?.id}
        viewerRole={viewerMember?.role}
        liveModeEnabled={!session.demoMode}
      />
    </div>
  );
}
