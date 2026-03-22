"use client";

import Link from "next/link";
import { CircleAlert, PiggyBank, ReceiptText, Wallet } from "lucide-react";

import { MetricCard } from "@/components/finance/metric-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  entryTypeLabels,
  type MemberStatementSnapshot,
} from "@/lib/finance/types";
import {
  formatCurrency,
  formatDateLabel,
  formatSignedCurrency,
} from "@/lib/format";

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

export function MemberStatement({
  statement,
}: {
  statement: MemberStatementSnapshot;
}) {
  const profileNames = new Map(
    statement.memberDirectory.map((item) => [item.userId, item.displayName])
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/projects/${statement.project.id}`}
          className={cn(buttonVariants({ variant: "outline" }), "rounded-2xl")}
        >
          Back to project
        </Link>
        <Link
          href={`/projects/${statement.project.id}/ledger/new`}
          className={cn(buttonVariants({ variant: "default" }), "rounded-2xl bg-slate-950 text-white hover:bg-slate-800")}
        >
          Add transaction
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Project money you are holding"
          value={formatCurrency(
            Math.max(statement.summary.projectCashCustody, 0),
            statement.project.currencyCode
          )}
          description="Positive custody means project money is currently sitting with this member."
          tone="teal"
          icon={<Wallet className="size-5" />}
        />
        <MetricCard
          title="You fronted your own money"
          value={formatCurrency(
            statement.summary.frontedOwnMoney,
            statement.project.currencyCode
          )}
          description="This is personal money already advanced into the project."
          tone="amber"
          icon={<ReceiptText className="size-5" />}
        />
        <MetricCard
          title="Team owes you"
          value={formatCurrency(
            statement.summary.teamOwesYou,
            statement.project.currencyCode
          )}
          description="Shared expenses left this member in credit against teammates."
          tone="teal"
          icon={<CircleAlert className="size-5" />}
        />
        <MetricCard
          title="Your invested capital"
          value={formatCurrency(
            statement.summary.capitalBalance,
            statement.project.currencyCode
          )}
          description="Only capital changes this member's profit-sharing weight."
          tone="blue"
          icon={<PiggyBank className="size-5" />}
        />
      </div>

      <Card className="rounded-[1.75rem] border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(240,249,255,0.95))]">
        <CardHeader>
          <CardTitle>{`${statement.summary.profile.displayName}'s statement`}</CardTitle>
          <CardDescription>
            Friendly-first view for this member. Shared-expense reimbursement, project cash custody, capital, and profit stay separated on purpose.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="overview" className="gap-6">
        <TabsList className="rounded-2xl bg-slate-100 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="advanced">Advanced view</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
            <CardHeader>
              <CardTitle>What this means in plain language</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-7 text-slate-600">
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="font-medium text-slate-950">Project money you are holding</p>
                <p className="mt-2">
                  {formatSignedCurrency(
                    statement.summary.projectCashCustody,
                    statement.project.currencyCode
                  )}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="font-medium text-slate-950">Shared-expense balance</p>
                <p className="mt-2">
                  {statement.summary.expenseReimbursementBalance >= 0
                    ? `Team owes this member ${formatCurrency(statement.summary.teamOwesYou, statement.project.currencyCode)}`
                    : `This member owes the team ${formatCurrency(statement.summary.youOweTeam, statement.project.currencyCode)}`}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="font-medium text-slate-950">Profit position</p>
                <p className="mt-2">
                  Estimated today: {formatCurrency(statement.summary.estimatedProfitShare, statement.project.currencyCode)}
                </p>
                <p className="mt-1">
                  Already paid: {formatCurrency(statement.summary.profitReceivedTotal, statement.project.currencyCode)}
                </p>
              </div>
              {statement.openReconciliationCheck ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <p className="font-medium text-slate-950">Open reconciliation</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge
                      className={cn(
                        "rounded-full",
                        statusTone(statement.openReconciliationCheck.check.status)
                      )}
                    >
                      {statement.openReconciliationCheck.check.status.replaceAll("_", " ")}
                    </Badge>
                    <span className="text-sm text-slate-500">
                      Expected {formatSignedCurrency(statement.openReconciliationCheck.check.expectedProjectCash, statement.project.currencyCode)}
                    </span>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
            <CardHeader>
              <CardTitle>Balances for this member</CardTitle>
              <CardDescription>
                These numbers are intentionally separated so the user does not need to decode one giant net balance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Balance</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Meaning</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Project cash custody</TableCell>
                    <TableCell>{formatSignedCurrency(statement.summary.projectCashCustody, statement.project.currencyCode)}</TableCell>
                    <TableCell>Where project money currently sits for this member.</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Expense reimbursement</TableCell>
                    <TableCell>{formatSignedCurrency(statement.summary.expenseReimbursementBalance, statement.project.currencyCode)}</TableCell>
                    <TableCell>Positive means teammates owe this member. Negative means this member owes teammates.</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Capital invested</TableCell>
                    <TableCell>{formatCurrency(statement.summary.capitalBalance, statement.project.currencyCode)}</TableCell>
                    <TableCell>The basis for profit-sharing weight.</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Operating P&amp;L share</TableCell>
                    <TableCell>{formatSignedCurrency(statement.summary.operatingPnlShare, statement.project.currencyCode)}</TableCell>
                    <TableCell>Allocated operating income minus allocated operating expenses.</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Profit already paid</TableCell>
                    <TableCell>{formatCurrency(statement.summary.profitReceivedTotal, statement.project.currencyCode)}</TableCell>
                    <TableCell>Money already distributed as profit.</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
            <CardHeader>
              <CardTitle>Entries touching this member</CardTitle>
              <CardDescription>
                Includes transactions where this member paid, received, or was part of an allocation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Money in</TableHead>
                    <TableHead>Money out</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statement.relatedEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDateLabel(entry.effectiveAt)}</TableCell>
                      <TableCell>{entryTypeLabels[entry.entryType]}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-950">{entry.description}</p>
                          <p className="text-xs text-slate-500">
                            {entry.cashInMemberId ? `In: ${profileNames.get(entry.cashInMemberId)}` : "No receiver"}
                            {entry.cashOutMemberId ? ` • Out: ${profileNames.get(entry.cashOutMemberId)}` : ""}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{entry.cashInMemberId ? profileNames.get(entry.cashInMemberId) : "-"}</TableCell>
                      <TableCell>{entry.cashOutMemberId ? profileNames.get(entry.cashOutMemberId) : "-"}</TableCell>
                      <TableCell>{formatCurrency(entry.amount, entry.currencyCode)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced">
          <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
            <CardHeader>
              <CardTitle>Advanced view</CardTitle>
              <CardDescription>
                Use this when the team wants the technical wording. The friendly cards above remain the default presentation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-slate-600">
              <p>
                `project_cash_custody` is derived from money in minus money out on ledger entries where this member is a cash holder.
              </p>
              <p>
                `expense_reimbursement_balance` is derived from shared expenses and settlement payments, using the Splitwise-style creditor/debtor matcher at project level.
              </p>
              <p>
                `capital_balance` controls profit preview weight. Normal operating activity never changes that number.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
