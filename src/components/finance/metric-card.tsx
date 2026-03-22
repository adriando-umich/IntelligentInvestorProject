import { type ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const toneStyles = {
  teal: "bg-teal-50 text-teal-800 ring-teal-100",
  blue: "bg-sky-50 text-sky-800 ring-sky-100",
  amber: "bg-amber-50 text-amber-800 ring-amber-100",
  red: "bg-rose-50 text-rose-800 ring-rose-100",
  slate: "bg-slate-50 text-slate-800 ring-slate-100",
} as const;

export function MetricCard({
  title,
  value,
  description,
  tone = "slate",
  icon,
}: {
  title: string;
  value: string;
  description: string;
  tone?: keyof typeof toneStyles;
  icon?: ReactNode;
}) {
  return (
    <Card className="border-white/70 bg-white/85 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur">
      <CardHeader className="gap-3 space-y-0 pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-slate-600">
            {title}
          </CardTitle>
          {icon ? (
            <span
              className={cn(
                "inline-flex size-10 items-center justify-center rounded-2xl ring-1",
                toneStyles[tone]
              )}
            >
              {icon}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xl font-semibold tracking-tight text-slate-950">
          {value}
        </p>
        <p className="text-sm leading-6 text-slate-600">{description}</p>
      </CardContent>
    </Card>
  );
}
