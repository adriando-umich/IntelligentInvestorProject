"use client";

import { Languages } from "lucide-react";

import { useLocale } from "@/components/app/locale-provider";
import { type AppLocale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

const languageOptions: Array<{
  locale: AppLocale;
  flag: string;
}> = [
  { locale: "en", flag: "🇺🇸" },
  { locale: "vi", flag: "🇻🇳" },
];

export function LanguageSwitcher({
  className,
}: {
  className?: string;
}) {
  const { locale, setLocale, text } = useLocale();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(246,250,248,0.88))] px-2 py-2 shadow-[0_20px_60px_-46px_rgba(15,23,42,0.35)] backdrop-blur",
        className
      )}
      aria-label={text.app.languageLabel}
      title={text.app.languageHint}
    >
      <span className="inline-flex size-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
        <Languages className="size-4" />
      </span>
      <div className="flex items-center gap-1">
        {languageOptions.map((option) => {
          const active = locale === option.locale;
          const label =
            option.locale === "en" ? text.app.english : text.app.vietnamese;

          return (
            <button
              key={option.locale}
              type="button"
              onClick={() => setLocale(option.locale)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-[linear-gradient(180deg,#1fc88c_0%,#14b87a_100%)] text-white shadow-[0_16px_30px_-22px_rgba(20,184,122,0.9)]"
                  : "text-slate-600 hover:bg-white hover:text-slate-950"
              )}
            >
              <span aria-hidden="true">{option.flag}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
