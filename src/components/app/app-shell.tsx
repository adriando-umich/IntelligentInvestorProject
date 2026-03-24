"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartNoAxesColumn,
  FolderKanban,
  FolderPlus,
  LogOut,
  Menu,
} from "lucide-react";

import { signOutAction } from "@/app/actions/auth";
import { useLocale } from "@/components/app/locale-provider";
import { ProfileAvatar } from "@/components/app/profile-avatar";
import { ProjectManagementMenu } from "@/components/finance/project-management-menu";
import { APP_NAME } from "@/lib/app-config";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type ProjectLink = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "archived" | "closed";
  canManageProject: boolean;
};

function NavContent({
  pathname,
  projects,
  viewerName,
  viewerAvatarUrl,
  demoMode,
}: {
  pathname: string;
  projects: ProjectLink[];
  viewerName: string;
  viewerAvatarUrl?: string | null;
  demoMode: boolean;
}) {
  const { text } = useLocale();
  const navItems = [{ href: "/projects", label: text.shell.projects, icon: FolderKanban }];

  return (
    <div className="flex h-full flex-col gap-8">
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-[1.4rem] bg-[linear-gradient(180deg,#34d399_0%,#10b981_100%)] text-white shadow-[0_20px_36px_-22px_rgba(16,185,129,0.95)]">
              <ChartNoAxesColumn className="size-5" />
            </div>
            <div>
              <p className="font-heading text-lg font-semibold text-slate-950">
                {APP_NAME}
              </p>
            </div>
          </div>
          {demoMode ? (
            <Badge className="rounded-full bg-sky-100 text-sky-800">
              {text.common.demoMode}
            </Badge>
          ) : null}
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-[linear-gradient(180deg,#1fc88c_0%,#14b87a_100%)] text-white shadow-[0_18px_36px_-24px_rgba(20,184,122,0.9)]"
                    : "bg-white/75 text-slate-600 hover:bg-white hover:text-slate-950"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/projects/new"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "w-full border-emerald-200/80 bg-emerald-50/90 text-emerald-900 hover:bg-emerald-100"
          )}
        >
          <FolderPlus className="size-4" />
          {text.shell.newProject}
        </Link>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          {text.shell.activeProjects}
        </p>
        <div className="space-y-2">
          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
              {text.shell.noLiveProjectsYet}
            </div>
          ) : null}
          {projects.map((project) => {
            const href = `/projects/${project.id}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);

            return (
              <div
                key={project.id}
                className={cn(
                  "flex items-start gap-2 rounded-[1.4rem] border px-3 py-3 text-sm transition-all duration-200",
                  active
                    ? "border-emerald-200 bg-emerald-50/95 text-emerald-900 shadow-[0_20px_40px_-34px_rgba(16,185,129,0.8)]"
                    : "border-white/75 bg-white/75 text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-950"
                )}
              >
                <Link href={href} className="min-w-0 flex-1 px-1">
                  <p className="truncate font-medium">{project.name}</p>
                  <p className="mt-1 truncate text-xs uppercase tracking-[0.18em] text-slate-400">
                    {project.slug}
                  </p>
                </Link>
                <ProjectManagementMenu
                  projectId={project.id}
                  projectName={project.name}
                  projectStatus={project.status}
                  canManageProject={project.canManageProject}
                  renameRedirectTo={href}
                  archiveRedirectTo={active ? "/projects" : pathname}
                  restoreRedirectTo={href}
                  deleteRedirectTo={active ? "/projects" : pathname}
                  triggerVariant="sidebar"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-auto space-y-4 rounded-[1.8rem] border border-emerald-100/90 bg-[linear-gradient(180deg,rgba(241,253,248,0.96),rgba(224,247,239,0.92))] px-5 py-5 text-slate-900 shadow-[0_24px_70px_-44px_rgba(16,185,129,0.35)]">
        <div className="flex items-center gap-3">
          <ProfileAvatar
            name={viewerName}
            avatarUrl={viewerAvatarUrl}
            size="lg"
            className="ring-2 ring-white/80 after:hidden"
          />
          <div>
            <p className="text-sm text-slate-500">{text.shell.signedInAs}</p>
            <p className="font-medium">{viewerName}</p>
          </div>
        </div>
        <form action={signOutAction}>
          <Button
            type="submit"
            variant="secondary"
            className="w-full bg-white/90 text-slate-950 hover:bg-white"
          >
            <LogOut className="size-4" />
            {text.shell.signOut}
          </Button>
        </form>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  projects,
  viewerName,
  viewerAvatarUrl,
  demoMode,
}: {
  children: React.ReactNode;
  projects: ProjectLink[];
  viewerName: string;
  viewerAvatarUrl?: string | null;
  demoMode: boolean;
}) {
  const pathname = usePathname();
  const { text } = useLocale();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.24),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(191,219,254,0.22),_transparent_26%),linear-gradient(180deg,_#f8fbfa_0%,_#eef5f2_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] gap-6 px-4 py-4 lg:px-6">
        <aside className="hidden w-[320px] shrink-0 rounded-[2.2rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(245,250,248,0.82))] p-6 shadow-[0_34px_90px_-54px_rgba(15,23,42,0.33)] backdrop-blur lg:block">
          <NavContent
            pathname={pathname}
            projects={projects}
            viewerName={viewerName}
            viewerAvatarUrl={viewerAvatarUrl}
            demoMode={demoMode}
          />
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 mb-4 flex items-center justify-between rounded-[1.9rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(245,250,248,0.88))] px-4 py-3 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.34)] backdrop-blur lg:hidden">
            <div className="flex items-center gap-3">
              <ProfileAvatar
                name={viewerName}
                avatarUrl={viewerAvatarUrl}
                className="after:hidden"
              />
              <div>
                <p className="font-heading text-lg font-semibold text-slate-950">
                  {APP_NAME}
                </p>
                <p className="text-sm text-slate-500">{viewerName}</p>
              </div>
            </div>
            <Sheet>
              <SheetTrigger render={<Button size="icon" variant="outline" />}>
                <Menu className="size-4" />
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[90vw] rounded-r-[2rem] border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(242,249,246,0.92))] p-0"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>{text.shell.projectNavigationTitle}</SheetTitle>
                  <SheetDescription>
                    {text.shell.projectNavigationDescription}
                  </SheetDescription>
                </SheetHeader>
                <div className="h-full p-6">
                  <NavContent
                    pathname={pathname}
                    projects={projects}
                    viewerName={viewerName}
                    viewerAvatarUrl={viewerAvatarUrl}
                    demoMode={demoMode}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </header>

          <main className="min-w-0 flex-1 rounded-[2.1rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(247,251,249,0.76))] p-4 shadow-[0_36px_90px_-56px_rgba(15,23,42,0.34)] backdrop-blur sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
