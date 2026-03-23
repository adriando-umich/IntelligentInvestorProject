import Link from "next/link";
import { getServerI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { text } = await getServerI18n();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-12">
      <div className="rounded-[2.2rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(246,250,248,0.88))] px-8 py-10 text-center shadow-[0_32px_90px_-52px_rgba(15,23,42,0.36)]">
        <p className="inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
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
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#1fc88c_0%,#14b87a_100%)] px-5 text-sm font-medium text-white shadow-[0_18px_34px_-22px_rgba(20,184,122,0.9)] transition hover:brightness-[1.02]"
        >
          {text.notFound.cta}
        </Link>
      </div>
    </div>
  );
}
