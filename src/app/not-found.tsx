import Link from "next/link";
import { getServerI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { text } = await getServerI18n();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-12">
      <div className="rounded-[2rem] border border-white/70 bg-white/90 px-8 py-10 text-center shadow-[0_26px_80px_-40px_rgba(15,23,42,0.45)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
          {text.notFound.eyebrow}
        </p>
        <h1 className="mt-4 font-heading text-3xl font-semibold text-slate-950">
          {text.notFound.title}
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-7 text-slate-600">
          {text.notFound.description}
        </p>
        <Link
          href="/projects"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          {text.notFound.cta}
        </Link>
      </div>
    </div>
  );
}
