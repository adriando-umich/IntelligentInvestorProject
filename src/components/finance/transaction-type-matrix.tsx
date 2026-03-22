"use client";

import {
  businessEntryTypes,
  correctionEntryTypes,
  entryFamilyLabels,
  entryTypeLabels,
  type BusinessEntryType,
  type CorrectionEntryType,
} from "@/lib/finance/types";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type MatrixRow = {
  entryType: BusinessEntryType | CorrectionEntryType;
  useWhen: string;
  example: string;
  cashEffect: string;
  reimbursementEffect: string;
  capitalEffect: string;
  pnlEffect: string;
};

const businessRows: MatrixRow[] = [
  {
    entryType: "capital_contribution",
    useWhen: "A member puts investable capital into the project.",
    example: "A contributes 10 dong and should earn future profit weight from it.",
    cashEffect: "Money comes in",
    reimbursementEffect: "No",
    capitalEffect: "Up",
    pnlEffect: "No",
  },
  {
    entryType: "capital_return",
    useWhen: "The project gives invested capital back to a member.",
    example: "Return part of the original capital after a sale milestone.",
    cashEffect: "Money goes out",
    reimbursementEffect: "No",
    capitalEffect: "Down",
    pnlEffect: "No",
  },
  {
    entryType: "operating_income",
    useWhen: "The project earns normal business income.",
    example: "Buyer deposit, option premium, service fee, or rent.",
    cashEffect: "Money comes in",
    reimbursementEffect: "No",
    capitalEffect: "No",
    pnlEffect: "Operating P&L up",
  },
  {
    entryType: "shared_loan_drawdown",
    useWhen: "Borrowed principal enters the project from a shared loan.",
    example: "The bank disburses a loan used by the whole project team.",
    cashEffect: "Money comes in",
    reimbursementEffect: "No",
    capitalEffect: "No",
    pnlEffect: "No",
  },
  {
    entryType: "shared_loan_repayment_principal",
    useWhen: "The project repays shared loan principal back to the lender.",
    example: "Pay down bank principal after closing without treating it as expense.",
    cashEffect: "Money goes out",
    reimbursementEffect: "No",
    capitalEffect: "No",
    pnlEffect: "No",
  },
  {
    entryType: "operating_expense",
    useWhen: "The project pays a normal cost that should hit operating P&L.",
    example: "Legal, marketing, contractor, survey, or loan interest.",
    cashEffect: "Money goes out",
    reimbursementEffect: "Can create teammate debt",
    capitalEffect: "No",
    pnlEffect: "Operating P&L down",
  },
  {
    entryType: "cash_handover",
    useWhen: "Project cash simply moves from one member to another.",
    example: "Linh hands Bao cash to handle onsite payments.",
    cashEffect: "Moves between members",
    reimbursementEffect: "No",
    capitalEffect: "No",
    pnlEffect: "No",
  },
  {
    entryType: "expense_settlement_payment",
    useWhen: "One member pays another member back for a shared expense.",
    example: "A paid for B earlier, then B sends the money back to A.",
    cashEffect: "Moves between members",
    reimbursementEffect: "Reduces teammate debt",
    capitalEffect: "No",
    pnlEffect: "No",
  },
  {
    entryType: "profit_distribution",
    useWhen: "The project pays profit out to members.",
    example: "Distribute profit based only on current capital balances.",
    cashEffect: "Money goes out",
    reimbursementEffect: "No",
    capitalEffect: "No",
    pnlEffect: "Moves profit from retained to paid",
  },
];

const correctionRows: MatrixRow[] = [
  {
    entryType: "reconciliation_adjustment",
    useWhen: "Expected project cash needs a correcting entry after reconciliation.",
    example: "A member reported a balance variance that must be booked.",
    cashEffect: "Adjusts one side",
    reimbursementEffect: "No",
    capitalEffect: "No",
    pnlEffect: "No",
  },
  {
    entryType: "reversal",
    useWhen: "An earlier ledger entry must be backed out instead of edited in place.",
    example: "A wrong transaction was posted and needs a clean reversal trail.",
    cashEffect: "Reverses original",
    reimbursementEffect: "Reverses original",
    capitalEffect: "Reverses original",
    pnlEffect: "Reverses original",
  },
];

function MatrixTable({ rows }: { rows: MatrixRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">Transaction type</TableHead>
            <TableHead className="min-w-[280px]">Use this when</TableHead>
            <TableHead className="min-w-[160px]">Cash</TableHead>
            <TableHead className="min-w-[180px]">Reimbursement</TableHead>
            <TableHead className="min-w-[120px]">Capital</TableHead>
            <TableHead className="min-w-[160px]">P&amp;L / Profit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.entryType}>
              <TableCell className="align-top">
                <div className="space-y-2">
                  <Badge className="rounded-full bg-slate-900 text-white">
                    {entryTypeLabels[row.entryType]}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="align-top">
                <p className="font-medium text-slate-950">{row.useWhen}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {row.example}
                </p>
              </TableCell>
              <TableCell className="align-top text-sm text-slate-700">
                {row.cashEffect}
              </TableCell>
              <TableCell className="align-top text-sm text-slate-700">
                {row.reimbursementEffect}
              </TableCell>
              <TableCell className="align-top text-sm text-slate-700">
                {row.capitalEffect}
              </TableCell>
              <TableCell className="align-top text-sm text-slate-700">
                {row.pnlEffect}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function TransactionTypeMatrix() {
  return (
    <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
      <CardHeader>
        <CardTitle>Which transaction should I use?</CardTitle>
        <CardDescription>
          The app now classifies entries on two axes: family and type. Start by
          asking whether you are recording a real business event or just fixing
          the ledger.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-center gap-2">
              <Badge className="rounded-full bg-slate-900 text-white">
                {entryFamilyLabels.business}
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Use this for real-world money events like capital, expenses,
              income, loan principal movements, cash handovers, repayments, and
              profit payouts.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-center gap-2">
              <Badge className="rounded-full bg-white text-slate-900 ring-1 ring-slate-200">
                {entryFamilyLabels.correction}
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Use this only when you are correcting or reversing the ledger, not
              when a new business event happened in the real world.
            </p>
          </div>
        </div>

        <Tabs defaultValue="business" className="gap-4">
          <TabsList className="rounded-2xl bg-slate-100 p-1">
            <TabsTrigger value="business">
              Business events ({businessEntryTypes.length})
            </TabsTrigger>
            <TabsTrigger value="correction">
              Corrections ({correctionEntryTypes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="business">
            <MatrixTable rows={businessRows} />
          </TabsContent>
          <TabsContent value="correction">
            <MatrixTable rows={correctionRows} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
