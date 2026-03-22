import { redirect } from "next/navigation";

import { getSessionState } from "@/lib/auth/session";

export default async function Home() {
  const session = await getSessionState();
  redirect(session.isAuthenticated ? "/projects" : "/sign-in");
}
