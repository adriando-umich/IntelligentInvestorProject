import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { getSessionState } from "@/lib/auth/session";
import { getProjectCards, getViewerProfile } from "@/lib/data/repository";
import { getServerI18n } from "@/lib/i18n/server";

export default async function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSessionState();
  const { text } = await getServerI18n();

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
      viewerName={viewer?.displayName ?? text.shell.defaultViewerName}
      viewerAvatarUrl={viewer?.avatarUrl}
      demoMode={session.demoMode}
    >
      {children}
    </AppShell>
  );
}
