import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { MemberStatement } from "@/components/finance/member-statement";
import { getMemberStatement } from "@/lib/data/repository";

export default async function MemberPage({
  params,
}: {
  params: Promise<{ projectId: string; memberId: string }>;
}) {
  const { projectId, memberId } = await params;
  const statement = await getMemberStatement(projectId, memberId);

  if (!statement) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Member statement"
        title={statement.summary.profile.displayName}
        description="A member-first statement that keeps project cash, reimbursements, capital, operating share, and profit as separate ideas."
      />
      <MemberStatement statement={statement} />
    </div>
  );
}
