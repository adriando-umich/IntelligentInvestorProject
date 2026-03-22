import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { ProjectDashboard } from "@/components/finance/project-dashboard";
import { getProjectSnapshot } from "@/lib/data/repository";

export default async function ProjectPage({
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
        eyebrow="Project dashboard"
        title={snapshot.dataset.project.name}
        description={
          snapshot.dataset.project.description ??
          "Project money, shared expenses, capital, and profit explained in plain language."
        }
        status={snapshot.dataset.project.status}
      />
      <ProjectDashboard snapshot={snapshot} />
    </div>
  );
}
