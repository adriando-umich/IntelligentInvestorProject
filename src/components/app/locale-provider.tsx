"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import {
  defaultAppLocale,
  getIntlLocale,
  type AppLocale,
  LOCALE_COOKIE_NAME,
} from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

type LocaleContextValue = {
  locale: AppLocale;
  intlLocale: string;
  text: ReturnType<typeof getMessages>;
  setLocale: (locale: AppLocale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: AppLocale;
  children: ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);

  useEffect(() => {
    setLocaleState(initialLocale);
  }, [initialLocale]);

  function setLocale(nextLocale: AppLocale) {
    if (nextLocale === locale) {
      return;
    }

    document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    setLocaleState(nextLocale);
    router.refresh();
  }

  return (
    <LocaleContext.Provider
      value={{
        locale,
        intlLocale: getIntlLocale(locale),
        text: getMessages(locale),
        setLocale,
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider.");
  }

  return context;
}

export function useOptionalLocale() {
  return (
    useContext(LocaleContext) ?? {
      locale: defaultAppLocale,
      intlLocale: getIntlLocale(defaultAppLocale),
      text: getMessages(defaultAppLocale),
      setLocale: () => undefined,
    }
  );
}
