import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { TransactionTypeMatrix } from "@/components/finance/transaction-type-matrix";
import { getProjectSnapshot } from "@/lib/data/repository";

export default async function LedgerGuidePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const snapshot = await getProjectSnapshot(projectId);

  if (!snapshot) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Transaction guide"
        title={`Choose the right transaction for ${snapshot.dataset.project.name}`}
        description="Use this guide when you want the full matrix for business events versus corrections. Once you know the right type, jump back into the planner to record it."
      />

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/projects/${snapshot.dataset.project.id}/ledger/new`}
          className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Back to planner
        </Link>
        <Link
          href={`/projects/${snapshot.dataset.project.id}/tags`}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Manage tags
        </Link>
      </div>

      <TransactionTypeMatrix />
    </div>
  );
}
