import { notFound } from "next/navigation";
import Link from "next/link";

import { PageHeader } from "@/components/app/page-header";
import { LedgerEntryPlanner } from "@/components/finance/ledger-entry-planner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionState } from "@/lib/auth/session";
import { getProjectSnapshot } from "@/lib/data/repository";
import { type PlannerEntryType } from "@/lib/finance/entry-form";

function isEntryType(value: string | undefined): value is PlannerEntryType {
  return (
    value === "capital_contribution" ||
    value === "capital_return" ||
    value === "operating_income" ||
    value === "shared_loan_drawdown" ||
    value === "shared_loan_repayment_principal" ||
    value === "shared_loan_interest_payment" ||
    value === "operating_expense" ||
    value === "cash_handover" ||
    value === "expense_settlement_payment" ||
    value === "profit_distribution" ||
    value === "reconciliation_adjustment"
  );
}

export default async function NewLedgerEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const [snapshot, session] = await Promise.all([
    getProjectSnapshot(projectId),
    getSessionState(),
  ]);

  if (!snapshot) {
    notFound();
  }

  const queryType = Array.isArray(query.type) ? query.type[0] : query.type;
  const queryAmount = Array.isArray(query.amount) ? query.amount[0] : query.amount;
  const queryFrom = Array.isArray(query.from) ? query.from[0] : query.from;
  const queryTo = Array.isArray(query.to) ? query.to[0] : query.to;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Ledger planner"
        title={`Add a transaction for ${snapshot.dataset.project.name}`}
        description="Use this planner to record capital, tagged inflows, shared loan drawdowns, shared loan principal repayments, shared loan interest payments, operating expenses, project cash handovers, or member repayments. Example: if A paid for B earlier and B returns the money to A, record that here as a member repayment. In the sample workspace it stays preview-only, while live signed-in projects can save supported transaction types directly to Supabase."
      />
      <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle>Need help choosing the right transaction?</CardTitle>
          <CardDescription>
            The full helper matrix now lives on its own page so this planner
            stays focused. Open the guide for the full business-versus-correction
            reference, or open tag management if you need to clean up reporting
            categories first.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link
            href={`/projects/${snapshot.dataset.project.id}/ledger/guide`}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Open transaction guide
          </Link>
          <Link
            href={`/projects/${snapshot.dataset.project.id}/tags`}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Manage tags
          </Link>
        </CardContent>
      </Card>
      <LedgerEntryPlanner
        projectId={snapshot.dataset.project.id}
        projectName={snapshot.dataset.project.name}
        currencyCode={snapshot.dataset.project.currencyCode}
        memberOptions={snapshot.memberSummaries.map((summary) => ({
          id: summary.projectMember.id,
          name: summary.profile.displayName,
        }))}
        tagOptions={snapshot.dataset.tags.map((tag) => tag.name)}
        initialValues={{
          projectId: snapshot.dataset.project.id,
          currencyCode: snapshot.dataset.project.currencyCode,
          entryType: isEntryType(queryType) ? queryType : undefined,
          amount: queryAmount ? Number(queryAmount) : undefined,
          cashOutProjectMemberId: queryFrom,
          cashInProjectMemberId: queryTo,
          description:
            queryType === "expense_settlement_payment" && queryFrom && queryTo
              ? "Member repayment recorded from suggestion"
              : "",
        }}
        liveModeEnabled={!session.demoMode}
      />
    </div>
  );
}
