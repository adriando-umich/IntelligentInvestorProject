import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { getSessionState } from "@/lib/auth/session";
import { getProjectCards, getViewerProfile } from "@/lib/data/repository";

export default async function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSessionState();

  if (!session.isAuthenticated) {
    redirect("/sign-in");
  }

  const [projects, viewer] = await Promise.all([
    getProjectCards(),
    getViewerProfile(),
  ]);

  return (
    <AppShell
      projects={projects}
      viewerName={viewer?.displayName ?? "Project member"}
      demoMode={session.demoMode}
    >
      {children}
    </AppShell>
  );
}
