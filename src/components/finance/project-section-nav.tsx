"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { useLocale } from "@/components/app/locale-provider";
import { cn } from "@/lib/utils";

type ProjectSectionNavProps = {
  projectId: string;
};

const projectSectionItems = [
  {
    key: "overview",
    labelKey: "overview",
    href: (projectId: string) => `/projects/${projectId}`,
    isActive: (pathname: string, view: string | null, projectId: string) =>
      pathname === `/projects/${projectId}` && (!view || view === "overview"),
  },
  {
    key: "settlements",
    labelKey: "settlements",
    href: (projectId: string) => `/projects/${projectId}/settlements`,
    isActive: (pathname: string, _view: string | null, projectId: string) =>
      pathname.startsWith(`/projects/${projectId}/settlements`),
  },
  {
    key: "tags",
    labelKey: "tags",
    href: (projectId: string) => `/projects/${projectId}/tags`,
    isActive: (pathname: string, _view: string | null, projectId: string) =>
      pathname.startsWith(`/projects/${projectId}/tags`),
  },
  {
    key: "members",
    labelKey: "members",
    href: (projectId: string) => `/projects/${projectId}/members`,
    isActive: (pathname: string, _view: string | null, projectId: string) =>
      pathname.startsWith(`/projects/${projectId}/members`),
  },
  {
    key: "capital",
    labelKey: "capital",
    href: (projectId: string) => `/projects/${projectId}?view=capital`,
    isActive: (pathname: string, view: string | null, projectId: string) =>
      pathname === `/projects/${projectId}` && view === "capital",
  },
  {
    key: "reconciliation",
    labelKey: "reconciliation",
    href: (projectId: string) => `/projects/${projectId}/reconciliation`,
    isActive: (pathname: string, _view: string | null, projectId: string) =>
      pathname.startsWith(`/projects/${projectId}/reconciliation`),
  },
  {
    key: "advanced",
    labelKey: "advanced",
    href: (projectId: string) => `/projects/${projectId}?view=advanced`,
    isActive: (pathname: string, view: string | null, projectId: string) =>
      pathname === `/projects/${projectId}` && view === "advanced",
  },
] as const;

export function ProjectSectionNav({ projectId }: ProjectSectionNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const { text } = useLocale();

  return (
    <div className="sticky top-3 z-20 -mx-1 overflow-x-auto rounded-[1.5rem] border border-white/70 bg-white/90 px-2 py-2 shadow-[0_18px_60px_-45px_rgba(15,23,42,0.45)] backdrop-blur">
      <div className="flex min-w-max items-center gap-2">
        {projectSectionItems.map((item) => {
          const active = item.isActive(pathname, view, projectId);

          return (
            <Link
              key={item.key}
              href={item.href(projectId)}
              className={cn(
                "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:bg-white/70 hover:text-slate-900"
              )}
            >
              {text.nav[item.labelKey]}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
