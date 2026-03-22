"use client";

import { useActionState } from "react";
import { FolderPlus, Sparkles } from "lucide-react";

import {
  createProjectAction,
  type ProjectActionState,
} from "@/app/actions/projects";
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
  const [state, formAction, pending] = useActionState(
    createProjectAction,
    initialState
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card className="rounded-[1.75rem] border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.18),_transparent_34%),linear-gradient(180deg,_#0f172a_0%,_#1e293b_100%)] text-white shadow-[0_24px_80px_-45px_rgba(15,23,42,0.55)]">
        <CardHeader className="space-y-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-teal-100">
            <Sparkles className="size-3.5" />
            Live onboarding
          </div>
          <CardTitle className="font-heading text-3xl text-white">
            Create your first live project
          </CardTitle>
          <CardDescription className="max-w-xl text-slate-200">
            This sets up a real project in Supabase and adds you as the owner,
            so you can start recording transactions immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-slate-200">
          <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5">
            <p className="font-medium text-teal-100">What gets created</p>
            <p className="mt-2">
              A project record, a unique project slug, and your owner
              membership in the project.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5">
            <p className="font-medium text-teal-100">What you can do next</p>
            <p className="mt-2">
              Add capital, customer income, operating expenses, cash handovers,
              and settlement payments from the project dashboard.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[1.75rem] border-white/70 bg-white/90 shadow-[0_24px_80px_-45px_rgba(15,23,42,0.35)]">
        <CardHeader>
          <CardTitle>Project details</CardTitle>
          <CardDescription>
            Start with the basics. You can add more members after the project
            exists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                name="name"
                placeholder="Sunrise House Flip"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency-code">Currency</Label>
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
              <Label htmlFor="project-description">Project summary</Label>
              <Textarea
                id="project-description"
                name="description"
                placeholder="Example: Members use their own bank accounts, and this workspace only tracks the project's money."
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
              {pending ? "Creating project..." : "Create project"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
