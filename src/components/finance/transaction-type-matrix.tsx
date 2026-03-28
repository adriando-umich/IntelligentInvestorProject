"use client";

import { useMemo, useState } from "react";

import { useLocale } from "@/components/app/locale-provider";
import { TableSurface, TableToolbar } from "@/components/finance/table-toolbar";
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
import {
  businessEntryTypes,
  correctionEntryTypes,
  getEntryFamilyLabel,
  getEntryTypeLabel,
  type BusinessEntryType,
  type CorrectionEntryType,
} from "@/lib/finance/types";
import { normalizeSearchText } from "@/lib/search";

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

type MatrixSort = "recommended" | "alphabetical" | "cash";
type MatrixCashFilter =
  | "all"
  | "money_in"
  | "money_out"
  | "between_members"
  | "adjustment";

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
    entryType: "land_purchase",
    useWhenEn: "Project cash is converted into land or another non-cash asset, not into operating expense.",
    useWhenVi: "Tiền dự án được chuyển thành đất hoặc tài sản không phải tiền mặt, không phải chi phí vận hành.",
    exampleEn: "Use this when the project wires money to buy land and the value should stay invested inside the project.",
    exampleVi: "Dùng khi dự án chuyển tiền đi mua đất và giá trị đó vẫn còn nằm trong dự án dưới dạng tài sản.",
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
    exampleEn:
      "Monthly bank interest on the project loan is paid from one member account and shared across members.",
    exampleVi:
      "Lãi vay ngân hàng hằng tháng được một thành viên trả trước rồi chia cho các thành viên liên quan.",
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

function getCashCategory(
  row: MatrixRow
): Exclude<MatrixCashFilter, "all"> {
  if (row.cashEffectEn === "Money comes in") {
    return "money_in";
  }

  if (row.cashEffectEn === "Money goes out") {
    return "money_out";
  }

  if (row.cashEffectEn === "Moves between members") {
    return "between_members";
  }

  return "adjustment";
}

function MatrixTable({
  rows,
  locale,
}: {
  rows: MatrixRow[];
  locale: "en" | "vi";
}) {
  return (
    <TableSurface>
      <Table className="min-w-[1120px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[220px]">
              {locale === "vi" ? "Loại giao dịch" : "Transaction type"}
            </TableHead>
            <TableHead className="min-w-[340px] whitespace-normal">
              {locale === "vi" ? "Dùng khi nào" : "Use this when"}
            </TableHead>
            <TableHead className="w-[160px]">
              {locale === "vi" ? "Tiền mặt" : "Cash"}
            </TableHead>
            <TableHead className="w-[190px] whitespace-normal">
              {locale === "vi" ? "Hoàn trả" : "Reimbursement"}
            </TableHead>
            <TableHead className="w-[140px]">
              {locale === "vi" ? "Vốn" : "Capital"}
            </TableHead>
            <TableHead className="w-[220px] whitespace-normal">
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
              <TableCell className="align-top whitespace-normal">
                <p className="font-medium text-slate-950">
                  {locale === "vi" ? row.useWhenVi : row.useWhenEn}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {locale === "vi" ? row.exampleVi : row.exampleEn}
                </p>
              </TableCell>
              <TableCell className="align-top text-sm whitespace-normal text-slate-700">
                {locale === "vi" ? row.cashEffectVi : row.cashEffectEn}
              </TableCell>
              <TableCell className="align-top text-sm whitespace-normal text-slate-700">
                {locale === "vi"
                  ? row.reimbursementEffectVi
                  : row.reimbursementEffectEn}
              </TableCell>
              <TableCell className="align-top text-sm whitespace-normal text-slate-700">
                {locale === "vi" ? row.capitalEffectVi : row.capitalEffectEn}
              </TableCell>
              <TableCell className="align-top text-sm whitespace-normal text-slate-700">
                {locale === "vi" ? row.pnlEffectVi : row.pnlEffectEn}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableSurface>
  );
}

export function TransactionTypeMatrix() {
  const { locale } = useLocale();
  const [activeFamily, setActiveFamily] = useState<"business" | "correction">(
    "business"
  );
  const [search, setSearch] = useState("");
  const [cashFilter, setCashFilter] = useState<MatrixCashFilter>("all");
  const [sortOrder, setSortOrder] = useState<MatrixSort>("recommended");

  const copy =
    locale === "vi"
      ? {
          title: "Nên dùng loại giao dịch nào?",
          description:
            "App phân loại giao dịch theo 2 trục: nhóm và loại. Hãy bắt đầu bằng việc xác định đây là nghiệp vụ thật ngoài đời hay chỉ là thao tác điều chỉnh sổ.",
          businessFamily:
            "Dùng cho các sự kiện tiền thật xảy ra ngoài đời như vốn góp, chi phí, tiền vào, chuyển động gốc vay, chuyển tiền giữa thành viên, hoàn trả và chia lợi nhuận.",
          correctionFamily:
            "Chỉ dùng khi bạn đang sửa hoặc đảo sổ, chứ không phải khi có nghiệp vụ mới xảy ra ngoài thực tế.",
          searchPlaceholder:
            "Tìm theo loại giao dịch, ví dụ, cash effect hoặc reimbursement...",
          searchLabel: "Tìm kiếm",
          cashFilter: "Dòng tiền",
          sort: "Sắp xếp",
          allCashEffects: "Tất cả cash effect",
          moneyIn: "Tiền đi vào",
          moneyOut: "Tiền đi ra",
          betweenMembers: "Di chuyển giữa thành viên",
          adjustments: "Điều chỉnh / đảo giao dịch",
          recommended: "Theo thứ tự khuyến nghị",
          alphabetical: "Theo ABC",
          cashEffectSort: "Theo cash effect",
          results: (count: number) => `${count} loại giao dịch đang hiển thị.`,
          noRows: "Không có loại giao dịch nào khớp với tìm kiếm hoặc bộ lọc hiện tại.",
          businessTab: `Nghiệp vụ thật (${businessEntryTypes.length})`,
          correctionTab: `Điều chỉnh (${correctionEntryTypes.length})`,
        }
      : {
          title: "Which transaction should I use?",
          description:
            "The app classifies entries on two axes: family and type. Start by asking whether you are recording a real business event or simply fixing the ledger.",
          businessFamily:
            "Use this for real-world money events like capital, expenses, income, loan principal movements, cash handovers, repayments, and profit payouts.",
          correctionFamily:
            "Use this only when you are correcting or reversing the ledger, not when a new business event happened in the real world.",
          searchPlaceholder:
            "Search transaction type, example, cash effect, or reimbursement...",
          searchLabel: "Search",
          cashFilter: "Cash effect",
          sort: "Sort",
          allCashEffects: "All cash effects",
          moneyIn: "Money comes in",
          moneyOut: "Money goes out",
          betweenMembers: "Moves between members",
          adjustments: "Adjustments / reversals",
          recommended: "Recommended order",
          alphabetical: "Alphabetical",
          cashEffectSort: "Cash effect",
          results: (count: number) => `${count} transaction types shown.`,
          noRows: "No transaction types match the current search or filters.",
          businessTab: `Business events (${businessEntryTypes.length})`,
          correctionTab: `Corrections (${correctionEntryTypes.length})`,
        };

  const currentRows = activeFamily === "business" ? businessRows : correctionRows;

  const filteredRows = useMemo(() => {
    const normalizedSearch = normalizeSearchText(search);

    return [...currentRows]
      .filter((row) => {
        if (cashFilter !== "all" && getCashCategory(row) !== cashFilter) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const searchParts = [
          row.entryType,
          getEntryTypeLabel(row.entryType, locale),
          getEntryTypeLabel(row.entryType, "en"),
          getEntryTypeLabel(row.entryType, "vi"),
          row.useWhenEn,
          locale === "vi" ? row.useWhenVi : row.useWhenEn,
          row.useWhenVi,
          row.exampleEn,
          locale === "vi" ? row.exampleVi : row.exampleEn,
          row.exampleVi,
          row.cashEffectEn,
          locale === "vi" ? row.cashEffectVi : row.cashEffectEn,
          row.cashEffectVi,
          row.reimbursementEffectEn,
          locale === "vi"
            ? row.reimbursementEffectVi
            : row.reimbursementEffectEn,
          row.reimbursementEffectVi,
          row.capitalEffectEn,
          locale === "vi" ? row.capitalEffectVi : row.capitalEffectEn,
          row.capitalEffectVi,
          row.pnlEffectEn,
          locale === "vi" ? row.pnlEffectVi : row.pnlEffectEn,
          row.pnlEffectVi,
        ];

        return searchParts.some((value) =>
          normalizeSearchText(value).includes(normalizedSearch)
        );
      })
      .sort((left, right) => {
        if (sortOrder === "alphabetical") {
          return getEntryTypeLabel(left.entryType, locale).localeCompare(
            getEntryTypeLabel(right.entryType, locale),
            locale
          );
        }

        if (sortOrder === "cash") {
          const cashCompare = getCashCategory(left).localeCompare(getCashCategory(right));

          if (cashCompare !== 0) {
            return cashCompare;
          }
        }

        return currentRows.findIndex((row) => row.entryType === left.entryType) -
          currentRows.findIndex((row) => row.entryType === right.entryType);
      });
  }, [cashFilter, currentRows, locale, search, sortOrder]);

  return (
    <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
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
              {copy.businessFamily}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-center gap-2">
              <Badge className="rounded-full bg-white text-slate-900 ring-1 ring-slate-200">
                {getEntryFamilyLabel("correction", locale)}
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {copy.correctionFamily}
            </p>
          </div>
        </div>

        <Tabs
          value={activeFamily}
          onValueChange={(value) => setActiveFamily(value as "business" | "correction")}
          className="gap-4"
        >
          <TabsList className="rounded-2xl bg-slate-100 p-1">
            <TabsTrigger value="business">{copy.businessTab}</TabsTrigger>
            <TabsTrigger value="correction">{copy.correctionTab}</TabsTrigger>
          </TabsList>

          <TableToolbar
            searchLabel={copy.searchLabel}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={copy.searchPlaceholder}
            resultLabel={copy.results(filteredRows.length)}
            filters={[
              {
                key: "cash",
                label: copy.cashFilter,
                value: cashFilter,
                onValueChange: (value) =>
                  setCashFilter(value as MatrixCashFilter),
                options: [
                  { value: "all", label: copy.allCashEffects },
                  { value: "money_in", label: copy.moneyIn },
                  { value: "money_out", label: copy.moneyOut },
                  { value: "between_members", label: copy.betweenMembers },
                  { value: "adjustment", label: copy.adjustments },
                ],
              },
              {
                key: "sort",
                label: copy.sort,
                value: sortOrder,
                onValueChange: (value) => setSortOrder(value as MatrixSort),
                options: [
                  { value: "recommended", label: copy.recommended },
                  { value: "alphabetical", label: copy.alphabetical },
                  { value: "cash", label: copy.cashEffectSort },
                ],
              },
            ]}
          />

          <TabsContent value="business">
            {filteredRows.length === 0 ? (
              <EmptyState message={copy.noRows} />
            ) : (
              <MatrixTable rows={filteredRows} locale={locale} />
            )}
          </TabsContent>
          <TabsContent value="correction">
            {filteredRows.length === 0 ? (
              <EmptyState message={copy.noRows} />
            ) : (
              <MatrixTable rows={filteredRows} locale={locale} />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}
