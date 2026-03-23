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
    <div className="sticky top-3 z-20 -mx-1 overflow-x-auto rounded-[1.7rem] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,251,250,0.88))] px-2 py-2 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.35)] backdrop-blur">
      <div className="flex min-w-max items-center gap-2 rounded-[1.3rem] bg-white/55 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        {projectSectionItems.map((item) => {
          const active = item.isActive(pathname, view, projectId);

          return (
            <Link
              key={item.key}
              href={item.href(projectId)}
              className={cn(
                "inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-[linear-gradient(180deg,#1fc88c_0%,#14b87a_100%)] text-white shadow-[0_14px_30px_-18px_rgba(20,184,122,0.95)]"
                  : "text-slate-500 hover:bg-white hover:text-slate-900"
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
