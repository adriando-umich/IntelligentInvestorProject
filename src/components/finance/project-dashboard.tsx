"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  BanknoteArrowDown,
  BanknoteArrowUp,
  CircleAlert,
  HandCoins,
  Landmark,
  PiggyBank,
  Tags,
  Wallet,
} from "lucide-react";

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { entryTypeLabels, type ProjectSnapshot } from "@/lib/finance/types";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDateLabel,
  formatPercent,
  formatSignedCurrency,
} from "@/lib/format";

function reconciliationTone(status: string) {
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

function entryTone(entryType: keyof typeof entryTypeLabels) {
  if (entryType === "operating_income") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (entryType === "shared_loan_drawdown") {
    return "bg-sky-100 text-sky-800";
  }
  if (entryType === "operating_expense") {
    return "bg-rose-100 text-rose-800";
  }
  if (entryType === "capital_contribution" || entryType === "capital_return") {
    return "bg-sky-100 text-sky-800";
  }
  if (entryType === "profit_distribution") {
    return "bg-violet-100 text-violet-800";
  }
  return "bg-slate-100 text-slate-700";
}

export function ProjectDashboard({ snapshot }: { snapshot: ProjectSnapshot }) {
  const profileNames = new Map(
    snapshot.memberSummaries.map((summary) => [
      summary.projectMember.userId,
      summary.profile.displayName,
    ])
  );
  const tagNameById = new Map(
    snapshot.dataset.tags.map((tag) => [tag.id, tag.name])
  );
  const tagNamesByEntryId = new Map<string, string[]>();

  for (const entryTag of snapshot.dataset.entryTags) {
    const current = tagNamesByEntryId.get(entryTag.ledgerEntryId) ?? [];
    const tagName = tagNameById.get(entryTag.projectTagId);

    if (tagName) {
      current.push(tagName);
      tagNamesByEntryId.set(entryTag.ledgerEntryId, current);
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/projects/${snapshot.dataset.project.id}/ledger/new`}
            className={cn(buttonVariants({ variant: "default", size: "lg" }), "rounded-2xl bg-slate-950 px-4 text-white hover:bg-slate-800")}
          >
            Add transaction
          </Link>
          <Link
            href={`/projects/${snapshot.dataset.project.id}/settlements`}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-2xl border-teal-200 bg-teal-50 px-4 text-teal-900 hover:bg-teal-100")}
          >
            Review settlements
          </Link>
          <Link
            href={`/projects/${snapshot.dataset.project.id}/reconciliation`}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-2xl px-4")}
          >
            Reconciliation
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            title="Money in the project now"
            value={formatCurrency(snapshot.totalProjectCash, snapshot.dataset.project.currencyCode)}
            description="This is the net project money currently expected to exist across all member-held accounts."
            tone="teal"
            icon={<Wallet className="size-5" />}
          />
          <MetricCard
            title="Members holding project money"
            value={formatCurrency(snapshot.membersHoldingProjectCashTotal, snapshot.dataset.project.currencyCode)}
            description="Positive balances mean the member is currently holding project money."
            tone="blue"
            icon={<BanknoteArrowDown className="size-5" />}
          />
          <MetricCard
            title="Members fronting their own money"
            value={formatCurrency(snapshot.frontedByMembersTotal, snapshot.dataset.project.currencyCode)}
            description="Negative cash custody means the project currently owes that member their own money back."
            tone="amber"
            icon={<BanknoteArrowUp className="size-5" />}
          />
          <MetricCard
            title="Capital invested"
            value={formatCurrency(snapshot.totalCapitalOutstanding, snapshot.dataset.project.currencyCode)}
            description="Only capital changes profit-sharing weight. Shared expenses do not change this number."
            tone="blue"
            icon={<PiggyBank className="size-5" />}
          />
          <MetricCard
            title="Estimated profit if distributed today"
            value={formatCurrency(Math.max(snapshot.undistributedProfit, 0), snapshot.dataset.project.currencyCode)}
            description="This is undistributed operating profit. It is only a preview until a manager posts a profit distribution."
            tone="teal"
            icon={<HandCoins className="size-5" />}
          />
          <MetricCard
            title="Open settlement actions"
            value={`${snapshot.settlementSuggestions.length}`}
            description="Suggested transfers for shared expenses only. This is separate from capital and profit."
            tone={snapshot.settlementSuggestions.length > 0 ? "red" : "slate"}
            icon={<ArrowLeftRight className="size-5" />}
          />
        </div>

        <Card className="rounded-[1.75rem] border-white/70 bg-[linear-gradient(135deg,rgba(240,253,250,0.96),rgba(255,255,255,0.94))] shadow-[0_26px_80px_-45px_rgba(15,23,42,0.35)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-950">
              <CircleAlert className="size-4 text-teal-700" />
              Why the numbers stay separate
            </CardTitle>
            <CardDescription className="text-slate-600">
              This dashboard intentionally separates project cash, teammate reimbursements, capital, and profit. That keeps the app understandable even for people who do not speak accounting.
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs defaultValue="overview" className="gap-6">
          <TabsList className="rounded-2xl bg-slate-100 p-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="settlements">Settlements</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
            <TabsTrigger value="capital">Capital</TabsTrigger>
            <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
            <TabsTrigger value="advanced">Advanced view</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
              <CardHeader>
                <CardTitle>Who is holding project money</CardTitle>
                <CardDescription>
                  Positive numbers mean the member is holding project money. {`"Fronted own money"`} means they used their own bank balance for project activity.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Project money held</TableHead>
                      <TableHead>Fronted own money</TableHead>
                      <TableHead>Team owes you</TableHead>
                      <TableHead>You owe team</TableHead>
                      <TableHead>Estimated profit today</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshot.memberSummaries.map((summary) => (
                      <TableRow key={summary.projectMember.id}>
                        <TableCell className="font-medium text-slate-950">
                          <Link
                            href={`/projects/${snapshot.dataset.project.id}/members/${summary.projectMember.id}`}
                            className="hover:text-teal-700"
                          >
                            {summary.profile.displayName}
                          </Link>
                        </TableCell>
                        <TableCell>{formatSignedCurrency(summary.projectCashCustody, snapshot.dataset.project.currencyCode)}</TableCell>
                        <TableCell>{formatCurrency(summary.frontedOwnMoney, snapshot.dataset.project.currencyCode)}</TableCell>
                        <TableCell className="text-emerald-700">{formatCurrency(summary.teamOwesYou, snapshot.dataset.project.currencyCode)}</TableCell>
                        <TableCell className="text-rose-700">{formatCurrency(summary.youOweTeam, snapshot.dataset.project.currencyCode)}</TableCell>
                        <TableCell>{formatCurrency(summary.estimatedProfitShare, snapshot.dataset.project.currencyCode)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
              <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
                <CardHeader>
                  <CardTitle>Recent activity</CardTitle>
                  <CardDescription>
                    Latest posted transactions in this project ledger.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {snapshot.recentEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={cn("rounded-full", entryTone(entry.entryType))}>
                              {entryTypeLabels[entry.entryType]}
                            </Badge>
                            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                              {formatDateLabel(entry.effectiveAt)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-slate-950">{entry.description}</p>
                            <p className="text-sm text-slate-500">
                              {entry.cashInMemberId ? `In: ${profileNames.get(entry.cashInMemberId)}` : "No receiving member"}
                              {entry.cashOutMemberId ? ` • Out: ${profileNames.get(entry.cashOutMemberId)}` : ""}
                            </p>
                            {tagNamesByEntryId.get(entry.id)?.length ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {tagNamesByEntryId.get(entry.id)?.map((tagName) => (
                                  <Badge
                                    key={`${entry.id}-${tagName}`}
                                    className="rounded-full bg-slate-100 text-slate-700"
                                  >
                                    {tagName}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <p className="text-right text-lg font-semibold text-slate-950">
                          {formatCurrency(entry.amount, entry.currencyCode)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
                  <CardHeader>
                    <CardTitle>Who owes whom for shared expenses</CardTitle>
                    <CardDescription>
                      These suggested transfers settle only shared expenses. They do not change capital ownership.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {snapshot.settlementSuggestions.length === 0 ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                        Shared-expense balances are already settled.
                      </div>
                    ) : (
                      snapshot.settlementSuggestions.map((suggestion) => (
                        <div
                          key={`${suggestion.fromProjectMemberId}-${suggestion.toProjectMemberId}`}
                          className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4"
                        >
                          <p className="font-medium text-slate-950">
                            {snapshot.memberSummaries.find((item) => item.projectMember.id === suggestion.fromProjectMemberId)?.profile.displayName} pays{" "}
                            {snapshot.memberSummaries.find((item) => item.projectMember.id === suggestion.toProjectMemberId)?.profile.displayName}
                          </p>
                          <p className="mt-2 text-sm text-slate-600">
                            {formatCurrency(suggestion.amount, snapshot.dataset.project.currencyCode)}
                          </p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
                  <CardHeader>
                    <CardTitle>Reconciliation health</CardTitle>
                    <CardDescription>
                      Members compare expected project cash with what they actually hold in their own accounts.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {snapshot.openReconciliation ? (
                      <>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl bg-emerald-50 px-4 py-4">
                            <p className="text-sm text-emerald-700">Matched</p>
                            <p className="mt-2 text-2xl font-semibold text-emerald-900">
                              {snapshot.openReconciliation.matchedCount}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-amber-50 px-4 py-4">
                            <p className="text-sm text-amber-700">Pending</p>
                            <p className="mt-2 text-2xl font-semibold text-amber-900">
                              {snapshot.openReconciliation.pendingCount}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-rose-50 px-4 py-4">
                            <p className="text-sm text-rose-700">Variance</p>
                            <p className="mt-2 text-2xl font-semibold text-rose-900">
                              {snapshot.openReconciliation.varianceCount}
                            </p>
                          </div>
                        </div>
                        <Link
                          href={`/projects/${snapshot.dataset.project.id}/reconciliation`}
                          className={cn(buttonVariants({ variant: "outline" }), "mt-1 rounded-2xl")}
                        >
                          Open reconciliation details
                        </Link>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                        No open reconciliation run right now.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settlements">
            <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
              <CardHeader>
                <CardTitle>Suggested settlement for shared expenses</CardTitle>
                <CardDescription>
                  The greedy matcher keeps the recommendation easy to explain: people who owe the team pay the people who fronted the most.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Debtor</TableHead>
                      <TableHead>Creditor</TableHead>
                      <TableHead>Suggested payment</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshot.settlementSuggestions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-slate-500">
                          No outstanding shared-expense settlements.
                        </TableCell>
                      </TableRow>
                    ) : (
                      snapshot.settlementSuggestions.map((suggestion) => (
                        <TableRow key={`${suggestion.fromProjectMemberId}-${suggestion.toProjectMemberId}-full`}>
                          <TableCell>{snapshot.memberSummaries.find((item) => item.projectMember.id === suggestion.fromProjectMemberId)?.profile.displayName}</TableCell>
                          <TableCell>{snapshot.memberSummaries.find((item) => item.projectMember.id === suggestion.toProjectMemberId)?.profile.displayName}</TableCell>
                          <TableCell>{formatCurrency(suggestion.amount, snapshot.dataset.project.currencyCode)}</TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={`/projects/${snapshot.dataset.project.id}/ledger/new?type=expense_settlement_payment&from=${suggestion.fromProjectMemberId}&to=${suggestion.toProjectMemberId}&amount=${suggestion.amount}`}
                              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl")}
                            >
                              Record as paid
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tags">
            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tags className="size-4 text-teal-700" />
                    Tagged money in
                  </CardTitle>
                  <CardDescription>
                    This rolls up tagged inflows, including operating income and
                    shared loan drawdowns. Loan drawdowns raise project cash,
                    but they do not count as profit.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {snapshot.inflowTagRollups.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
                      No inflow tags yet.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tag</TableHead>
                          <TableHead>Tagged amount</TableHead>
                          <TableHead>Entries</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {snapshot.inflowTagRollups.map((row) => (
                          <TableRow key={row.projectTagId}>
                            <TableCell className="font-medium text-slate-950">
                              {row.name}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(
                                row.amount,
                                snapshot.dataset.project.currencyCode
                              )}
                            </TableCell>
                            <TableCell>{row.entryCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Landmark className="size-4 text-rose-700" />
                    Tagged expense
                  </CardTitle>
                  <CardDescription>
                    Use tags like legal, bank-interest, survey, or marketing to
                    see which kinds of cost are accumulating across the project.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {snapshot.expenseTagRollups.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
                      No expense tags yet.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tag</TableHead>
                          <TableHead>Tagged amount</TableHead>
                          <TableHead>Entries</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {snapshot.expenseTagRollups.map((row) => (
                          <TableRow key={row.projectTagId}>
                            <TableCell className="font-medium text-slate-950">
                              {row.name}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(
                                row.amount,
                                snapshot.dataset.project.currencyCode
                              )}
                            </TableCell>
                            <TableCell>{row.entryCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="capital">
            <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
              <CardHeader>
                <CardTitle>Capital and profit-sharing weight</CardTitle>
                <CardDescription>
                  Only members with positive capital participate in profit preview. The remainder is assigned to the largest capital holder after rounding.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Capital invested</TableHead>
                      <TableHead>Profit weight</TableHead>
                      <TableHead>Estimated profit today</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshot.capitalWeights.map((row) => (
                      <TableRow key={row.projectMemberId}>
                        <TableCell>{row.displayName}</TableCell>
                        <TableCell>{formatCurrency(row.capitalBalance, snapshot.dataset.project.currencyCode)}</TableCell>
                        <TableCell>{formatPercent(row.weight)}</TableCell>
                        <TableCell>{formatCurrency(row.estimatedProfitShare, snapshot.dataset.project.currencyCode)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reconciliation">
            <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
              <CardHeader>
                <CardTitle>Open reconciliation run</CardTitle>
                <CardDescription>
                  This compares the {`app's`} expected project cash per member with what that member reports they actually hold.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!snapshot.openReconciliation ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    No open reconciliation run.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Expected project cash</TableHead>
                        <TableHead>Reported project cash</TableHead>
                        <TableHead>Variance</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {snapshot.openReconciliation.checks.map(({ check, profile }) => (
                        <TableRow key={check.id}>
                          <TableCell>{profile.displayName}</TableCell>
                          <TableCell>{formatSignedCurrency(check.expectedProjectCash, snapshot.dataset.project.currencyCode)}</TableCell>
                          <TableCell>
                            {check.reportedProjectCash == null
                              ? "Pending"
                              : formatSignedCurrency(check.reportedProjectCash, snapshot.dataset.project.currencyCode)}
                          </TableCell>
                          <TableCell>
                            {check.varianceAmount == null
                              ? "Pending"
                              : formatSignedCurrency(check.varianceAmount, snapshot.dataset.project.currencyCode)}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("rounded-full", reconciliationTone(check.status))}>
                              {check.status.replaceAll("_", " ")}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced">
            <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
              <CardHeader>
                <CardTitle>Advanced technical breakdown</CardTitle>
                <CardDescription>
                  The friendly dashboard above is the default. This section exposes the raw technical meaning underneath.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-950">Operating totals</p>
                    <Tooltip>
                      <TooltipTrigger className="text-slate-400">
                        <CircleAlert className="size-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Operating profit is income minus operating expense before profit distributions.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <p>Income: {formatCompactCurrency(snapshot.projectOperatingIncome, snapshot.dataset.project.currencyCode)}</p>
                    <p>Expense: {formatCompactCurrency(snapshot.projectOperatingExpense, snapshot.dataset.project.currencyCode)}</p>
                    <p>Profit paid: {formatCompactCurrency(snapshot.totalProfitDistributed, snapshot.dataset.project.currencyCode)}</p>
                    <p className="font-medium text-slate-950">
                      Undistributed profit: {formatCompactCurrency(snapshot.undistributedProfit, snapshot.dataset.project.currencyCode)}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                  <p className="font-medium text-slate-950">Model guardrails</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                    <li>Cash custody tracks where project money physically sits.</li>
                    <li>Reimbursement tracks who owes whom because of shared expenses.</li>
                    <li>Capital drives profit weight.</li>
                    <li>Profit is only paid when a manager posts a distribution.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
