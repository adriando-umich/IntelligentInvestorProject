"use client";

import { useActionState } from "react";
import { ArrowRight, UserCheck } from "lucide-react";

import {
  acceptProjectInviteAction,
  type ProjectInviteActionState,
} from "@/app/actions/project-invites";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initialState: ProjectInviteActionState = { status: "idle" };

export function ProjectInviteAcceptCard({
  inviteToken,
  projectName,
  invitedEmail,
  role,
  status,
}: {
  inviteToken: string;
  projectName: string;
  invitedEmail?: string | null;
  role: "manager" | "member";
  status: "pending" | "accepted" | "revoked" | "expired";
}) {
  const [state, formAction, pending] = useActionState(
    acceptProjectInviteAction,
    initialState
  );

  const disabled = status !== "pending";

  return (
    <Card className="rounded-[1.75rem] border-white/70 bg-white/90 shadow-[0_24px_80px_-45px_rgba(15,23,42,0.35)]">
      <CardHeader>
        <CardTitle>Join {projectName}</CardTitle>
        <CardDescription>
          {invitedEmail
            ? `This invite is reserved for ${invitedEmail}.`
            : "This is a reusable project invite link. Any signed-in teammate with the link can accept it."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-5 text-sm leading-6 text-slate-700">
          <p>
            You will join this project as <span className="font-medium">{role}</span>.
          </p>
          <p className="mt-2">
            After accepting, you will be redirected into the live workspace and can start recording project activity based on that role.
          </p>
        </div>

        {state.status === "error" ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {state.message}
          </div>
        ) : null}

        {status !== "pending" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This invite is currently {status}. Ask a project manager for a fresh link if you still need access.
          </div>
        ) : null}

        <form action={formAction}>
          <input type="hidden" name="inviteToken" value={inviteToken} />
          <Button
            type="submit"
            className="w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
            disabled={pending || disabled}
          >
            {pending ? <UserCheck className="size-4 animate-pulse" /> : <ArrowRight className="size-4" />}
            {pending ? "Joining project..." : "Accept invite"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
