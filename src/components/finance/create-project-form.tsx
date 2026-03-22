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
      <Card className="rounded-[1.75rem] border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.18),_transparent_34%),linear-gradient(180deg,_#0f172a_0%,_#1e293b_100%)] text-white shadow-[0_24px_80px_-45px_rgba(15,23,42,0.55)]">
        <CardHeader className="space-y-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-teal-100">
            <Sparkles className="size-3.5" />
            {text.createProject.liveOnboarding}
          </div>
          <CardTitle className="font-heading text-3xl text-white">
            {text.createProject.heroTitle}
          </CardTitle>
          <CardDescription className="max-w-xl text-slate-200">
            {text.createProject.heroDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-slate-200">
            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5">
            <p className="font-medium text-teal-100">{text.createProject.whatGetsCreated}</p>
            <p className="mt-2">
              {text.createProject.whatGetsCreatedDescription}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5">
            <p className="font-medium text-teal-100">{text.createProject.whatNext}</p>
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
                className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-300 sm:max-w-[220px]"
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
              className="w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
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
