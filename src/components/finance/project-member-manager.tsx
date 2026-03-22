"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Copy, Link2, Mail, ShieldCheck, Trash2, Users } from "lucide-react";

import {
  createProjectInviteAction,
  revokeProjectInviteAction,
  type ProjectInviteActionState,
} from "@/app/actions/project-invites";
import { ProfileAvatar } from "@/components/app/profile-avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateLabel } from "@/lib/format";

type MemberSummary = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  role: "owner" | "manager" | "member";
  joinedAt: string;
};

type InviteSummary = {
  id: string;
  email?: string | null;
  role: "manager" | "member";
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
  inviteLink: string;
};

const initialState: ProjectInviteActionState = { status: "idle" };

function RoleBadge({ role }: { role: MemberSummary["role"] | InviteSummary["role"] }) {
  const className =
    role === "owner"
      ? "bg-slate-950 text-white"
      : role === "manager"
        ? "bg-sky-100 text-sky-800"
        : "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {role}
    </span>
  );
}

export function ProjectMemberManager({
  projectId,
  projectName,
  members,
  invites,
  canManageInvites,
  liveModeEnabled,
}: {
  projectId: string;
  projectName: string;
  members: MemberSummary[];
  invites: InviteSummary[];
  canManageInvites: boolean;
  liveModeEnabled: boolean;
}) {
  const [createState, createAction, createPending] = useActionState(
    createProjectInviteAction,
    initialState
  );
  const [revokeMessage, setRevokeMessage] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revokePending, startRevokeTransition] = useTransition();
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const pendingInvites = useMemo(
    () => invites.filter((invite) => invite.status === "pending"),
    [invites]
  );

  async function copyInvite(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopyMessage("Invite link copied.");
      setTimeout(() => setCopyMessage(null), 2500);
    } catch {
      setCopyMessage("Could not copy automatically. You can still copy the link manually.");
      setTimeout(() => setCopyMessage(null), 3500);
    }
  }

  function revokeInvite(inviteId: string) {
    setRevokeMessage(null);
    setRevokeError(null);

    startRevokeTransition(async () => {
      const result = await revokeProjectInviteAction(projectId, inviteId);

      if (result.status === "error") {
        setRevokeError(result.message ?? "Unable to revoke invite.");
        return;
      }

      setRevokeMessage(result.message ?? "Invite revoked.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-[1.5rem] border-white/70 bg-white/90">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Current members</p>
              <p className="text-2xl font-semibold text-slate-950">{members.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[1.5rem] border-white/70 bg-white/90">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
              <Link2 className="size-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Pending invites</p>
              <p className="text-2xl font-semibold text-slate-950">{pendingInvites.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[1.5rem] border-white/70 bg-white/90">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Join flow</p>
              <p className="text-sm font-medium text-slate-900">
                Share a link and let members accept it themselves
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle>Current members</CardTitle>
          <CardDescription>
            Everyone in {projectName} gets their own login and can record project transactions according to their role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <ProfileAvatar
                        name={member.displayName}
                        avatarUrl={member.avatarUrl}
                        size="sm"
                        className="after:hidden"
                      />
                      <span className="font-medium text-slate-950">{member.displayName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">{member.email || "No email"}</TableCell>
                  <TableCell>
                    <RoleBadge role={member.role} />
                  </TableCell>
                  <TableCell>{formatDateLabel(member.joinedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-[1.75rem] border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.18),_transparent_34%),linear-gradient(180deg,_#0f172a_0%,_#1e293b_100%)] text-white shadow-[0_24px_80px_-45px_rgba(15,23,42,0.55)]">
          <CardHeader>
            <CardTitle className="text-white">How members join</CardTitle>
            <CardDescription className="text-slate-200">
              Create an invite link, then send it directly to the teammate. They sign in and accept the invite themselves.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-slate-200">
            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5">
              <p className="font-medium text-teal-100">Email-restricted invite</p>
              <p className="mt-2">
                Add an email if only one specific teammate should be allowed to accept.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5">
              <p className="font-medium text-teal-100">Reusable invite link</p>
              <p className="mt-2">
                Leave the email blank if you want a shareable link that any signed-in teammate can use.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
          <CardHeader>
            <CardTitle>Invite a member</CardTitle>
            <CardDescription>
              Owners and managers can generate share links for members to accept on their own.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!liveModeEnabled ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Invite flow is disabled in the sample workspace.
              </div>
            ) : !canManageInvites ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Only owners and managers can create invite links for this project.
              </div>
            ) : (
              <form action={createAction} className="space-y-4">
                <input type="hidden" name="projectId" value={projectId} />
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Restrict to one email (optional)</Label>
                  <Input
                    id="invite-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="bao@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role after joining</Label>
                  <select
                    id="invite-role"
                    name="role"
                    defaultValue="member"
                    className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-300 sm:max-w-[220px]"
                  >
                    <option value="member">Member</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
                {createState.status === "error" ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {createState.message}
                  </div>
                ) : null}
                {createState.status === "success" ? (
                  <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                    <p>{createState.message}</p>
                    {createState.inviteLink ? (
                      <div className="rounded-2xl border border-emerald-200 bg-white px-3 py-3 text-xs text-slate-700">
                        {createState.inviteLink}
                      </div>
                    ) : null}
                    {createState.inviteLink ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-2xl border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100"
                        onClick={() => copyInvite(createState.inviteLink!)}
                      >
                        <Copy className="size-4" />
                        Copy invite link
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                <Button
                  type="submit"
                  className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
                  disabled={createPending}
                >
                  <Mail className="size-4" />
                  {createPending ? "Creating invite..." : "Create invite link"}
                </Button>
              </form>
            )}

            {copyMessage ? (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                {copyMessage}
              </div>
            ) : null}
            {revokeError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {revokeError}
              </div>
            ) : null}
            {revokeMessage ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {revokeMessage}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle>Pending invite links</CardTitle>
          <CardDescription>
            Managers can resend or revoke these links any time before they are accepted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
              No invite links yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invite</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium text-slate-950">
                          {invite.email || "Reusable share link"}
                        </p>
                        <p className="text-xs text-slate-500">{invite.inviteLink}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={invite.role} />
                    </TableCell>
                    <TableCell className="capitalize text-slate-700">
                      {invite.status}
                    </TableCell>
                    <TableCell>{formatDateLabel(invite.expiresAt)}</TableCell>
                    <TableCell>{formatDateLabel(invite.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => copyInvite(invite.inviteLink)}
                        >
                          <Copy className="size-4" />
                          Copy
                        </Button>
                        {canManageInvites && invite.status === "pending" ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
                            disabled={revokePending}
                            onClick={() => revokeInvite(invite.id)}
                          >
                            <Trash2 className="size-4" />
                            Revoke
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
