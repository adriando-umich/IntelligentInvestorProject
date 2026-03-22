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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
          {eyebrow}
        </span>
        {status ? (
          <Badge className="rounded-full bg-amber-100 text-amber-800">
            {status}
          </Badge>
        ) : null}
      </div>
      <div className="space-y-2">
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="max-w-3xl text-base leading-7 text-slate-600">
          {description}
        </p>
      </div>
    </div>
  );
}
