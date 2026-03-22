import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { DEMO_COOKIE_NAME } from "@/lib/app-config";
import { env, isSupabaseConfigured } from "@/lib/env";
import { syncProfileFromAuthUser } from "@/lib/supabase/profile-sync";

const DEFAULT_NEXT_PATH = "/projects";

function normalizeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/")) {
    return DEFAULT_NEXT_PATH;
  }

  return nextPath;
}

function buildRedirectUrl(request: NextRequest, nextPath: string) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";

  if (process.env.NODE_ENV === "development" || !forwardedHost) {
    return new URL(nextPath, origin);
  }

  return new URL(`${forwardedProto}://${forwardedHost}${nextPath}`);
}

function buildSignInErrorUrl(request: NextRequest, message: string, nextPath: string) {
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("error", message);
  url.searchParams.set("next", nextPath);
  return url;
}

export async function GET(request: NextRequest) {
  const nextPath = normalizeNextPath(
    new URL(request.url).searchParams.get("next")
  );

  if (!isSupabaseConfigured) {
    return NextResponse.redirect(
      buildSignInErrorUrl(
        request,
        "Live auth is not configured for this environment yet.",
        nextPath
      )
    );
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      buildSignInErrorUrl(
        request,
        "Unable to finish Google sign-in. Please try again.",
        nextPath
      )
    );
  }

  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      buildSignInErrorUrl(request, error.message, nextPath)
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await syncProfileFromAuthUser(supabase, user);
  }

  const redirectResponse = NextResponse.redirect(
    buildRedirectUrl(request, nextPath)
  );

  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }

  redirectResponse.cookies.delete(DEMO_COOKIE_NAME);

  return redirectResponse;
}
