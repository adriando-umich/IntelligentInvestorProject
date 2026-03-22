"use client";

import {
  businessEntryTypes,
  correctionEntryTypes,
  getEntryFamilyLabel,
  getEntryTypeLabel,
  type BusinessEntryType,
  type CorrectionEntryType,
} from "@/lib/finance/types";
import { useLocale } from "@/components/app/locale-provider";
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
  useWhenEn: string;
  useWhenVi: string;
  exampleEn: string;
  exampleVi: string;
  cashEffectEn: string;
  cashEffectVi: string;
  reimbursementEffectEn: string;
  reimbursementEffectVi: string;
  capitalEffectEn: string;
  capitalEffectVi: string;
  pnlEffectEn: string;
  pnlEffectVi: string;
};

const businessRows: MatrixRow[] = [
  {
    entryType: "capital_contribution",
    useWhenEn: "A member puts investable capital into the project.",
    useWhenVi: "Một thành viên đưa vốn góp thật vào dự án.",
    exampleEn: "A contributes 10 dong and should earn future profit weight from it.",
    exampleVi: "A góp 10 đồng và về sau sẽ được tính tỷ trọng lợi nhuận từ phần vốn này.",
    cashEffectEn: "Money comes in",
    cashEffectVi: "Tiền đi vào",
    reimbursementEffectEn: "No",
    reimbursementEffectVi: "Không",
    capitalEffectEn: "Up",
    capitalEffectVi: "Tăng",
    pnlEffectEn: "No",
    pnlEffectVi: "Không",
  },
  {
    entryType: "capital_return",
    useWhenEn: "The project gives invested capital back to a member.",
    useWhenVi: "Dự án hoàn lại phần vốn đã góp cho một thành viên.",
    exampleEn: "Return part of the original capital after a sale milestone.",
    exampleVi: "Hoàn lại một phần vốn sau khi đã đạt một mốc bán hàng.",
    cashEffectEn: "Money goes out",
    cashEffectVi: "Tiền đi ra",
    reimbursementEffectEn: "No",
    reimbursementEffectVi: "Không",
    capitalEffectEn: "Down",
    capitalEffectVi: "Giảm",
    pnlEffectEn: "No",
    pnlEffectVi: "Không",
  },
  {
    entryType: "operating_income",
    useWhenEn: "The project earns normal business income.",
    useWhenVi: "Dự án thu được tiền vào vận hành thông thường.",
    exampleEn: "Buyer deposit, option premium, service fee, or rent.",
    exampleVi: "Tiền cọc của khách, phí dịch vụ, premium option hoặc tiền thuê.",
    cashEffectEn: "Money comes in",
    cashEffectVi: "Tiền đi vào",
    reimbursementEffectEn: "No",
    reimbursementEffectVi: "Không",
    capitalEffectEn: "No",
    capitalEffectVi: "Không",
    pnlEffectEn: "Operating P&L up",
    pnlEffectVi: "P&L vận hành tăng",
  },
  {
    entryType: "shared_loan_drawdown",
    useWhenEn: "Borrowed principal enters the project from a shared loan.",
    useWhenVi: "Tiền vay chung được giải ngân vào dự án.",
    exampleEn: "The bank disburses a loan used by the whole project team.",
    exampleVi: "Ngân hàng giải ngân khoản vay mà cả đội cùng dùng cho dự án.",
    cashEffectEn: "Money comes in",
    cashEffectVi: "Tiền đi vào",
    reimbursementEffectEn: "No",
    reimbursementEffectVi: "Không",
    capitalEffectEn: "No",
    capitalEffectVi: "Không",
    pnlEffectEn: "No",
    pnlEffectVi: "Không",
  },
  {
    entryType: "shared_loan_repayment_principal",
    useWhenEn: "The project repays shared loan principal back to the lender.",
    useWhenVi: "Dự án trả lại phần gốc của khoản vay chung cho bên cho vay.",
    exampleEn: "Pay down bank principal after closing without treating it as expense.",
    exampleVi: "Trả bớt gốc vay ngân hàng sau khi chốt deal mà không hạch toán vào chi phí.",
    cashEffectEn: "Money goes out",
    cashEffectVi: "Tiền đi ra",
    reimbursementEffectEn: "No",
    reimbursementEffectVi: "Không",
    capitalEffectEn: "No",
    capitalEffectVi: "Không",
    pnlEffectEn: "No",
    pnlEffectVi: "Không",
  },
  {
    entryType: "shared_loan_interest_payment",
    useWhenEn: "The project pays shared loan interest and the team shares that bank cost.",
    useWhenVi: "Dự án trả lãi vay chung và cả team cùng chia khoản chi phí ngân hàng này.",
    exampleEn: "Monthly bank interest on the project loan is paid from one member account and shared across members.",
    exampleVi: "Lãi vay ngân hàng hằng tháng được một thành viên trả trước rồi chia cho các thành viên liên quan.",
    cashEffectEn: "Money goes out",
    cashEffectVi: "Tiền đi ra",
    reimbursementEffectEn: "Can create teammate debt",
    reimbursementEffectVi: "Có thể tạo khoản nợ giữa thành viên",
    capitalEffectEn: "No",
    capitalEffectVi: "Không",
    pnlEffectEn: "Operating P&L down",
    pnlEffectVi: "P&L vận hành giảm",
  },
  {
    entryType: "operating_expense",
    useWhenEn: "The project pays a normal cost that should hit operating P&L.",
    useWhenVi: "Dự án trả một chi phí vận hành bình thường cần đi vào P&L.",
    exampleEn: "Legal, marketing, contractor, survey, utilities, or permit costs.",
    exampleVi: "Chi phí pháp lý, marketing, nhà thầu, khảo sát, điện nước hoặc giấy phép.",
    cashEffectEn: "Money goes out",
    cashEffectVi: "Tiền đi ra",
    reimbursementEffectEn: "Can create teammate debt",
    reimbursementEffectVi: "Có thể tạo khoản nợ giữa thành viên",
    capitalEffectEn: "No",
    capitalEffectVi: "Không",
    pnlEffectEn: "Operating P&L down",
    pnlEffectVi: "P&L vận hành giảm",
  },
  {
    entryType: "cash_handover",
    useWhenEn: "Project cash simply moves from one member to another.",
    useWhenVi: "Tiền dự án chỉ chuyển từ một thành viên sang thành viên khác.",
    exampleEn: "Linh hands Bao cash to handle onsite payments.",
    exampleVi: "Linh đưa tiền cho Bảo để Bảo xử lý các khoản thanh toán tại công trường.",
    cashEffectEn: "Moves between members",
    cashEffectVi: "Di chuyển giữa thành viên",
    reimbursementEffectEn: "No",
    reimbursementEffectVi: "Không",
    capitalEffectEn: "No",
    capitalEffectVi: "Không",
    pnlEffectEn: "No",
    pnlEffectVi: "Không",
  },
  {
    entryType: "expense_settlement_payment",
    useWhenEn: "One member pays another member back for a shared expense.",
    useWhenVi: "Một thành viên trả lại tiền cho thành viên khác vì chi phí chung trước đó.",
    exampleEn: "A paid for B earlier, then B sends the money back to A.",
    exampleVi: "A đã trả hộ B trước đó, sau đó B gửi tiền lại cho A.",
    cashEffectEn: "Moves between members",
    cashEffectVi: "Di chuyển giữa thành viên",
    reimbursementEffectEn: "Reduces teammate debt",
    reimbursementEffectVi: "Giảm khoản nợ giữa thành viên",
    capitalEffectEn: "No",
    capitalEffectVi: "Không",
    pnlEffectEn: "No",
    pnlEffectVi: "Không",
  },
  {
    entryType: "profit_distribution",
    useWhenEn: "The project pays profit out to members.",
    useWhenVi: "Dự án trả lợi nhuận cho các thành viên.",
    exampleEn: "Distribute profit based only on current capital balances.",
    exampleVi: "Chia lợi nhuận chỉ dựa trên số dư vốn góp hiện tại.",
    cashEffectEn: "Money goes out",
    cashEffectVi: "Tiền đi ra",
    reimbursementEffectEn: "No",
    reimbursementEffectVi: "Không",
    capitalEffectEn: "No",
    capitalEffectVi: "Không",
    pnlEffectEn: "Moves profit from retained to paid",
    pnlEffectVi: "Chuyển lợi nhuận từ giữ lại sang đã trả",
  },
];

const correctionRows: MatrixRow[] = [
  {
    entryType: "reconciliation_adjustment",
    useWhenEn: "Expected project cash needs a correcting entry after reconciliation.",
    useWhenVi: "Tiền dự án kỳ vọng cần được điều chỉnh sau khi đối chiếu.",
    exampleEn: "A member reported a balance variance that must be booked.",
    exampleVi: "Một thành viên báo có chênh lệch số dư và bạn cần ghi nhận lại vào sổ.",
    cashEffectEn: "Adjusts one side",
    cashEffectVi: "Điều chỉnh một bên",
    reimbursementEffectEn: "No",
    reimbursementEffectVi: "Không",
    capitalEffectEn: "No",
    capitalEffectVi: "Không",
    pnlEffectEn: "No",
    pnlEffectVi: "Không",
  },
  {
    entryType: "reversal",
    useWhenEn: "An earlier ledger entry must be backed out instead of edited in place.",
    useWhenVi: "Một ledger entry cũ cần được đảo ngược thay vì sửa trực tiếp.",
    exampleEn: "A wrong transaction was posted and needs a clean reversal trail.",
    exampleVi: "Một giao dịch bị ghi sai và cần để lại dấu vết đảo bút toán rõ ràng.",
    cashEffectEn: "Reverses original",
    cashEffectVi: "Đảo lại giao dịch gốc",
    reimbursementEffectEn: "Reverses original",
    reimbursementEffectVi: "Đảo lại giao dịch gốc",
    capitalEffectEn: "Reverses original",
    capitalEffectVi: "Đảo lại giao dịch gốc",
    pnlEffectEn: "Reverses original",
    pnlEffectVi: "Đảo lại giao dịch gốc",
  },
];

function MatrixTable({
  rows,
  locale,
}: {
  rows: MatrixRow[];
  locale: "en" | "vi";
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">
              {locale === "vi" ? "Loại giao dịch" : "Transaction type"}
            </TableHead>
            <TableHead className="min-w-[280px]">
              {locale === "vi" ? "Dùng khi nào" : "Use this when"}
            </TableHead>
            <TableHead className="min-w-[160px]">
              {locale === "vi" ? "Tiền mặt" : "Cash"}
            </TableHead>
            <TableHead className="min-w-[180px]">
              {locale === "vi" ? "Hoàn trả" : "Reimbursement"}
            </TableHead>
            <TableHead className="min-w-[120px]">
              {locale === "vi" ? "Vốn" : "Capital"}
            </TableHead>
            <TableHead className="min-w-[160px]">
              {locale === "vi" ? "P&L / Lợi nhuận" : "P&L / Profit"}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.entryType}>
              <TableCell className="align-top">
                <Badge className="rounded-full bg-slate-900 text-white">
                  {getEntryTypeLabel(row.entryType, locale)}
                </Badge>
              </TableCell>
              <TableCell className="align-top">
                <p className="font-medium text-slate-950">
                  {locale === "vi" ? row.useWhenVi : row.useWhenEn}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {locale === "vi" ? row.exampleVi : row.exampleEn}
                </p>
              </TableCell>
              <TableCell className="align-top text-sm text-slate-700">
                {locale === "vi" ? row.cashEffectVi : row.cashEffectEn}
              </TableCell>
              <TableCell className="align-top text-sm text-slate-700">
                {locale === "vi"
                  ? row.reimbursementEffectVi
                  : row.reimbursementEffectEn}
              </TableCell>
              <TableCell className="align-top text-sm text-slate-700">
                {locale === "vi" ? row.capitalEffectVi : row.capitalEffectEn}
              </TableCell>
              <TableCell className="align-top text-sm text-slate-700">
                {locale === "vi" ? row.pnlEffectVi : row.pnlEffectEn}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function TransactionTypeMatrix() {
  const { locale } = useLocale();

  return (
    <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
      <CardHeader>
        <CardTitle>
          {locale === "vi"
            ? "Nên dùng loại giao dịch nào?"
            : "Which transaction should I use?"}
        </CardTitle>
        <CardDescription>
          {locale === "vi"
            ? "App phân loại giao dịch theo 2 trục: nhóm và loại. Hãy bắt đầu bằng việc xác định đây là nghiệp vụ thật ngoài đời hay chỉ là thao tác điều chỉnh sổ."
            : "The app now classifies entries on two axes: family and type. Start by asking whether you are recording a real business event or just fixing the ledger."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-center gap-2">
              <Badge className="rounded-full bg-slate-900 text-white">
                {getEntryFamilyLabel("business", locale)}
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {locale === "vi"
                ? "Dùng cho các sự kiện tiền thật xảy ra ngoài đời như vốn góp, chi phí, tiền vào, chuyển động gốc vay, chuyển tiền giữa thành viên, hoàn trả và chia lợi nhuận."
                : "Use this for real-world money events like capital, expenses, income, loan principal movements, cash handovers, repayments, and profit payouts."}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-center gap-2">
              <Badge className="rounded-full bg-white text-slate-900 ring-1 ring-slate-200">
                {getEntryFamilyLabel("correction", locale)}
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {locale === "vi"
                ? "Chỉ dùng khi bạn đang sửa hoặc đảo sổ, chứ không phải khi có nghiệp vụ mới xảy ra ngoài thực tế."
                : "Use this only when you are correcting or reversing the ledger, not when a new business event happened in the real world."}
            </p>
          </div>
        </div>

        <Tabs defaultValue="business" className="gap-4">
          <TabsList className="rounded-2xl bg-slate-100 p-1">
            <TabsTrigger value="business">
              {locale === "vi"
                ? `Nghiệp vụ thật (${businessEntryTypes.length})`
                : `Business events (${businessEntryTypes.length})`}
            </TabsTrigger>
            <TabsTrigger value="correction">
              {locale === "vi"
                ? `Điều chỉnh (${correctionEntryTypes.length})`
                : `Corrections (${correctionEntryTypes.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="business">
            <MatrixTable rows={businessRows} locale={locale} />
          </TabsContent>
          <TabsContent value="correction">
            <MatrixTable rows={correctionRows} locale={locale} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
