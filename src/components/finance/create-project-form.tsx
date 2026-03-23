"use client";

import { useActionState } from "react";
import { FolderPlus, Sparkles } from "lucide-react";

import {
  createProjectAction,
  type ProjectActionState,
} from "@/app/actions/projects";
import { useLocale } from "@/components/app/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: ProjectActionState = { status: "idle" };

export function CreateProjectForm() {
  const { locale, text } = useLocale();
  const [state, formAction, pending] = useActionState(
    createProjectAction,
    initialState
  );
  const currencyLabel = locale === "vi" ? "Tien te" : "Currency";
  const projectNamePlaceholder =
    locale === "vi" ? "Vi du: Nha Sunrise House Flip" : "Sunrise House Flip";

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card className="rounded-[1.9rem] border-white/80 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.24),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(191,219,254,0.22),_transparent_26%),linear-gradient(180deg,_rgba(244,253,248,0.98)_0%,_rgba(233,246,240,0.94)_100%)] text-slate-950 shadow-[0_28px_90px_-50px_rgba(15,23,42,0.34)]">
        <CardHeader className="space-y-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700 shadow-[0_14px_28px_-22px_rgba(16,185,129,0.8)]">
            <Sparkles className="size-3.5" />
            {text.createProject.liveOnboarding}
          </div>
          <CardTitle className="font-heading text-3xl text-slate-950">
            {text.createProject.heroTitle}
          </CardTitle>
          <CardDescription className="max-w-xl text-slate-600">
            {text.createProject.heroDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-slate-600">
          <div className="rounded-[1.5rem] border border-white/85 bg-white/75 p-5 shadow-[0_22px_40px_-32px_rgba(15,23,42,0.24)]">
            <p className="font-medium text-slate-950">{text.createProject.whatGetsCreated}</p>
            <p className="mt-2">
              {text.createProject.whatGetsCreatedDescription}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/85 bg-white/75 p-5 shadow-[0_22px_40px_-32px_rgba(15,23,42,0.24)]">
            <p className="font-medium text-slate-950">{text.createProject.whatNext}</p>
            <p className="mt-2">
              {text.createProject.whatNextDescription}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[1.75rem] border-white/70 bg-white/90 shadow-[0_24px_80px_-45px_rgba(15,23,42,0.35)]">
        <CardHeader>
          <CardTitle>{text.createProject.detailsTitle}</CardTitle>
          <CardDescription>
            {text.createProject.detailsDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="project-name">{text.common.name}</Label>
              <Input
                id="project-name"
                name="name"
                placeholder={projectNamePlaceholder}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency-code">{currencyLabel}</Label>
              <select
                id="currency-code"
                name="currencyCode"
                defaultValue="VND"
                className="flex h-11 w-full rounded-[1.15rem] border border-white/85 bg-white/90 px-3 text-sm text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:max-w-[220px]"
              >
                <option value="VND">VND</option>
                <option value="USD">USD</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-description">{text.createProject.summary}</Label>
              <Textarea
                id="project-description"
                name="description"
                placeholder={text.createProject.summaryPlaceholder}
              />
            </div>

            {state.status === "error" ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {state.message}
              </div>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={pending}
            >
              <FolderPlus className="size-4" />
              {pending ? text.common.creatingProject : text.common.createProject}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
