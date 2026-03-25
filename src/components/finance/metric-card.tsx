import { type KeyboardEvent, type ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const toneStyles = {
  teal: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  blue: "bg-sky-50 text-sky-700 ring-sky-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  red: "bg-rose-50 text-rose-700 ring-rose-100",
  slate: "bg-slate-50 text-slate-700 ring-slate-100",
} as const;

export function MetricCard({
  title,
  value,
  description,
  tone = "slate",
  icon,
  onClick,
  active = false,
}: {
  title: string;
  value: string;
  description: string;
  tone?: keyof typeof toneStyles;
  icon?: ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!onClick) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  }

  return (
    <Card
      className={cn(
        "border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,255,255,0.9))] shadow-[0_24px_70px_-48px_rgba(15,23,42,0.24)]",
        onClick
          ? "cursor-pointer transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_28px_76px_-44px_rgba(16,185,129,0.24)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"
          : null,
        active ? "border-emerald-300 ring-2 ring-emerald-100" : null
      )}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? active : undefined}
    >
      <CardHeader className="gap-3 space-y-0 pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-slate-600">
            {title}
          </CardTitle>
          {icon ? (
            <span
              className={cn(
                "inline-flex size-11 items-center justify-center rounded-[1.15rem] ring-1 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.22)]",
                toneStyles[tone]
              )}
            >
              {icon}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[1.9rem] font-semibold tracking-tight text-slate-950">
          {value}
        </p>
        <p className="text-sm leading-6 text-slate-600">{description}</p>
      </CardContent>
    </Card>
  );
}
