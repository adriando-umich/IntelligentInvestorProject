import "server-only";

type RpcCapableClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{
    data?: unknown;
    error?: { code?: string; message?: string } | null;
  }>;
};

function isMissingRecoveryFunctionError(
  error: { code?: string; message?: string } | null | undefined
) {
  if (!error) {
    return false;
  }

  if (error.code === "PGRST202" || error.code === "42883") {
    return true;
  }

  const message = error.message?.toLowerCase() ?? "";
  return (
    message.includes("could not find the function") ||
    message.includes("function public.relink_my_project_memberships_by_email") ||
    message.includes("schema cache")
  );
}

export async function recoverProjectMembershipsByEmail(
  supabase: RpcCapableClient
) {
  const { error } = await supabase.rpc("relink_my_project_memberships_by_email");

  if (!error || isMissingRecoveryFunctionError(error)) {
    return;
  }

  console.error("Unable to recover project memberships by email", error);
}
