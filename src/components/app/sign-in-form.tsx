"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, LogIn, ShieldCheck } from "lucide-react";

import {
  continueInDemoAction,
  signInAction,
  type AuthActionState,
} from "@/app/actions/auth";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-config";
import { env, isSupabaseConfigured } from "@/lib/env";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = { status: "idle" };

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="overflow-hidden rounded-[2rem] border-white/70 bg-white/90 shadow-[0_26px_80px_-40px_rgba(15,23,42,0.45)]">
        <CardContent className="grid min-h-[520px] items-stretch gap-0 p-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-col justify-between bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.22),_transparent_38%),linear-gradient(180deg,_#0f172a_0%,_#1e293b_100%)] px-8 py-10 text-white">
            <div className="space-y-5">
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-teal-100">
                Project finance
              </span>
              <div className="space-y-3">
                <h1 className="font-heading text-4xl font-semibold tracking-tight">
                  {APP_NAME}
                </h1>
                <p className="max-w-lg text-sm leading-7 text-slate-200">
                  {APP_TAGLINE}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5">
                <p className="text-sm font-medium text-teal-100">
                  People-friendly numbers
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Separate cards for project cash, team debts, capital, and
                  profit so the dashboard never hides meaning.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5">
                <p className="text-sm font-medium text-teal-100">
                  Demo-first today
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  If Supabase env is missing, you can still enter the app in
                  demo mode and inspect the full experience.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center px-8 py-10">
            <div className="space-y-6">
              <div className="space-y-2">
                <CardTitle className="font-heading text-2xl text-slate-950">
                  Sign in
                </CardTitle>
                <p className="text-sm leading-6 text-slate-600">
                  {isSupabaseConfigured
                    ? "Use your Supabase credentials to open the live workspace."
                    : "Supabase env is not configured yet, so live auth is disabled and demo mode is recommended."}
                </p>
              </div>

              <form action={formAction} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="linh@example.com"
                    defaultValue={isSupabaseConfigured ? "" : "linh@example.com"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="********"
                    defaultValue={isSupabaseConfigured ? "" : "demo-demo"}
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
                  <LogIn className="size-4" />
                  {pending ? "Signing in..." : "Sign in"}
                </Button>
              </form>

              <form action={continueInDemoAction}>
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full rounded-2xl border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100"
                >
                  <ShieldCheck className="size-4" />
                  Continue in demo mode
                </Button>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] border-white/70 bg-white/80 shadow-[0_26px_80px_-40px_rgba(15,23,42,0.45)]">
        <CardHeader className="space-y-4 pb-4">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Deploy readiness
          </span>
          <CardTitle className="font-heading text-3xl font-semibold text-slate-950">
            Environment snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-sm leading-6 text-slate-600">
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <p className="font-medium text-slate-900">Runtime mode</p>
            <p className="mt-2">
              {isSupabaseConfigured
                ? "Supabase env detected. Auth can use real credentials."
                : "No Supabase env detected. The app runs in demo-first mode."}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <p className="font-medium text-slate-900">Expected public env</p>
            <ul className="mt-3 space-y-1 text-slate-600">
              <li>`NEXT_PUBLIC_SUPABASE_URL`</li>
              <li>`NEXT_PUBLIC_SUPABASE_ANON_KEY`</li>
              <li>`NEXT_PUBLIC_APP_URL`</li>
            </ul>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <p className="font-medium text-slate-900">Current app URL</p>
            <p className="mt-2 break-all">{env.NEXT_PUBLIC_APP_URL}</p>
          </div>
          <Link
            href="/projects"
            className={cn(
              buttonVariants({ variant: "link" }),
              "px-0 text-slate-900"
            )}
          >
            Skip to project overview
            <ArrowRight className="size-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
