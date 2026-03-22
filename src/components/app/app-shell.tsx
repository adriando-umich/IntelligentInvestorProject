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
import { ProfileAvatar } from "@/components/app/profile-avatar";
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
  const navItems = [{ href: "/projects", label: "Projects", icon: FolderKanban }];

  return (
    <div className="flex h-full flex-col gap-8">
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-300/60">
              <ChartNoAxesColumn className="size-5" />
            </div>
            <div>
              <p className="font-heading text-lg font-semibold text-slate-950">
                {APP_NAME}
              </p>
              <p className="text-sm text-slate-500">Project finance cockpit</p>
            </div>
          </div>
          {demoMode ? (
            <Badge className="rounded-full bg-sky-100 text-sky-800">
              Demo mode
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
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-slate-950 text-white"
                    : "bg-white/70 text-slate-600 hover:bg-white hover:text-slate-950"
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
            "w-full rounded-2xl border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100"
          )}
        >
          <FolderPlus className="size-4" />
          New project
        </Link>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Active projects
        </p>
        <div className="space-y-2">
          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
              No live projects yet.
            </div>
          ) : null}
          {projects.map((project) => {
            const href = `/projects/${project.id}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={project.id}
                href={href}
                className={cn(
                  "block rounded-2xl border px-4 py-3 text-sm transition-colors",
                  active
                    ? "border-teal-200 bg-teal-50 text-teal-900"
                    : "border-white/70 bg-white/70 text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-950"
                )}
              >
                <p className="font-medium">{project.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                  {project.slug}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-auto space-y-4 rounded-3xl bg-slate-950 px-5 py-5 text-white shadow-[0_24px_80px_-40px_rgba(15,23,42,0.8)]">
        <div className="flex items-center gap-3">
          <ProfileAvatar
            name={viewerName}
            avatarUrl={viewerAvatarUrl}
            size="lg"
            className="ring-2 ring-white/15 after:hidden"
          />
          <div>
            <p className="text-sm text-slate-300">Signed in as</p>
            <p className="font-medium">{viewerName}</p>
          </div>
        </div>
        <form action={signOutAction}>
          <Button
            type="submit"
            variant="secondary"
            className="w-full rounded-2xl bg-white text-slate-950 hover:bg-slate-100"
          >
            <LogOut className="size-4" />
            Sign out
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.16),_transparent_28%),linear-gradient(180deg,_#fdfcf9_0%,_#f6f2ea_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] gap-6 px-4 py-4 lg:px-6">
        <aside className="hidden w-[320px] shrink-0 rounded-[2rem] border border-white/70 bg-white/75 p-6 shadow-[0_30px_90px_-50px_rgba(15,23,42,0.4)] backdrop-blur lg:block">
          <NavContent
            pathname={pathname}
            projects={projects}
            viewerName={viewerName}
            viewerAvatarUrl={viewerAvatarUrl}
            demoMode={demoMode}
          />
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 mb-4 flex items-center justify-between rounded-[1.75rem] border border-white/70 bg-white/85 px-4 py-3 shadow-[0_18px_60px_-45px_rgba(15,23,42,0.45)] backdrop-blur lg:hidden">
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
              <SheetContent side="left" className="w-[90vw] rounded-r-[2rem] p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Project navigation</SheetTitle>
                  <SheetDescription>
                    Switch between projects and account actions.
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

          <main className="min-w-0 flex-1 rounded-[2rem] border border-white/70 bg-white/65 p-4 shadow-[0_30px_90px_-50px_rgba(15,23,42,0.4)] backdrop-blur sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
