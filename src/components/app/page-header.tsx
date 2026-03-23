import { Badge } from "@/components/ui/badge";

export function PageHeader({
  eyebrow,
  title,
  description,
  status,
}: {
  eyebrow: string;
  title: string;
  description: string;
  status?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          {eyebrow}
        </span>
        {status ? (
          <Badge className="border border-amber-200 bg-amber-50 text-amber-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
            {status}
          </Badge>
        ) : null}
      </div>
      <div className="space-y-3">
        <h1 className="font-heading text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
          {title}
        </h1>
        <p className="max-w-3xl text-base leading-7 text-slate-600 sm:text-[1.05rem]">
          {description}
        </p>
      </div>
    </div>
  );
}
