import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  FolderKanban,
  FolderPlus,
  HandCoins,
} from "lucide-react";

import { MetricCard } from "@/components/finance/metric-card";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProjectCards } from "@/lib/data/repository";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function ProjectsPage() {
  const projects = await getProjectCards();

  const totalCash = projects.reduce((sum, project) => sum + project.totalProjectCash, 0);
  const totalProfit = projects.reduce(
    (sum, project) => sum + Math.max(project.undistributedProfit, 0),
    0
  );
  const totalSettlements = projects.reduce(
    (sum, project) => sum + project.openSettlementCount,
    0
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="Open any project to see where project money sits, who owes whom for shared expenses, and what profit could be distributed today."
      />

      <div className="flex justify-end">
        <Link
          href="/projects/new"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "rounded-2xl border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100"
          )}
        >
          <FolderPlus className="size-4" />
          Create project
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Tracked project cash"
          value={formatCurrency(totalCash, "VND")}
          description="Combined project cash custody across the projects you can access."
          tone="teal"
          icon={<FolderKanban className="size-5" />}
        />
        <MetricCard
          title="Estimated profit available"
          value={formatCurrency(totalProfit, "VND")}
          description="This is undistributed operating profit, not yet paid out."
          tone="blue"
          icon={<HandCoins className="size-5" />}
        />
        <MetricCard
          title="Open settlement actions"
          value={`${totalSettlements}`}
          description="Shared-expense transfers the team may still need to record."
          tone={totalSettlements > 0 ? "amber" : "slate"}
          icon={<AlertTriangle className="size-5" />}
        />
      </div>

      {projects.length === 0 ? (
        <Card className="rounded-[1.75rem] border-white/70 bg-white/90 shadow-[0_24px_80px_-45px_rgba(15,23,42,0.35)]">
          <CardHeader className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
              Ready for live data
            </span>
            <CardTitle className="text-2xl text-slate-950">
              No projects yet
            </CardTitle>
            <CardDescription className="max-w-2xl leading-7 text-slate-600">
              Create your first project to start recording capital,
              customer income, operating expenses, cash handovers, and
              settlement payments in the live database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/projects/new"
              className={cn(
                buttonVariants({ size: "lg" }),
                "rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
              )}
            >
              <FolderPlus className="size-4" />
              Create the first project
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {projects.map((project) => (
          <Card
            key={project.id}
            className="rounded-[1.75rem] border-white/70 bg-white/90 shadow-[0_24px_80px_-45px_rgba(15,23,42,0.35)]"
          >
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
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
                    ? "Variance found"
                    : "Healthy reconciliation"}
                </Badge>
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
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <p className="text-sm text-slate-500">Money in the project now</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">
                    {formatCurrency(project.totalProjectCash, project.currencyCode)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <p className="text-sm text-slate-500">Estimated profit today</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">
                    {formatCurrency(project.undistributedProfit, project.currencyCode)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-4 text-sm text-slate-600">
                <div className="flex flex-wrap gap-4">
                  <span>{project.memberCount} members</span>
                  <span>{project.openSettlementCount} settlement suggestions</span>
                </div>
                <Link
                  href={`/projects/${project.id}`}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
                >
                  Open project
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
