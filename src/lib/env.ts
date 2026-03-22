import { DEFAULT_CURRENCY_CODE } from "@/lib/app-config";

const rawEnv = {
  nextPublicSupabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  nextPublicSupabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
};

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: rawEnv.nextPublicSupabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: rawEnv.nextPublicSupabaseAnonKey,
  NEXT_PUBLIC_APP_URL: rawEnv.nextPublicAppUrl,
  SUPABASE_SERVICE_ROLE_KEY: rawEnv.supabaseServiceRoleKey,
  DEFAULT_CURRENCY_CODE,
};

export const isSupabaseConfigured = Boolean(
  env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const hasServiceRoleKey = Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
