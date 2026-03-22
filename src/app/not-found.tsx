import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-12">
      <div className="rounded-[2rem] border border-white/70 bg-white/90 px-8 py-10 text-center shadow-[0_26px_80px_-40px_rgba(15,23,42,0.45)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
          Not found
        </p>
        <h1 className="mt-4 font-heading text-3xl font-semibold text-slate-950">
          This page does not exist
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-7 text-slate-600">
          The project or member link may be outdated. Return to the workspace to
          choose an active project.
        </p>
        <Link
          href="/projects"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Go to projects
        </Link>
      </div>
    </div>
  );
}
