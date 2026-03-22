import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { MemberStatement } from "@/components/finance/member-statement";
import { getMemberStatement } from "@/lib/data/repository";
import { getServerI18n } from "@/lib/i18n/server";

export default async function MemberPage({
  params,
}: {
  params: Promise<{ projectId: string; memberId: string }>;
}) {
  const { projectId, memberId } = await params;
  const [{ locale }, statement] = await Promise.all([
    getServerI18n(),
    getMemberStatement(projectId, memberId),
  ]);

  if (!statement) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={locale === "vi" ? "Statement thành viên" : "Member statement"}
        title={statement.summary.profile.displayName}
        description={
          locale === "vi"
            ? "Bản statement theo góc nhìn thành viên, luôn tách riêng tiền dự án, khoản hoàn trả, vốn góp, phần vận hành và lợi nhuận."
            : "A member-first statement that keeps project cash, reimbursements, capital, operating share, and profit as separate ideas."
        }
      />
      <MemberStatement statement={statement} />
    </div>
  );
}
