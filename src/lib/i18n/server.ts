import "server-only";

import { cookies } from "next/headers";

import {
  defaultAppLocale,
  isAppLocale,
  type AppLocale,
  LOCALE_COOKIE_NAME,
} from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

export async function getRequestLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  return isAppLocale(value) ? value : defaultAppLocale;
}

export async function getServerI18n() {
  const locale = await getRequestLocale();

  return {
    locale,
    text: getMessages(locale),
  };
}
