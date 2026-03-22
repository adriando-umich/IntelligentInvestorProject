import "server-only";

import { env, isSupabaseConfigured } from "@/lib/env";

export type PublicAuthSettings = {
  isAvailable: boolean;
  emailEnabled: boolean;
  googleEnabled: boolean;
  emailConfirmationRequired: boolean;
};

const defaultSettings: PublicAuthSettings = {
  isAvailable: false,
  emailEnabled: true,
  googleEnabled: false,
  emailConfirmationRequired: false,
};

type SupabaseSettingsResponse = {
  disable_signup?: boolean;
  mailer_autoconfirm?: boolean;
  external?: {
    email?: boolean;
    google?: boolean;
  };
};

export async function getPublicAuthSettings(): Promise<PublicAuthSettings> {
  if (!isSupabaseConfigured) {
    return defaultSettings;
  }

  try {
    const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return defaultSettings;
    }

    const settings = (await response.json()) as SupabaseSettingsResponse;
    const emailEnabled = settings.external?.email ?? true;

    return {
      isAvailable: true,
      emailEnabled,
      googleEnabled: settings.external?.google ?? false,
      emailConfirmationRequired:
        emailEnabled &&
        !Boolean(settings.disable_signup) &&
        !Boolean(settings.mailer_autoconfirm),
    };
  } catch {
    return defaultSettings;
  }
}
