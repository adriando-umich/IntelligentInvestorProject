import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { LedgerEntryPlanner } from "@/components/finance/ledger-entry-planner";
import { getSessionState } from "@/lib/auth/session";
import { getProjectSnapshot } from "@/lib/data/repository";
import { type PlannerEntryType } from "@/lib/finance/entry-form";

function isEntryType(value: string | undefined): value is PlannerEntryType {
  return (
    value === "capital_contribution" ||
    value === "capital_return" ||
    value === "operating_income" ||
    value === "shared_loan_drawdown" ||
    value === "operating_expense" ||
    value === "cash_handover" ||
    value === "expense_settlement_payment" ||
    value === "profit_distribution"
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
        description="Use this planner to record capital, tagged inflows, shared loan drawdowns, operating expenses, project cash handovers, or member repayments. Example: if A paid for B earlier and B returns the money to A, record that here as a member repayment. In the sample workspace it stays preview-only, while live signed-in projects can save supported transaction types directly to Supabase."
      />
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
