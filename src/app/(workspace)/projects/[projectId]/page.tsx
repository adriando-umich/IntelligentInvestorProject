import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { ProjectDashboard } from "@/components/finance/project-dashboard";
import { getProjectSnapshot } from "@/lib/data/repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const dashboardViews = [
  "overview",
  "settlements",
  "tags",
  "capital",
  "reconciliation",
  "advanced",
] as const;

type DashboardView = (typeof dashboardViews)[number];

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { projectId } = await params;
  const { view } = await searchParams;
  const snapshot = await getProjectSnapshot(projectId);

  if (!snapshot) {
    notFound();
  }

  const activeView = dashboardViews.includes((view ?? "overview") as DashboardView)
    ? ((view ?? "overview") as DashboardView)
    : "overview";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Project dashboard"
        title={snapshot.dataset.project.name}
        description={
          snapshot.dataset.project.description ??
          "Project money, shared expenses, capital, and profit explained in plain language."
        }
        status={snapshot.dataset.project.status}
      />
      <ProjectDashboard snapshot={snapshot} activeView={activeView} />
    </div>
  );
}
