import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { ProjectTagManager } from "@/components/finance/project-tag-manager";
import { getSessionState } from "@/lib/auth/session";
import { getProjectSnapshot } from "@/lib/data/repository";

export default async function ProjectTagsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [snapshot, session] = await Promise.all([
    getProjectSnapshot(projectId),
    getSessionState(),
  ]);

  if (!snapshot) {
    notFound();
  }

  const tagRollupById = new Map<
    string,
    {
      inflowAmount: number;
      expenseAmount: number;
      entryCount: number;
    }
  >();

  for (const row of snapshot.inflowTagRollups) {
    const current = tagRollupById.get(row.projectTagId) ?? {
      inflowAmount: 0,
      expenseAmount: 0,
      entryCount: 0,
    };

    current.inflowAmount += row.amount;
    current.entryCount += row.entryCount;
    tagRollupById.set(row.projectTagId, current);
  }

  for (const row of snapshot.expenseTagRollups) {
    const current = tagRollupById.get(row.projectTagId) ?? {
      inflowAmount: 0,
      expenseAmount: 0,
      entryCount: 0,
    };

    current.expenseAmount += row.amount;
    current.entryCount += row.entryCount;
    tagRollupById.set(row.projectTagId, current);
  }

  const tagSummaries = snapshot.dataset.tags
    .map((tag) => {
      const usage = tagRollupById.get(tag.id) ?? {
        inflowAmount: 0,
        expenseAmount: 0,
        entryCount: 0,
      };

      return {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        entryCount: usage.entryCount,
        inflowAmount: usage.inflowAmount,
        expenseAmount: usage.expenseAmount,
        taggedAmount: usage.inflowAmount + usage.expenseAmount,
      };
    })
    .sort((left, right) => {
      if (right.taggedAmount !== left.taggedAmount) {
        return right.taggedAmount - left.taggedAmount;
      }

      return left.name.localeCompare(right.name);
    });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Project tags"
        title={`Manage tags for ${snapshot.dataset.project.name}`}
        description="Create, rename, and clean up the reporting tags that help the team roll up inflows and costs later."
      />

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/projects/${snapshot.dataset.project.id}`}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to dashboard
        </Link>
        <Link
          href={`/projects/${snapshot.dataset.project.id}/ledger/new`}
          className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Add transaction
        </Link>
        <Link
          href={`/projects/${snapshot.dataset.project.id}/ledger/guide`}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Open transaction guide
        </Link>
      </div>

      <ProjectTagManager
        projectId={snapshot.dataset.project.id}
        currencyCode={snapshot.dataset.project.currencyCode}
        tagSummaries={tagSummaries}
        liveModeEnabled={!session.demoMode}
      />
    </div>
  );
}
