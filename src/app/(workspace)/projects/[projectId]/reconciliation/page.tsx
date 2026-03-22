import { notFound } from "next/navigation";
import { AlertTriangle, CircleCheckBig, Hourglass } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/finance/metric-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProjectSnapshot } from "@/lib/data/repository";
import { formatDateLabel, formatSignedCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

function statusTone(status: string) {
  if (status === "matched") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (status === "variance_found") {
    return "bg-rose-100 text-rose-800";
  }
  if (status === "pending") {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-slate-100 text-slate-700";
}

export default async function ReconciliationPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const snapshot = await getProjectSnapshot(projectId);

  if (!snapshot) {
    notFound();
  }

  const run = snapshot.openReconciliation;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Reconciliation"
        title={`Reconciliation for ${snapshot.dataset.project.name}`}
        description="Members confirm how much project money they actually hold in their own bank or cash. The app compares that report against expected project cash custody."
      />

      {!run ? (
        <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
          <CardContent className="py-12 text-center text-slate-600">
            No open reconciliation run for this project yet.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              title="Matched"
              value={`${run.matchedCount}`}
              description="Members whose reported project cash matches expected cash."
              tone="teal"
              icon={<CircleCheckBig className="size-5" />}
            />
            <MetricCard
              title="Pending"
              value={`${run.pendingCount}`}
              description="Members who have not submitted their project-cash check yet."
              tone="amber"
              icon={<Hourglass className="size-5" />}
            />
            <MetricCard
              title="Variance found"
              value={`${run.varianceCount}`}
              description="Members where reported project cash does not match the current ledger expectation."
              tone="red"
              icon={<AlertTriangle className="size-5" />}
            />
          </div>

          <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
            <CardHeader>
              <CardTitle>Open run details</CardTitle>
              <CardDescription>
                Opened {formatDateLabel(run.run.openedAt)} with cutoff{" "}
                {formatDateLabel(run.run.asOf)}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Expected project cash</TableHead>
                    <TableHead>Reported project cash</TableHead>
                    <TableHead>Variance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Member note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {run.checks.map(({ check, profile }) => (
                    <TableRow key={check.id}>
                      <TableCell>{profile.displayName}</TableCell>
                      <TableCell>
                        {formatSignedCurrency(
                          check.expectedProjectCash,
                          snapshot.dataset.project.currencyCode
                        )}
                      </TableCell>
                      <TableCell>
                        {check.reportedProjectCash == null
                          ? "Pending"
                          : formatSignedCurrency(
                              check.reportedProjectCash,
                              snapshot.dataset.project.currencyCode
                            )}
                      </TableCell>
                      <TableCell>
                        {check.varianceAmount == null
                          ? "Pending"
                          : formatSignedCurrency(
                              check.varianceAmount,
                              snapshot.dataset.project.currencyCode
                            )}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("rounded-full", statusTone(check.status))}>
                          {check.status.replaceAll("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[240px] whitespace-normal text-slate-600">
                        {check.memberNote ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
