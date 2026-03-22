import "server-only";

import type { User } from "@supabase/supabase-js";

import { getUserAvatarUrl, getUserDisplayName } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Exclude<
  Awaited<ReturnType<typeof createSupabaseServerClient>>,
  null
>;

function isMissingAvatarColumnError(error: { message?: string } | null) {
  return (
    error?.message?.toLowerCase().includes("avatar_url") === true &&
    error.message.toLowerCase().includes("column") === true
  );
}

export async function syncProfileFromAuthUser(
  supabase: SupabaseServerClient,
  user: User
) {
  const displayName = getUserDisplayName(user.user_metadata, user.email);
  const avatarUrl = getUserAvatarUrl(user.user_metadata);

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      display_name: displayName,
      email: user.email ?? "",
      avatar_url: avatarUrl,
    },
    {
      onConflict: "user_id",
    }
  );

  if (!error || isMissingAvatarColumnError(error)) {
    return;
  }

  console.error("Unable to sync auth profile metadata", error);
}
