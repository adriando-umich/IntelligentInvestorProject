export function getUserDisplayName(
  metadata: Record<string, unknown> | null | undefined,
  email: string | null | undefined
) {
  const displayName =
    (typeof metadata?.display_name === "string" && metadata.display_name.trim()) ||
    (typeof metadata?.name === "string" && metadata.name.trim()) ||
    undefined;

  if (displayName) {
    return displayName;
  }

  const emailPrefix = email?.split("@")[0]?.trim();
  return emailPrefix && emailPrefix.length > 0 ? emailPrefix : "Project member";
}

export function getUserAvatarUrl(
  metadata: Record<string, unknown> | null | undefined
) {
  const avatarUrl =
    (typeof metadata?.avatar_url === "string" && metadata.avatar_url.trim()) ||
    (typeof metadata?.picture === "string" && metadata.picture.trim()) ||
    undefined;

  return avatarUrl && avatarUrl.length > 0 ? avatarUrl : null;
}

export function getInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) {
    return "PM";
  }

  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
}
