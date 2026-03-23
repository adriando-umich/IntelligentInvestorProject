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
import { useLocale } from "@/components/app/locale-provider";
import { APP_NAME } from "@/lib/app-config";
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
  const { text } = useLocale();
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
      setOauthMessage(text.signIn.googleSetupMissing);
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
    <div className="mx-auto w-full max-w-[1180px]">
      <Card className="overflow-hidden rounded-[2.25rem] border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(247,251,249,0.86))] shadow-[0_40px_110px_-62px_rgba(15,23,42,0.4)]">
        <CardContent className="grid min-h-[560px] items-stretch gap-0 p-0 lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
          <div className="relative flex flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.28),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(191,219,254,0.34),_transparent_30%),linear-gradient(180deg,_rgba(244,253,248,0.98)_0%,_rgba(235,246,241,0.94)_100%)] px-6 py-8 text-slate-950 sm:px-8 sm:py-10">
            <div className="pointer-events-none absolute inset-x-6 top-6 h-36 rounded-[2rem] bg-white/40 blur-3xl" />
            <div className="relative space-y-6">
              <span className="inline-flex rounded-full border border-emerald-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 shadow-[0_12px_26px_-22px_rgba(16,185,129,0.8)]">
                Project finance
              </span>
              <div className="space-y-4">
                <h1 className="font-heading text-[3.2rem] font-semibold tracking-[-0.05em] text-slate-950 sm:text-[3.45rem]">
                  {APP_NAME}
                </h1>
                <p className="max-w-xl text-base leading-8 text-slate-600">
                  {text.app.tagline}
                </p>
              </div>
              <div className="grid max-w-xl gap-3 sm:grid-cols-3">
                <div className="rounded-[1.4rem] border border-white/80 bg-white/75 px-4 py-4 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.28)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Style
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    Splitwise clarity
                  </p>
                </div>
                <div className="rounded-[1.4rem] border border-white/80 bg-white/75 px-4 py-4 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.28)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Focus
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    Cash and capital
                  </p>
                </div>
                <div className="rounded-[1.4rem] border border-white/80 bg-white/75 px-4 py-4 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.28)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Feel
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    Soft Apple surfaces
                  </p>
                </div>
              </div>
            </div>

            <div className="relative grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.6rem] border border-white/80 bg-white/78 p-5 shadow-[0_22px_40px_-32px_rgba(15,23,42,0.28)]">
                <div className="flex items-center gap-2 text-emerald-700">
                  <WalletCards className="size-4" />
                  <p className="text-sm font-medium text-slate-900">
                    {text.signIn.plainLanguageTitle}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {text.signIn.plainLanguageDescription}
                </p>
              </div>
              <div className="rounded-[1.6rem] border border-white/80 bg-white/78 p-5 shadow-[0_22px_40px_-32px_rgba(15,23,42,0.28)]">
                <div className="flex items-center gap-2 text-sky-700">
                  <HandCoins className="size-4" />
                  <p className="text-sm font-medium text-slate-900">
                    {text.signIn.settlementTitle}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {text.signIn.settlementDescription}
                </p>
              </div>
              <div className="rounded-[1.6rem] border border-white/80 bg-white/78 p-5 shadow-[0_22px_40px_-32px_rgba(15,23,42,0.28)] sm:col-span-2">
                <div className="flex items-center gap-2 text-amber-700">
                  <PiggyBank className="size-4" />
                  <p className="text-sm font-medium text-slate-900">
                    {text.signIn.capitalTitle}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {text.signIn.capitalDescription}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center bg-white/58 px-6 py-8 lg:border-l lg:border-white/80 lg:px-8 lg:py-10">
            <div className="mx-auto w-full max-w-[430px] space-y-5">
              <div className="space-y-2">
                <CardTitle className="font-heading text-2xl text-slate-950">
                  {text.signIn.accessWorkspaceTitle}
                </CardTitle>
                <p className="text-sm leading-6 text-slate-600">
                  {isSupabaseConfigured
                    ? text.signIn.accessWorkspaceLiveDescription
                    : text.signIn.accessWorkspaceDemoDescription}
                </p>
              </div>

              {isSupabaseConfigured ? (
                <div className="space-y-3">
                  {googleSignInAvailable ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-full justify-center border-white/80 bg-white/92 text-slate-900 hover:bg-white"
                        onClick={handleGoogleSignIn}
                        disabled={oauthPending}
                      >
                        {oauthPending ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <GoogleMark className="size-4" />
                        )}
                        {oauthPending
                          ? text.signIn.googleRedirecting
                          : text.signIn.googleContinue}
                      </Button>
                      <p className="text-xs leading-5 text-slate-500">
                        {text.signIn.googleHelper}
                      </p>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      {text.signIn.googleUnavailable}
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
                      <span className="h-px flex-1 bg-slate-200/80" />
                      {text.signIn.continueWithEmail}
                      <span className="h-px flex-1 bg-slate-200/80" />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <Tabs
                defaultValue="sign-in"
                className="space-y-4"
              >
                <TabsList className="grid w-full grid-cols-2" variant="default">
                  <TabsTrigger
                    value="sign-in"
                    className="data-active:bg-white"
                  >
                    {text.signIn.signInTab}
                  </TabsTrigger>
                  <TabsTrigger
                    value="sign-up"
                    className="data-active:bg-white"
                  >
                    {text.signIn.signUpTab}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="sign-in" className="space-y-4">
                  {isSupabaseConfigured && emailAuthAvailable ? (
                    <form
                      action={signInFormAction}
                      className="space-y-4 rounded-[1.7rem] border border-white/90 bg-white/72 p-5 shadow-[0_26px_50px_-40px_rgba(15,23,42,0.3)]"
                    >
                      <input type="hidden" name="nextPath" value={safeNextPath} />
                      <div className="space-y-2">
                        <Label htmlFor="sign-in-email">{text.common.email}</Label>
                        <Input
                          id="sign-in-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          placeholder="linh@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sign-in-password">{text.common.password}</Label>
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
                        className="w-full"
                        disabled={signInPending}
                      >
                        <LogIn className="size-4" />
                        {signInPending ? text.common.signingIn : text.common.signIn}
                      </Button>
                    </form>
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                      {isSupabaseConfigured
                        ? text.signIn.emailDisabledConfigured
                        : text.signIn.emailDisabledUnconfigured}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="sign-up" className="space-y-4">
                  {isSupabaseConfigured && emailAuthAvailable ? (
                    <form
                      action={signUpFormAction}
                      className="space-y-4 rounded-[1.7rem] border border-white/90 bg-white/72 p-5 shadow-[0_26px_50px_-40px_rgba(15,23,42,0.3)]"
                    >
                      <input type="hidden" name="nextPath" value={safeNextPath} />
                      <div className="space-y-2">
                        <Label htmlFor="display-name">{text.common.displayName}</Label>
                        <Input
                          id="display-name"
                          name="displayName"
                          autoComplete="name"
                          placeholder="Linh Nguyen"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sign-up-email">{text.common.email}</Label>
                        <Input
                          id="sign-up-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          placeholder="linh@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sign-up-password">{text.common.password}</Label>
                        <Input
                          id="sign-up-password"
                          name="password"
                          type="password"
                          autoComplete="new-password"
                          placeholder={text.signIn.passwordPlaceholder}
                        />
                      </div>
                      <MessageBanner state={signUpState} />
                      {authSettings.emailConfirmationRequired ? (
                        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                          {text.signIn.confirmationRequired}
                        </div>
                      ) : null}
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={signUpPending}
                      >
                        <UserPlus className="size-4" />
                        {signUpPending
                          ? text.common.creatingAccount
                          : text.common.createAccount}
                      </Button>
                    </form>
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                      {isSupabaseConfigured
                        ? text.signIn.signUpDisabledConfigured
                        : text.signIn.signUpDisabledUnconfigured}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="rounded-[1.7rem] border border-emerald-200/80 bg-[linear-gradient(180deg,rgba(240,253,247,0.95),rgba(230,248,239,0.92))] px-5 py-5 shadow-[0_24px_50px_-38px_rgba(16,185,129,0.35)]">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-emerald-950">
                    {text.signIn.demoCardTitle}
                  </p>
                  <p className="text-sm leading-6 text-emerald-900/80">
                    {text.signIn.demoCardDescription}
                  </p>
                </div>
                <form action={continueInDemoAction} className="mt-4">
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full border-emerald-200/80 bg-white/90 text-emerald-900 hover:bg-white"
                  >
                    <ShieldCheck className="size-4" />
                    {text.common.openSampleWorkspace}
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
