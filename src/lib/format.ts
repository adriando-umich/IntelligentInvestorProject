import { DEFAULT_CURRENCY_CODE } from "@/lib/app-config";
import {
  defaultAppLocale,
  getIntlLocale,
  type AppLocale,
} from "@/lib/i18n/config";

export function formatCurrency(
  amount: number,
  currencyCode = DEFAULT_CURRENCY_CODE,
  locale: AppLocale = defaultAppLocale
) {
  const isWhole = Number.isInteger(amount);
  return new Intl.NumberFormat(getIntlLocale(locale), {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: currencyCode === "VND" && isWhole ? 0 : 2,
    maximumFractionDigits: currencyCode === "VND" && isWhole ? 0 : 2,
  }).format(amount);
}

export function formatCompactCurrency(
  amount: number,
  currencyCode = DEFAULT_CURRENCY_CODE,
  locale: AppLocale = defaultAppLocale
) {
  return new Intl.NumberFormat(getIntlLocale(locale), {
    style: "currency",
    currency: currencyCode,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatSignedCurrency(
  amount: number,
  currencyCode = DEFAULT_CURRENCY_CODE,
  locale: AppLocale = defaultAppLocale
) {
  const formatted = formatCurrency(Math.abs(amount), currencyCode, locale);
  return amount > 0 ? `+${formatted}` : amount < 0 ? `-${formatted}` : formatted;
}

export function formatPercent(decimal: number, locale: AppLocale = defaultAppLocale) {
  return new Intl.NumberFormat(getIntlLocale(locale), {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(decimal);
}

export function formatDateLabel(input: string, locale: AppLocale = defaultAppLocale) {
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    dateStyle: "medium",
  }).format(new Date(input));
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
