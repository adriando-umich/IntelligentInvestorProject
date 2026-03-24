import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  FolderKanban,
  FolderPlus,
  HandCoins,
} from "lucide-react";

import { MetricCard } from "@/components/finance/metric-card";
import { ProjectManagementMenu } from "@/components/finance/project-management-menu";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProjectCards } from "@/lib/data/repository";
import { formatCurrency } from "@/lib/format";
import { getServerI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

export default async function ProjectsPage() {
  const { locale, text } = await getServerI18n();
  const projects = await getProjectCards();
  const activeProjects = projects.filter((project) => project.status === "active");
  const hiddenProjects = projects.filter((project) => project.status !== "active");

  const totalCash = activeProjects.reduce(
    (sum, project) => sum + project.totalProjectCash,
    0
  );
  const totalProfit = activeProjects.reduce(
    (sum, project) => sum + Math.max(project.undistributedProfit, 0),
    0
  );
  const totalSettlements = activeProjects.reduce(
    (sum, project) => sum + project.openSettlementCount,
    0
  );
  const hiddenProjectsTitle =
    locale === "vi" ? "Project da an" : "Hidden projects";
  const hiddenProjectsDescription =
    locale === "vi"
      ? "Nhung project nay da duoc an khoi danh sach active, nhung van co the mo lai, duplicate, hoac xoa."
      : "These projects are hidden from the active list, but they can still be opened, restored, duplicated, or deleted.";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={text.projectsPage.eyebrow}
        title={text.projectsPage.title}
        description={text.projectsPage.description}
      />

      <div className="flex justify-end">
        <Link
          href="/projects/new"
          className={cn(
            "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-muted hover:text-foreground active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
            "rounded-full border-emerald-200/80 bg-emerald-50/90 text-emerald-900 hover:bg-emerald-100"
          )}
          >
            <FolderPlus className="size-4" />
            {text.common.createProject}
          </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title={text.projectsPage.trackedCashTitle}
          value={formatCurrency(totalCash, "VND", locale)}
          description={text.projectsPage.trackedCashDescription}
          tone="teal"
          icon={<FolderKanban className="size-5" />}
        />
        <MetricCard
          title={text.projectsPage.estimatedProfitTitle}
          value={formatCurrency(totalProfit, "VND", locale)}
          description={text.projectsPage.estimatedProfitDescription}
          tone="blue"
          icon={<HandCoins className="size-5" />}
        />
        <MetricCard
          title={text.projectsPage.openSettlementTitle}
          value={`${totalSettlements}`}
          description={text.projectsPage.openSettlementDescription}
          tone={totalSettlements > 0 ? "amber" : "slate"}
          icon={<AlertTriangle className="size-5" />}
        />
      </div>

      {activeProjects.length === 0 ? (
        <Card className="rounded-[1.75rem] border-white/70 bg-white/90 shadow-[0_24px_80px_-45px_rgba(15,23,42,0.35)]">
          <CardHeader className="space-y-3">
            <span className="inline-flex w-fit items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
              {text.projectsPage.readyEyebrow}
            </span>
            <CardTitle className="text-2xl text-slate-950">
              {text.projectsPage.emptyTitle}
            </CardTitle>
            <CardDescription className="max-w-2xl leading-7 text-slate-600">
              {text.projectsPage.emptyDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/projects/new"
              className={cn(
                "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-primary px-2.5 text-sm font-medium whitespace-nowrap text-primary-foreground transition-all outline-none select-none hover:bg-primary/80 active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
                "rounded-full px-4"
              )}
            >
              <FolderPlus className="size-4" />
              {text.projectsPage.createFirstProject}
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {activeProjects.map((project) => (
          <Card
            key={project.id}
            className="rounded-[1.75rem] border-white/70 bg-white/90 shadow-[0_24px_80px_-45px_rgba(15,23,42,0.35)]"
          >
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                    {project.slug}
                  </span>
                  <Badge
                    className={cn(
                      "rounded-full",
                      project.hasReconciliationVariance
                        ? "bg-rose-100 text-rose-800"
                        : "bg-emerald-100 text-emerald-800"
                    )}
                  >
                    {project.hasReconciliationVariance
                      ? text.projectsPage.varianceFound
                      : text.projectsPage.healthyReconciliation}
                  </Badge>
                </div>
                <ProjectManagementMenu
                  projectId={project.id}
                  projectName={project.name}
                  projectStatus={project.status}
                  canManageProject={project.canManageProject}
                  renameRedirectTo="/projects"
                  archiveRedirectTo="/projects"
                  restoreRedirectTo="/projects"
                  deleteRedirectTo="/projects"
                />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl text-slate-950">
                  {project.name}
                </CardTitle>
                <CardDescription className="leading-7 text-slate-600">
                  {project.description}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.4rem] bg-slate-50/90 px-4 py-4">
                  <p className="text-sm text-slate-500">
                    {text.projectsPage.moneyInProjectNow}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">
                    {formatCurrency(project.totalProjectCash, project.currencyCode, locale)}
                  </p>
                </div>
                <div className="rounded-[1.4rem] bg-slate-50/90 px-4 py-4">
                  <p className="text-sm text-slate-500">{text.projectsPage.estimatedProfitToday}</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">
                    {formatCurrency(project.undistributedProfit, project.currencyCode, locale)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-4 text-sm text-slate-600">
                <div className="flex flex-wrap gap-4">
                  <span>{text.projectsPage.memberCount(project.memberCount)}</span>
                  <span>
                    {text.projectsPage.settlementSuggestionCount(
                      project.openSettlementCount
                    )}
                  </span>
                </div>
                <Link
                  href={`/projects/${project.id}`}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-4 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
                >
                  {text.common.openProject}
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {hiddenProjects.length > 0 ? (
        <div className="space-y-5">
          <div className="space-y-2">
            <h2 className="font-heading text-2xl font-semibold tracking-[-0.03em] text-slate-950">
              {hiddenProjectsTitle}
            </h2>
            <p className="max-w-3xl text-sm leading-7 text-slate-600">
              {hiddenProjectsDescription}
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            {hiddenProjects.map((project) => (
              <Card
                key={project.id}
                className="rounded-[1.75rem] border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(248,250,252,0.84))] shadow-[0_24px_80px_-45px_rgba(15,23,42,0.28)]"
              >
                <CardHeader className="gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
                        {project.slug}
                      </span>
                      <Badge className="rounded-full bg-amber-100 text-amber-800">
                        {project.status}
                      </Badge>
                    </div>
                    <ProjectManagementMenu
                      projectId={project.id}
                      projectName={project.name}
                      projectStatus={project.status}
                      canManageProject={project.canManageProject}
                      renameRedirectTo="/projects"
                      archiveRedirectTo="/projects"
                      restoreRedirectTo="/projects"
                      deleteRedirectTo="/projects"
                    />
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="text-2xl text-slate-950">
                      {project.name}
                    </CardTitle>
                    <CardDescription className="leading-7 text-slate-600">
                      {project.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.4rem] bg-slate-50/90 px-4 py-4">
                      <p className="text-sm text-slate-500">
                        {text.projectsPage.moneyInProjectNow}
                      </p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">
                        {formatCurrency(
                          project.totalProjectCash,
                          project.currencyCode,
                          locale
                        )}
                      </p>
                    </div>
                    <div className="rounded-[1.4rem] bg-slate-50/90 px-4 py-4">
                      <p className="text-sm text-slate-500">
                        {text.projectsPage.estimatedProfitToday}
                      </p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">
                        {formatCurrency(
                          project.undistributedProfit,
                          project.currencyCode,
                          locale
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-4 text-sm text-slate-600">
                    <div className="flex flex-wrap gap-4">
                      <span>{text.projectsPage.memberCount(project.memberCount)}</span>
                      <span>
                        {text.projectsPage.settlementSuggestionCount(
                          project.openSettlementCount
                        )}
                      </span>
                    </div>
                    <Link
                      href={`/projects/${project.id}`}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-4 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
                    >
                      {text.common.openProject}
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
