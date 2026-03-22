import { DEFAULT_CURRENCY_CODE } from "@/lib/app-config";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

export function formatCurrency(
  amount: number,
  currencyCode = DEFAULT_CURRENCY_CODE
) {
  const isWhole = Number.isInteger(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: currencyCode === "VND" && isWhole ? 0 : 2,
    maximumFractionDigits: currencyCode === "VND" && isWhole ? 0 : 2,
  }).format(amount);
}

export function formatCompactCurrency(
  amount: number,
  currencyCode = DEFAULT_CURRENCY_CODE
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatSignedCurrency(
  amount: number,
  currencyCode = DEFAULT_CURRENCY_CODE
) {
  const formatted = formatCurrency(Math.abs(amount), currencyCode);
  return amount > 0 ? `+${formatted}` : amount < 0 ? `-${formatted}` : formatted;
}

export function formatPercent(decimal: number) {
  return `${(decimal * 100).toFixed(2)}%`;
}

export function formatDateLabel(input: string) {
  return dateFormatter.format(new Date(input));
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
