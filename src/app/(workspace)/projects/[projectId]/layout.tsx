import { notFound } from "next/navigation";

import { ProjectSectionNav } from "@/components/finance/project-section-nav";
import { getProjectSnapshot } from "@/lib/data/repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProjectLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}>) {
  const { projectId } = await params;
  const snapshot = await getProjectSnapshot(projectId);

  if (!snapshot) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <ProjectSectionNav projectId={snapshot.dataset.project.id} />
      {children}
    </div>
  );
}
