import { redirect } from "next/navigation";

import { SignInForm } from "@/components/app/sign-in-form";
import { getSessionState } from "@/lib/auth/session";

export default async function SignInPage() {
  const session = await getSessionState();

  if (session.isAuthenticated) {
    redirect("/projects");
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 items-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full">
        <SignInForm />
      </div>
    </div>
  );
}
