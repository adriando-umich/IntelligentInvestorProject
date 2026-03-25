"use client";

import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  LabelList,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getEntryFamilyLabel,
  getEntryFamily,
  type MemberFinanceSummary,
} from "@/lib/finance/types";
import { useLocale } from "@/components/app/locale-provider";
import {
  formatCurrency as formatAppCurrency,
  formatSignedCurrency as formatAppSignedCurrency,
  roundMoney,
} from "@/lib/format";
import { type EntryFamily, type ProjectSnapshot } from "@/lib/finance/types";
import {
  defaultAppLocale,
  getIntlLocale,
  type AppLocale,
} from "@/lib/i18n/config";

function formatCurrency(
  amount: number,
  currencyCode?: string,
  locale: AppLocale = defaultAppLocale
) {
  return formatAppCurrency(Math.round(amount), currencyCode, locale);
}

function formatSignedCurrency(
  amount: number,
  currencyCode?: string,
  locale: AppLocale = defaultAppLocale
) {
  return formatAppSignedCurrency(Math.round(amount), currencyCode, locale);
}

function formatCompactCurrency(
  amount: number,
  currencyCode = "VND",
  locale: AppLocale = defaultAppLocale
) {
  const roundedAmount = Math.round(amount);
  const absoluteAmount = Math.abs(roundedAmount);
  const fractionDigits = absoluteAmount >= 1_000_000_000 ? 1 : 0;

  return new Intl.NumberFormat(getIntlLocale(locale), {
    style: "currency",
    currency: currencyCode,
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(roundedAmount);
}

function formatPercent(decimal: number, locale: AppLocale = defaultAppLocale) {
  return new Intl.NumberFormat(getIntlLocale(locale), {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(decimal);
}

const MEMBER_COLORS = [
  "#0f766e",
  "#0284c7",
  "#14b8a6",
  "#f59e0b",
  "#2563eb",
  "#ec4899",
];

const FAMILY_COLORS: Record<EntryFamily, string> = {
  business: "#0f766e",
  correction: "#f97316",
};

type ActivityFamilyFilter = "all" | EntryFamily;

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm leading-6 text-slate-500">
      {message}
    </div>
  );
}

function MoneyTooltip({
  active,
  label,
  payload,
  currencyCode,
  locale,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{
    name?: string;
    value?: number | string;
    color?: string;
    payload?: Record<string, unknown>;
  }>;
  currencyCode: string;
  locale?: "en" | "vi";
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const resolvedLocale = locale ?? "en";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 px-3 py-3 shadow-lg">
      {label ? (
        <p className="text-sm font-medium text-slate-950">{label}</p>
      ) : null}
      <div className="mt-2 space-y-1.5 text-sm text-slate-600">
        {payload.map((item) => {
          const rawValue =
            typeof item.value === "number" ? item.value : Number(item.value ?? 0);

          return (
            <div
              key={`${item.name}-${item.color}`}
              className="flex items-center justify-between gap-4"
            >
              <span className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: item.color ?? "#94a3b8" }}
                />
                <span>{item.name}</span>
              </span>
              <span className="font-medium text-slate-950">
                {formatCurrency(rawValue, currencyCode, resolvedLocale)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CapitalShareChart({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { locale } = useLocale();
  const copy =
    locale === "vi"
      ? {
          empty: "Chưa có thành viên nào đang có vốn góp dương. Tỷ lệ chia lợi nhuận sẽ hiện ở đây sau khi có vốn góp.",
          capital: "Vốn góp",
          estimatedProfitToday: "Lợi nhuận ước tính hôm nay",
        }
      : {
          empty: "No active capital owners yet. Profit share starts showing here once someone contributes capital.",
          capital: "Capital",
          estimatedProfitToday: "Estimated profit today",
        };

  if (snapshot.capitalWeights.length === 0) {
    return (
      <EmptyChartState message={copy.empty} />
    );
  }

  const pieData = snapshot.capitalWeights.map((row, index) => ({
    name: row.displayName,
    value: row.capitalBalance,
    weight: row.weight,
    estimatedProfitShare: row.estimatedProfitShare,
    fill: MEMBER_COLORS[index % MEMBER_COLORS.length],
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <RechartsTooltip
              content={
                <MoneyTooltip
                  currencyCode={snapshot.dataset.project.currencyCode}
                  locale={locale}
                />
              }
            />
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={92}
              paddingAngle={2}
              stroke="transparent"
            >
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-3">
        {pieData.map((entry) => (
          <div
            key={entry.name}
            className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-950">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: entry.fill }}
                />
                {entry.name}
              </span>
              <Badge className="rounded-full bg-white text-slate-900 ring-1 ring-slate-200">
                  {formatPercent(entry.weight, locale)}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {copy.capital}:{" "}
              <span className="font-medium text-slate-950">
                {formatCurrency(
                  entry.value,
                  snapshot.dataset.project.currencyCode,
                  locale
                )}
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {copy.estimatedProfitToday}:{" "}
              <span className="font-medium text-slate-950">
                {formatCurrency(
                  entry.estimatedProfitShare,
                  snapshot.dataset.project.currencyCode,
                  locale
                )}
              </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FundingStackChart({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { locale } = useLocale();
  const retainedOperatingBuffer = Math.max(snapshot.undistributedProfit, 0);
  const copy =
    locale === "vi"
      ? {
          fundingCommitted: "Nguồn tiền còn đang tham gia dự án",
          empty:
            "Hiện chưa có vốn góp, dư nợ gốc vay chung hoặc phần lợi nhuận giữ lại nào được ghi nhận.",
          capitalInvested: "Vốn còn đang góp",
          sharedLoanOutstanding: "Gốc vay chung còn lại",
          retainedBuffer: "Phần đệm vận hành giữ lại",
          capital: "Vốn",
          sharedLoanPrincipal: "Gốc vay chung",
          retainedOperatingBuffer: "Đệm vận hành giữ lại",
        }
      : {
          fundingCommitted: "Funding still committed",
          empty:
            "No capital, shared loan principal, or retained operating buffer has been recorded yet.",
          capitalInvested: "Capital still invested",
          sharedLoanOutstanding: "Shared loan principal still outstanding",
          retainedBuffer: "Retained operating buffer",
          capital: "Capital",
          sharedLoanPrincipal: "Shared loan principal",
          retainedOperatingBuffer: "Retained operating buffer",
        };
  const fundingRows = [
    {
      label: copy.fundingCommitted,
      capital: snapshot.totalCapitalOutstanding,
      sharedLoan: Math.max(snapshot.sharedLoanPrincipalOutstanding, 0),
      retainedOperatingBuffer,
    },
  ];

  const hasFunding = fundingRows.some(
    (row) =>
      row.capital > 0 ||
      row.sharedLoan > 0 ||
      row.retainedOperatingBuffer > 0
  );

  if (!hasFunding) {
    return <EmptyChartState message={copy.empty} />;
  }

  return (
    <div className="space-y-4">
      <div className="h-[210px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={fundingRows}
            layout="vertical"
            margin={{ top: 8, right: 18, left: 24, bottom: 8 }}
          >
            <CartesianGrid horizontal={false} stroke="#e2e8f0" />
            <XAxis
              type="number"
              tickFormatter={(value: number) =>
                formatCompactCurrency(value, snapshot.dataset.project.currencyCode, locale)
              }
            />
            <YAxis type="category" dataKey="label" width={120} />
            <RechartsTooltip
              content={
                <MoneyTooltip
                  currencyCode={snapshot.dataset.project.currencyCode}
                  locale={locale}
                />
              }
            />
            <Bar
              dataKey="capital"
              name={copy.capitalInvested}
              stackId="funding"
              fill="#0f766e"
              radius={[8, 0, 0, 8]}
            />
            <Bar
              dataKey="sharedLoan"
              name={copy.sharedLoanOutstanding}
              stackId="funding"
              fill="#0284c7"
            />
            <Bar
              dataKey="retainedOperatingBuffer"
              name={copy.retainedBuffer}
              stackId="funding"
              fill="#a855f7"
              radius={[0, 8, 8, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[1.4rem] bg-emerald-50/90 px-4 py-4">
          <p className="text-sm text-emerald-700">{copy.capital}</p>
          <p className="mt-2 text-lg font-semibold text-emerald-950">
            {formatCurrency(
              snapshot.totalCapitalOutstanding,
              snapshot.dataset.project.currencyCode,
              locale
            )}
          </p>
        </div>
        <div className="rounded-2xl bg-sky-50 px-4 py-4">
          <p className="text-sm text-sky-700">{copy.sharedLoanPrincipal}</p>
          <p className="mt-2 text-lg font-semibold text-sky-950">
            {formatCurrency(
              snapshot.sharedLoanPrincipalOutstanding,
              snapshot.dataset.project.currencyCode,
              locale
            )}
          </p>
        </div>
        <div className="rounded-2xl bg-violet-50 px-4 py-4">
          <p className="text-sm text-violet-700">{copy.retainedOperatingBuffer}</p>
          <p className="mt-2 text-lg font-semibold text-violet-950">
            {formatCurrency(
              retainedOperatingBuffer,
              snapshot.dataset.project.currencyCode,
              locale
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function CashCustodyChart({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { locale } = useLocale();
  const rows = snapshot.memberSummaries
    .map((summary) => ({
      member: summary.profile.displayName,
      held: Math.max(summary.projectCashCustody, 0),
      fronted: -Math.max(summary.frontedOwnMoney, 0),
    }))
    .sort((left, right) =>
      Math.abs(right.held) + Math.abs(right.fronted) -
      (Math.abs(left.held) + Math.abs(left.fronted))
    );

  if (!rows.length) {
    return (
      <EmptyChartState
        message={
          locale === "vi"
            ? "Biểu đồ giữ tiền dự án sẽ hiện ra khi team bắt đầu ghi nhận dòng tiền trong dự án."
            : "Member cash custody appears here once the team starts moving money through the project."
        }
      />
    );
  }

  return (
    <div className="h-[310px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 8, right: 18, left: 18, bottom: 8 }}
        >
          <CartesianGrid horizontal={false} stroke="#e2e8f0" />
            <XAxis
              type="number"
              tickFormatter={(value: number) =>
                formatCompactCurrency(value, snapshot.dataset.project.currencyCode, locale)
              }
            />
          <YAxis type="category" dataKey="member" width={86} />
          <ReferenceLine x={0} stroke="#94a3b8" />
          <RechartsTooltip
            content={
              <MoneyTooltip
                currencyCode={snapshot.dataset.project.currencyCode}
                locale={locale}
              />
            }
          />
          <Bar
            dataKey="fronted"
            name={locale === "vi" ? "Đã ứng tiền riêng" : "Fronted own money"}
            fill="#f59e0b"
            radius={[8, 0, 0, 8]}
          />
          <Bar
            dataKey="held"
            name={locale === "vi" ? "Đang giữ tiền dự án" : "Holding project money"}
            fill="#0f766e"
            radius={[0, 8, 8, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ReimbursementChart({
  memberSummaries,
  snapshot,
}: {
  memberSummaries: MemberFinanceSummary[];
  snapshot: ProjectSnapshot;
}) {
  const { locale } = useLocale();
  const rows = memberSummaries
    .map((summary) => ({
      member: summary.profile.displayName,
      owedToYou: summary.teamOwesYou,
      youOwe: -summary.youOweTeam,
    }))
    .sort((left, right) =>
      Math.abs(right.owedToYou) + Math.abs(right.youOwe) -
      (Math.abs(left.owedToYou) + Math.abs(left.youOwe))
    );

  if (!rows.length) {
    return (
      <EmptyChartState
        message={
          locale === "vi"
            ? "Cân đối cash giữa các thành viên sẽ hiện ở đây sau khi app so sánh tiền đang giữ với quyền lợi hiện tại."
            : "Member cash balances appear here after the app compares current cash held with each person's current claim."
        }
      />
    );
  }

  return (
    <div className="h-[310px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 8, right: 18, left: 18, bottom: 8 }}
        >
          <CartesianGrid horizontal={false} stroke="#e2e8f0" />
            <XAxis
              type="number"
              tickFormatter={(value: number) =>
                formatCompactCurrency(value, snapshot.dataset.project.currencyCode, locale)
              }
            />
          <YAxis type="category" dataKey="member" width={86} />
          <ReferenceLine x={0} stroke="#94a3b8" />
          <RechartsTooltip
            content={
              <MoneyTooltip
                currencyCode={snapshot.dataset.project.currencyCode}
                locale={locale}
              />
            }
          />
          <Bar
            dataKey="youOwe"
            name={locale === "vi" ? "Bạn còn nợ team" : "You still owe teammates"}
            fill="#fb7185"
            radius={[8, 0, 0, 8]}
          />
          <Bar
            dataKey="owedToYou"
            name={locale === "vi" ? "Team còn nợ bạn" : "Teammates still owe you"}
            fill="#22c55e"
            radius={[0, 8, 8, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CashBridgeChart({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { locale } = useLocale();
  const expectedCashFromBusiness = roundMoney(
    snapshot.totalCapitalOutstanding +
      snapshot.sharedLoanPrincipalOutstanding +
      snapshot.projectOperatingIncome -
      snapshot.projectOperatingExpense -
      snapshot.totalProfitDistributed
  );

  const correctionDelta = roundMoney(
    snapshot.totalProjectCash - expectedCashFromBusiness
  );

  const steps = [
    {
      label: locale === "vi" ? "Vốn" : "Capital",
      value: snapshot.totalCapitalOutstanding,
    },
    {
      label: locale === "vi" ? "Vay chung" : "Shared loan",
      value: snapshot.sharedLoanPrincipalOutstanding,
    },
    {
      label: locale === "vi" ? "Tiền vào" : "Income",
      value: snapshot.projectOperatingIncome,
    },
    {
      label: locale === "vi" ? "Chi phí" : "Expense",
      value: -snapshot.projectOperatingExpense,
    },
    {
      label: locale === "vi" ? "Lợi nhuận đã trả" : "Profit paid",
      value: -snapshot.totalProfitDistributed,
    },
  ];

  if (Math.abs(correctionDelta) > 0.01) {
    steps.push({
      label: locale === "vi" ? "Điều chỉnh" : "Corrections",
      value: correctionDelta,
    });
  }

  const chartData: Array<{
    label: string;
    amount: number;
    fill: string;
    kind: "movement" | "total";
  }> = steps.map((step) => {
    return {
      label: step.label,
      amount: step.value,
      fill: step.value >= 0 ? "#5b7db8" : "#c65a5a",
      kind: "movement" as const,
    };
  });

  chartData.push({
    label: locale === "vi" ? "Tiền hiện có" : "Cash now",
    amount: snapshot.totalProjectCash,
    fill: "#9fbe58",
    kind: "total" as const,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-600 sm:justify-start">
        <span className="inline-flex items-center gap-2">
          <span
            className="size-3 rounded-sm"
            style={{ backgroundColor: "#5b7db8" }}
          />
          {locale === "vi" ? "Tăng" : "Increase"}
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="size-3 rounded-sm"
            style={{ backgroundColor: "#c65a5a" }}
          />
          {locale === "vi" ? "Giảm" : "Decrease"}
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="size-3 rounded-sm"
            style={{ backgroundColor: "#9fbe58" }}
          />
          {locale === "vi" ? "Tổng" : "Total"}
        </span>
      </div>

      <div className="h-[310px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            barCategoryGap={18}
            margin={{ top: 26, right: 18, left: 8, bottom: 16 }}
          >
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis
              tickFormatter={(value: number) =>
                formatCompactCurrency(value, snapshot.dataset.project.currencyCode, locale)
              }
            />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <RechartsTooltip
              content={({ active, payload, label }) => {
                const row = payload?.[0]?.payload;

                if (!active || !row) {
                  return null;
                }

                return (
                  <div className="rounded-2xl border border-slate-200 bg-white/95 px-3 py-3 shadow-lg">
                    <p className="text-sm font-medium text-slate-950">
                      {label}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {formatSignedCurrency(
                        Number(row.amount ?? 0),
                        snapshot.dataset.project.currencyCode,
                        locale
                      )}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.kind === "total"
                        ? locale === "vi"
                          ? "Đây là tổng tiền dự án hiện có sau tất cả các biến động đã ghi."
                          : "Current project cash after all recorded movements."
                        : locale === "vi"
                          ? "Cột này chỉ thể hiện đúng số tiền của bước đó, không phải chiều cao cộng dồn."
                          : "This bar shows only this step's own amount, not a cumulative height."}
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.label} fill={entry.fill} />
              ))}
              <LabelList
                dataKey="amount"
                content={(props) => {
                  const {
                    x = 0,
                    y = 0,
                    width = 0,
                    height = 0,
                    value,
                  } = props;
                  const numericValue = Number(value ?? 0);
                  const labelY =
                    numericValue >= 0
                      ? Number(y) - 8
                      : Number(y) + Number(height) + 16;

                  return (
                    <text
                      x={Number(x) + Number(width) / 2}
                      y={labelY}
                      textAnchor="middle"
                      className="fill-slate-500 text-[11px]"
                    >
                      {formatCompactCurrency(
                        numericValue,
                        snapshot.dataset.project.currencyCode,
                        locale
                      )}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
        {locale === "vi"
          ? "Mỗi cột biến động chỉ thể hiện đúng số tiền của riêng bước đó. Cột Tiền hiện có cuối cùng là tổng số tiền sau các bước này. Cách hiển thị này giúp đọc cash dễ hơn mà không trộn lẫn khoản hoàn trả, tỷ trọng vốn hay logic chia lợi nhuận vào một con số."
          : "Each movement bar shows its own amount only. The final Cash now bar is the current total after those movements. This keeps cash readable without merging reimbursement, capital weights, or profit payout logic into one number."}
      </div>
    </div>
  );
}

function ProfitOutcomeChart({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { locale } = useLocale();
  const rows = snapshot.memberSummaries
    .map((summary) => ({
      member: summary.profile.displayName,
      capital: Math.max(summary.capitalBalance, 0),
      profit: Math.max(summary.estimatedProfitShare, 0),
      total:
        Math.max(summary.capitalBalance, 0) +
        Math.max(summary.estimatedProfitShare, 0),
    }))
    .filter((row) => row.capital > 0 || row.profit > 0)
    .sort(
      (left, right) =>
        right.capital + right.profit - (left.capital + left.profit)
    );

  if (!rows.length) {
    return (
      <EmptyChartState
        message={
          locale === "vi"
            ? "Bi\u1ec3u \u0111\u1ed3 n\u00e0y s\u1ebd hi\u1ec7n khi c\u00f3 v\u1ed1n c\u00f2n \u0111ang g\u00f3p ho\u1eb7c c\u00f3 l\u1ee3i nhu\u1eadn ch\u01b0a chia."
            : "This chart appears once the project has capital still invested or positive profit still undistributed."
        }
      />
    );
  }

  function renderTotalLabel(props: any) {
    const { x = 0, y = 0, width = 0, value, payload, dataKey } = props;
    const capitalValue = Number(payload?.capital ?? 0);
    const profitValue = Number(payload?.profit ?? 0);
    const totalValue = Number(payload?.total ?? value ?? 0);
    const shouldRenderOnCapital = dataKey === "capital" && profitValue <= 0;
    const shouldRenderOnProfit = dataKey === "profit" && profitValue > 0;

    if (!shouldRenderOnCapital && !shouldRenderOnProfit) {
      return null;
    }

    return (
      <text
        x={Number(x) + Number(width) / 2}
        y={Number(y) - 10}
        textAnchor="middle"
        className="fill-slate-500 text-[11px] font-medium"
      >
        {formatCompactCurrency(
          shouldRenderOnProfit ? totalValue : capitalValue,
          snapshot.dataset.project.currencyCode,
          locale
        )}
      </text>
    );
  }

  return (
    <div className="space-y-4">
      <div className="h-[290px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            margin={{ top: 24, right: 18, left: 8, bottom: 8 }}
          >
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="member" tickLine={false} axisLine={false} />
            <YAxis
              tickFormatter={(value: number) =>
                formatCompactCurrency(
                  value,
                  snapshot.dataset.project.currencyCode,
                  locale
                )
              }
            />
            <RechartsTooltip
              content={
                <MoneyTooltip
                  currencyCode={snapshot.dataset.project.currencyCode}
                  locale={locale}
                />
              }
            />
            <Bar
              dataKey="capital"
              name={locale === "vi" ? "V\u1ed1n c\u00f2n \u0111ang g\u00f3p" : "Capital still invested"}
              stackId="claim"
              fill="#0f766e"
              radius={[8, 8, 0, 0]}
            >
              <LabelList dataKey="capital" content={renderTotalLabel} />
            </Bar>
            <Bar
              dataKey="profit"
              name={
                locale === "vi"
                  ? "L\u1ee3i nhu\u1eadn c\u00f2n gi\u1eef l\u1ea1i"
                  : "Profit still undistributed"
              }
              stackId="claim"
              fill="#14b8a6"
              radius={[8, 8, 0, 0]}
            >
              <LabelList dataKey="profit" content={renderTotalLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-emerald-50/90 px-4 py-4">
          <p className="text-sm text-emerald-700">
            {locale === "vi" ? "V\u1ed1n c\u00f2n \u0111ang g\u00f3p" : "Capital still invested"}
          </p>
          <p className="mt-2 text-lg font-semibold text-emerald-950">
            {formatCurrency(
              snapshot.totalCapitalOutstanding,
              snapshot.dataset.project.currencyCode,
              locale
            )}
          </p>
        </div>
        <div className="rounded-2xl bg-teal-50 px-4 py-4">
          <p className="text-sm text-teal-700">
            {locale === "vi" ? "L\u1ee3i nhu\u1eadn c\u00f2n gi\u1eef l\u1ea1i" : "Profit still undistributed"}
          </p>
          <p className="mt-2 text-lg font-semibold text-teal-950">
            {formatCurrency(
              Math.max(snapshot.undistributedProfit, 0),
              snapshot.dataset.project.currencyCode,
              locale
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function TagPieChart({
  title,
  description,
  emptyMessage,
  rows,
  currencyCode,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  rows: ProjectSnapshot["expenseTagRollups"];
  currencyCode: string;
}) {
  const { locale } = useLocale();
  if (rows.length === 0) {
    return (
      <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyChartState message={emptyMessage} />
        </CardContent>
      </Card>
    );
  }

  const chartRows = rows.map((row, index) => ({
    ...row,
    fill: MEMBER_COLORS[index % MEMBER_COLORS.length],
  }));

  return (
    <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <RechartsTooltip
                content={<MoneyTooltip currencyCode={currencyCode} locale={locale} />}
              />
              <Pie
                data={chartRows}
                dataKey="amount"
                nameKey="name"
                innerRadius={56}
                outerRadius={92}
                paddingAngle={2}
                stroke="transparent"
              >
                {chartRows.map((entry) => (
                  <Cell key={entry.projectTagId} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3">
          {chartRows.slice(0, 5).map((entry) => (
            <div
              key={entry.projectTagId}
              className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-950">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: entry.fill }}
                  />
                  {entry.name}
                </span>
                <Badge className="rounded-full bg-white text-slate-900 ring-1 ring-slate-200">
                  {locale === "vi"
                    ? `${entry.entryCount} giao dịch`
                    : `${entry.entryCount} entries`}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {formatCurrency(entry.amount, currencyCode, locale)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectOverviewVisuals({
  snapshot,
  memberSummaries = snapshot.memberSummaries,
}: {
  snapshot: ProjectSnapshot;
  memberSummaries?: MemberFinanceSummary[];
}) {
  const { locale } = useLocale();
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle>
            {locale === "vi" ? "Tiền dự án đã đi vào như thế nào" : "How project cash got here"}
          </CardTitle>
          <CardDescription>
            {locale === "vi"
              ? "Cầu tiền theo ngôn ngữ dễ hiểu: vốn, gốc vay chung và biến động vận hành đều được tách thành từng bước."
              : "This cash bridge shows how project cash reached its current balance, step by step."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CashBridgeChart snapshot={snapshot} />
        </CardContent>
      </Card>

      <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle>{locale === "vi" ? "Tiền dự án theo từng thành viên" : "Project cash by member"}</CardTitle>
          <CardDescription>
            {locale === "vi"
              ? "Cột bên phải nghĩa là người đó đang giữ tiền dự án. Cột bên trái nghĩa là họ đã ứng tiền cá nhân vào dự án."
              : "Right side means someone is holding project money. Left side means they fronted their own money into the project."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CashCustodyChart snapshot={snapshot} />
        </CardContent>
      </Card>

      <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle>{locale === "vi" ? "Ai nên nhận tiền dự án tiếp theo" : "Who should receive project cash next"}</CardTitle>
          <CardDescription>
            {locale === "vi"
              ? "Biểu đồ này so sánh tiền đang giữ với quyền lợi hiện tại sau khi tính vốn, lợi nhuận tạm tính, và phần cash dự trữ còn phải giữ lại trong dự án."
              : "This compares the cash people are holding now with each member's current claim after capital, profit preview, and any cash reserve that still needs to stay in the project."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReimbursementChart
            memberSummaries={memberSummaries}
            snapshot={snapshot}
          />
        </CardContent>
      </Card>

      <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle>{locale === "vi" ? "Phần vốn hiện tại" : "Capital ownership today"}</CardTitle>
          <CardDescription>
            {locale === "vi"
              ? "Donut này cho biết ai đang mang tỷ trọng chia lợi nhuận ở thời điểm hiện tại. Gốc vay chung không xuất hiện ở đây."
              : "This donut shows who currently carries profit-sharing weight. Shared loan principal does not appear here."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CapitalShareChart snapshot={snapshot} />
        </CardContent>
      </Card>
    </div>
  );
}

export function ProjectCapitalVisuals({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { locale } = useLocale();
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle>
            {locale === "vi"
              ? "C\u1ea5u ph\u1ea7n ngu\u1ed3n ti\u1ec1n \u0111\u1ee9ng sau s\u1ed1 cash h\u00f4m nay"
              : "Funding stack behind today's cash"}
          </CardTitle>
          <CardDescription>
            {locale === "vi"
              ? "Vốn còn đang góp và gốc vay chung còn lại được tách riêng khỏi phần đệm vận hành giữ lại."
              : "Capital still invested and shared loan principal still outstanding are shown separately from retained operating buffer."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FundingStackChart snapshot={snapshot} />
        </CardContent>
      </Card>

      <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle>
            {locale === "vi"
              ? "V\u1ed1n v\u00e0 l\u1ee3i nhu\u1eadn theo t\u1eebng ng\u01b0\u1eddi"
              : "Capital and profit by member"}
          </CardTitle>
          <CardDescription>
            {locale === "vi"
              ? "M\u1ed7i c\u1ed9t x\u1ebfp ch\u1ed3ng ph\u1ea7n v\u1ed1n c\u00f2n \u0111ang g\u1eafn v\u1edbi d\u1ef1 \u00e1n v\u00e0 ph\u1ea7n l\u1ee3i nhu\u1eadn c\u00f2n gi\u1eef l\u1ea1i c\u1ee7a t\u1eebng th\u00e0nh vi\u00ean. Kh\u00f4ng hi\u1ec3n th\u1ecb ph\u1ea7n \u0111\u00e3 tr\u1ea3."
              : "Each member bar stacks capital still invested with profit still undistributed today. Already-paid profit is intentionally left out here."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfitOutcomeChart snapshot={snapshot} />
        </CardContent>
      </Card>
    </div>
  );
}

export function ProjectTagVisuals({ snapshot }: { snapshot: ProjectSnapshot }) {
  const { locale } = useLocale();
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <TagPieChart
        title={
          locale === "vi" ? "Tiền vào có tag đến từ đâu" : "Where tagged money came in"
        }
        description={
          locale === "vi"
            ? "Tiền khách hàng và giải ngân vay chung được xem cùng ở đây để team nhận ra nhanh các nguồn vào lớn nhất theo tag."
            : "Customer inflow and shared-loan drawdown are shown together here so the team can quickly see the biggest tagged sources."
        }
        emptyMessage={locale === "vi" ? "Chưa có tiền vào nào được gắn tag." : "No tagged inflows yet."}
        rows={snapshot.inflowTagRollups}
        currencyCode={snapshot.dataset.project.currencyCode}
      />
      <TagPieChart
        title={
          locale === "vi" ? "Tiền ra có tag đi vào đâu" : "Where tagged money went out"
        }
        description={
          locale === "vi"
            ? "Chi phí vận hành và lãi vay chung đều có thể gắn tag ở đây để team nhìn nhanh các nhóm chi lớn nhất."
            : "Operating expense and shared loan interest can both be tagged here so the team can see the largest cost buckets at a glance."
        }
        emptyMessage={locale === "vi" ? "Chưa có chi phí nào được gắn tag." : "No tagged expenses yet."}
        rows={snapshot.expenseTagRollups}
        currencyCode={snapshot.dataset.project.currencyCode}
      />
    </div>
  );
}

export function EntryFamilyReport({
  snapshot,
  selectedFamily,
  onSelectFamily,
}: {
  snapshot: ProjectSnapshot;
  selectedFamily: ActivityFamilyFilter;
  onSelectFamily: (value: ActivityFamilyFilter) => void;
}) {
  const { locale } = useLocale();
  const postedEntries = snapshot.dataset.entries.filter(
    (entry) => entry.status === "posted"
  );
  const businessEntries = postedEntries.filter(
    (entry) => getEntryFamily(entry.entryType) === "business"
  );
  const correctionEntries = postedEntries.filter(
    (entry) => getEntryFamily(entry.entryType) === "correction"
  );

  const rows = [
    {
      family: "business" as const,
      label: getEntryFamilyLabel("business", locale),
      amount: roundMoney(
        businessEntries.reduce((sum, entry) => sum + entry.amount, 0)
      ),
      count: businessEntries.length,
      fill: FAMILY_COLORS.business,
    },
    {
      family: "correction" as const,
      label: getEntryFamilyLabel("correction", locale),
      amount: roundMoney(
        correctionEntries.reduce((sum, entry) => sum + entry.amount, 0)
      ),
      count: correctionEntries.length,
      fill: FAMILY_COLORS.correction,
    },
  ];

  return (
    <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>
              {locale === "vi" ? "Bao cao theo nhom giao dich" : "Entry family report"}
            </CardTitle>
            <CardDescription className="mt-1">
              {locale === "vi"
                ? "Nghiep vu that la cac dong tien xay ra ngoai doi thuc. Dieu chinh la cac thao tac sua so nhu dao but toan hoac dieu chinh doi chieu."
                : "Business events are real money activity. Corrections are ledger-fix actions like reversals and reconciliation adjustments."}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              {
                key: "all" as const,
                label: locale === "vi" ? "Tat ca hoat dong" : "All activity",
              },
              {
                key: "business" as const,
                label: locale === "vi" ? "Chi nghiep vu that" : "Business only",
              },
              {
                key: "correction" as const,
                label: locale === "vi" ? "Chi dieu chinh" : "Corrections only",
              },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => onSelectFamily(option.key)}
                className={
                  selectedFamily === option.key
                    ? "rounded-full bg-slate-950 px-3 py-1.5 text-sm font-medium text-white"
                    : "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 18, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={(value: number) =>
                  formatCompactCurrency(value, snapshot.dataset.project.currencyCode, locale)
                }
              />
              <RechartsTooltip
                content={
                  <MoneyTooltip
                    currencyCode={snapshot.dataset.project.currencyCode}
                    locale={locale}
                  />
                }
              />
              <Bar dataKey="amount" name={locale === "vi" ? "Giá trị đã ghi" : "Recorded amount"}>
                {rows.map((entry) => (
                  <Cell key={entry.family} fill={entry.fill} />
                ))}
                <LabelList
                  dataKey="count"
                  position="top"
                  formatter={(value) =>
                    locale === "vi"
                      ? `${Number(value ?? 0)} giao dịch`
                      : `${Number(value ?? 0)} entries`
                  }
                  className="fill-slate-500 text-[11px]"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.family}
              className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-950">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: row.fill }}
                  />
                  {row.label}
                </span>
                <Badge className="rounded-full bg-white text-slate-900 ring-1 ring-slate-200">
                  {locale === "vi" ? `${row.count} giao dịch` : `${row.count} entries`}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {locale === "vi" ? "Giá trị đã ghi" : "Recorded amount"}:{" "}
                <span className="font-medium text-slate-950">
                  {formatCurrency(row.amount, snapshot.dataset.project.currencyCode, locale)}
                </span>
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
