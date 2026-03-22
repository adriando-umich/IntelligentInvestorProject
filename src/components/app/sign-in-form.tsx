"use client";

import { useActionState, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  LogIn,
  LoaderCircle,
  ShieldCheck,
  UserPlus,
  WalletCards,
  HandCoins,
  PiggyBank,
} from "lucide-react";

import {
  continueInDemoAction,
  signInAction,
  signUpAction,
  type AuthActionState,
} from "@/app/actions/auth";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-config";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PublicAuthSettings } from "@/lib/supabase/public-auth-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const initialState: AuthActionState = { status: "idle" };

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
    >
      <path
        d="M21.81 12.23c0-.72-.06-1.43-.2-2.12H12v4.02h5.5a4.71 4.71 0 0 1-2.04 3.08v2.55h3.29c1.93-1.78 3.06-4.39 3.06-7.53Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.76 0 5.08-.92 6.77-2.5l-3.29-2.55c-.91.61-2.08.97-3.48.97-2.67 0-4.94-1.8-5.75-4.23H2.86v2.63A10.21 10.21 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.25 13.69A6.14 6.14 0 0 1 5.93 12c0-.58.11-1.14.31-1.69V7.68H2.86A10.2 10.2 0 0 0 1.78 12c0 1.63.39 3.18 1.08 4.32l3.39-2.63Z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.08c1.5 0 2.85.52 3.91 1.52l2.93-2.94C17.08 2.99 14.76 2 12 2a10.21 10.21 0 0 0-9.14 5.68l3.38 2.63c.82-2.44 3.09-4.23 5.76-4.23Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function MessageBanner({
  state,
}: {
  state: AuthActionState;
}) {
  if (state.status === "error") {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {state.message}
      </div>
    );
  }

  if (state.status === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        {state.message}
      </div>
    );
  }

  return null;
}

export function SignInForm({
  authSettings,
}: {
  authSettings: PublicAuthSettings;
}) {
  const searchParams = useSearchParams();
  const [signInState, signInFormAction, signInPending] = useActionState(
    signInAction,
    initialState
  );
  const [signUpState, signUpFormAction, signUpPending] = useActionState(
    signUpAction,
    initialState
  );
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);
  const [oauthPending, startOauthTransition] = useTransition();

  const oauthErrorFromSearch = searchParams.get("error");
  const googleSignInAvailable =
    isSupabaseConfigured && authSettings.isAvailable && authSettings.googleEnabled;
  const emailAuthAvailable =
    !isSupabaseConfigured || !authSettings.isAvailable || authSettings.emailEnabled;
  const safeNextPath = (() => {
    const nextPath = searchParams.get("next");

    if (!nextPath || !nextPath.startsWith("/")) {
      return "/projects";
    }

    return nextPath;
  })();

  async function handleGoogleSignIn() {
    if (!isSupabaseConfigured) {
      setOauthMessage("Google sign-in is unavailable until Supabase auth is configured.");
      return;
    }

    setOauthMessage(null);

    startOauthTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", safeNextPath);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
          scopes: "email profile",
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) {
        setOauthMessage(error.message);
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <Card className="overflow-hidden rounded-[2rem] border-white/70 bg-white/90 shadow-[0_26px_80px_-40px_rgba(15,23,42,0.45)]">
        <CardContent className="grid min-h-[560px] items-stretch gap-0 p-0 lg:grid-cols-[1.2fr_0.8fr]">
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
                <div className="flex items-center gap-2 text-teal-100">
                  <WalletCards className="size-4" />
                  <p className="text-sm font-medium">Plain-language money view</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Project cash, team debts, capital, and profit stay separated
                  so nobody has to decode accounting terms.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5">
                <div className="flex items-center gap-2 text-teal-100">
                  <HandCoins className="size-4" />
                  <p className="text-sm font-medium">Shared-expense settlement</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  The app suggests who should pay whom, Splitwise-style, without
                  mixing that up with profit payouts.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5 sm:col-span-2">
                <div className="flex items-center gap-2 text-teal-100">
                  <PiggyBank className="size-4" />
                  <p className="text-sm font-medium">Capital-based profit logic</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Profit weights only follow capital contributions. Operating
                  income and expense still show up clearly, but they do not
                  silently rewrite ownership.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center px-8 py-10">
            <div className="space-y-5">
              <div className="space-y-2">
                <CardTitle className="font-heading text-2xl text-slate-950">
                  Access the workspace
                </CardTitle>
                <p className="text-sm leading-6 text-slate-600">
                  {isSupabaseConfigured
                    ? "Sign in with your project account, or create one if this is your first time here."
                    : "This deployment is currently running without live Supabase auth, so the sample workspace is the available path."}
                </p>
              </div>

              {isSupabaseConfigured ? (
                <div className="space-y-3">
                  {googleSignInAvailable ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-full rounded-2xl border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                        onClick={handleGoogleSignIn}
                        disabled={oauthPending}
                      >
                        {oauthPending ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <GoogleMark className="size-4" />
                        )}
                        {oauthPending
                          ? "Redirecting to Google..."
                          : "Continue with Google"}
                      </Button>
                      <p className="text-xs leading-5 text-slate-500">
                        Use a Google account for a quicker first login. New members
                        can still create a password-based account below if they
                        prefer.
                      </p>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      Google sign-in is not enabled for this workspace yet. Use
                      email below for now.
                    </div>
                  )}
                  <MessageBanner
                    state={{
                      status:
                        oauthMessage || oauthErrorFromSearch ? "error" : "idle",
                      message: oauthMessage ?? oauthErrorFromSearch ?? undefined,
                    }}
                  />
                  {emailAuthAvailable ? (
                    <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
                      <span className="h-px flex-1 bg-slate-200" />
                      Or continue with email
                      <span className="h-px flex-1 bg-slate-200" />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <Tabs
                defaultValue="sign-in"
                className="space-y-4"
              >
                <TabsList
                  className="grid w-full grid-cols-2 rounded-2xl bg-slate-100 p-1"
                  variant="default"
                >
                  <TabsTrigger
                    value="sign-in"
                    className="rounded-[1rem] data-active:bg-white"
                  >
                    Sign in
                  </TabsTrigger>
                  <TabsTrigger
                    value="sign-up"
                    className="rounded-[1rem] data-active:bg-white"
                  >
                    Create account
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="sign-in" className="space-y-4">
                  {isSupabaseConfigured && emailAuthAvailable ? (
                    <form action={signInFormAction} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="sign-in-email">Email</Label>
                        <Input
                          id="sign-in-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          placeholder="linh@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sign-in-password">Password</Label>
                        <Input
                          id="sign-in-password"
                          name="password"
                          type="password"
                          autoComplete="current-password"
                          placeholder="********"
                        />
                      </div>
                      <MessageBanner state={signInState} />
                      <Button
                        type="submit"
                        className="w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
                        disabled={signInPending}
                      >
                        <LogIn className="size-4" />
                        {signInPending ? "Signing in..." : "Sign in"}
                      </Button>
                    </form>
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                      {isSupabaseConfigured
                        ? "Email sign-in is currently disabled for this workspace."
                        : "Live sign-in is disabled until Supabase is configured for this environment."}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="sign-up" className="space-y-4">
                  {isSupabaseConfigured && emailAuthAvailable ? (
                    <form action={signUpFormAction} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="display-name">Display name</Label>
                        <Input
                          id="display-name"
                          name="displayName"
                          autoComplete="name"
                          placeholder="Linh Nguyen"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sign-up-email">Email</Label>
                        <Input
                          id="sign-up-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          placeholder="linh@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sign-up-password">Password</Label>
                        <Input
                          id="sign-up-password"
                          name="password"
                          type="password"
                          autoComplete="new-password"
                          placeholder="At least 8 characters"
                        />
                      </div>
                      <MessageBanner state={signUpState} />
                      {authSettings.emailConfirmationRequired ? (
                        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                          New accounts need email confirmation before the first
                          live sign-in.
                        </div>
                      ) : null}
                      <Button
                        type="submit"
                        className="w-full rounded-2xl bg-teal-700 text-white hover:bg-teal-600"
                        disabled={signUpPending}
                      >
                        <UserPlus className="size-4" />
                        {signUpPending ? "Creating account..." : "Create account"}
                      </Button>
                    </form>
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                      {isSupabaseConfigured
                        ? "Email account creation is currently disabled for this workspace."
                        : "Account creation will be available once Supabase auth is enabled for this deployment."}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="rounded-[1.5rem] border border-teal-200 bg-teal-50 px-5 py-5">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-teal-950">
                    Need a quick walkthrough first?
                  </p>
                  <p className="text-sm leading-6 text-teal-900/80">
                    Open the sample workspace to explore the dashboard, member
                    statements, settlements, and reconciliation screens before
                    entering live data.
                  </p>
                </div>
                <form action={continueInDemoAction} className="mt-4">
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full rounded-2xl border-teal-200 bg-white text-teal-900 hover:bg-teal-100"
                  >
                    <ShieldCheck className="size-4" />
                    Open sample workspace
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
