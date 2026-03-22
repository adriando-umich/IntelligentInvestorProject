import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftRight, Scale } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/finance/metric-card";
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
import { formatCurrency, formatSignedCurrency } from "@/lib/format";

export default async function SettlementsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const snapshot = await getProjectSnapshot(projectId);

  if (!snapshot) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settlements"
        title={`Shared-expense settlement for ${snapshot.dataset.project.name}`}
        description="This page only shows who should pay whom to settle shared expenses. Example: if A paid for B earlier, this page helps record B paying A back. It does not represent profit payout or capital return."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard
          title="Suggested transfers"
          value={`${snapshot.settlementSuggestions.length}`}
          description="The matcher keeps the number of transfers small and easy to explain."
          tone={snapshot.settlementSuggestions.length > 0 ? "amber" : "teal"}
          icon={<ArrowLeftRight className="size-5" />}
        />
        <MetricCard
          title="Total team imbalance"
          value={formatCurrency(
            snapshot.memberSummaries.reduce(
              (sum, summary) => sum + Math.max(summary.teamOwesYou, 0),
              0
            ),
            snapshot.dataset.project.currencyCode
          )}
          description="This is the total positive reimbursement still waiting to be settled."
          tone="blue"
          icon={<Scale className="size-5" />}
        />
      </div>

      <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle>Member reimbursement positions</CardTitle>
          <CardDescription>
            Positive means teammates owe that member. Negative means that member owes teammates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Reimbursement balance</TableHead>
                <TableHead>Team owes you</TableHead>
                <TableHead>You owe team</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.memberSummaries.map((summary) => (
                <TableRow key={summary.projectMember.id}>
                  <TableCell>{summary.profile.displayName}</TableCell>
                  <TableCell>{formatSignedCurrency(summary.expenseReimbursementBalance, snapshot.dataset.project.currencyCode)}</TableCell>
                  <TableCell>{formatCurrency(summary.teamOwesYou, snapshot.dataset.project.currencyCode)}</TableCell>
                  <TableCell>{formatCurrency(summary.youOweTeam, snapshot.dataset.project.currencyCode)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle>Suggested settlement for shared expenses</CardTitle>
          <CardDescription>
            If your team records the payment, choose {`"Record repayment"`} to prefill the planner with the debtor and creditor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Debtor</TableHead>
                <TableHead>Creditor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.settlementSuggestions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-slate-500">
                    Nothing to settle right now.
                  </TableCell>
                </TableRow>
              ) : (
                snapshot.settlementSuggestions.map((suggestion) => {
                  const from = snapshot.memberSummaries.find(
                    (item) => item.projectMember.id === suggestion.fromProjectMemberId
                  );
                  const to = snapshot.memberSummaries.find(
                    (item) => item.projectMember.id === suggestion.toProjectMemberId
                  );

                  return (
                    <TableRow
                      key={`${suggestion.fromProjectMemberId}-${suggestion.toProjectMemberId}`}
                    >
                      <TableCell>{from?.profile.displayName}</TableCell>
                      <TableCell>{to?.profile.displayName}</TableCell>
                      <TableCell>
                        {formatCurrency(
                          suggestion.amount,
                          snapshot.dataset.project.currencyCode
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/projects/${snapshot.dataset.project.id}/ledger/new?type=expense_settlement_payment&from=${suggestion.fromProjectMemberId}&to=${suggestion.toProjectMemberId}&amount=${suggestion.amount}`}
                          className="inline-flex h-7 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-[0.8rem] font-medium text-slate-900 transition hover:bg-slate-100"
                        >
                          Record repayment
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
