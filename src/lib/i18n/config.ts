export const appLocales = ["en", "vi"] as const;

export type AppLocale = (typeof appLocales)[number];

export const defaultAppLocale: AppLocale = "en";
export const LOCALE_COOKIE_NAME = "pc_locale";

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return value === "en" || value === "vi";
}

export function getIntlLocale(locale: AppLocale) {
  return locale === "vi" ? "vi-VN" : "en-US";
}
