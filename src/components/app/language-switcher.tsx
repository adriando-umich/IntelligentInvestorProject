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
        "inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-2 py-2 shadow-[0_18px_60px_-45px_rgba(15,23,42,0.45)] backdrop-blur",
        className
      )}
      aria-label={text.app.languageLabel}
      title={text.app.languageHint}
    >
      <span className="inline-flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
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
                "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-slate-950 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
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
