"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Copy, Link2, Mail, ShieldCheck, Trash2, Users } from "lucide-react";

import {
  createProjectInviteAction,
  revokeProjectInviteAction,
  type ProjectInviteActionState,
} from "@/app/actions/project-invites";
import { useLocale } from "@/components/app/locale-provider";
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
import { getMemberRoleLabel } from "@/lib/finance/types";

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
  const { locale } = useLocale();
  const className =
    role === "owner"
      ? "bg-slate-950 text-white"
      : role === "manager"
        ? "bg-sky-100 text-sky-800"
        : "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {getMemberRoleLabel(role, locale)}
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
  const { locale } = useLocale();
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
  const copy =
    locale === "vi"
      ? {
          currentMembers: "Số thành viên hiện tại",
          pendingInvites: "Lời mời đang chờ",
          joinFlow: "Cách tham gia",
          joinFlowDescription: "Chia sẻ link để thành viên tự chấp nhận",
          currentMembersTitle: "Thành viên hiện tại",
          currentMembersDescription: `Mỗi người trong ${projectName} đều có tài khoản riêng và có thể ghi nhận giao dịch theo quyền của mình.`,
          email: "Email",
          role: "Vai trò",
          joined: "Ngày tham gia",
          noEmail: "Chưa có email",
          howMembersJoinTitle: "Thành viên tham gia như thế nào",
          howMembersJoinDescription:
            "Tạo link mời rồi gửi trực tiếp cho đồng đội. Họ chỉ cần đăng nhập và tự chấp nhận lời mời.",
          emailRestrictedTitle: "Link giới hạn theo email",
          emailRestrictedDescription:
            "Nhập email nếu bạn chỉ muốn đúng một người cụ thể được phép nhận lời mời này.",
          reusableInviteTitle: "Link dùng lại được",
          reusableInviteDescription:
            "Để trống email nếu bạn muốn tạo một link chia sẻ mà bất kỳ thành viên nào đã đăng nhập cũng có thể dùng.",
          inviteMemberTitle: "Mời thành viên",
          inviteMemberDescription:
            "Owner và manager có thể tạo link để thành viên tự vào dự án.",
          inviteDisabledDemo: "Luồng mời thành viên bị tắt trong workspace mẫu.",
          inviteDisabledPermission:
            "Chỉ owner và manager mới có thể tạo link mời cho dự án này.",
          restrictEmail: "Giới hạn cho một email (không bắt buộc)",
          roleAfterJoining: "Vai trò sau khi tham gia",
          createInvite: "Tạo link mời",
          creatingInvite: "Đang tạo lời mời...",
          copyInvite: "Sao chép link mời",
          pendingInviteLinksTitle: "Các link mời đang chờ",
          pendingInviteLinksDescription:
            "Manager có thể gửi lại hoặc thu hồi các link này bất kỳ lúc nào trước khi chúng được chấp nhận.",
          noInvites: "Chưa có link mời nào.",
          invite: "Lời mời",
          status: "Trạng thái",
          expires: "Hết hạn",
          created: "Ngày tạo",
          action: "Thao tác",
          reusableShareLink: "Link chia sẻ dùng lại được",
          revoke: "Thu hồi",
          member: "Thành viên",
          manager: "Quản lý",
        }
      : {
          currentMembers: "Current members",
          pendingInvites: "Pending invites",
          joinFlow: "Join flow",
          joinFlowDescription: "Share a link and let members accept it themselves",
          currentMembersTitle: "Current members",
          currentMembersDescription: `Everyone in ${projectName} gets their own login and can record project transactions according to their role.`,
          email: "Email",
          role: "Role",
          joined: "Joined",
          noEmail: "No email",
          howMembersJoinTitle: "How members join",
          howMembersJoinDescription:
            "Create an invite link, then send it directly to the teammate. They sign in and accept the invite themselves.",
          emailRestrictedTitle: "Email-restricted invite",
          emailRestrictedDescription:
            "Add an email if only one specific teammate should be allowed to accept.",
          reusableInviteTitle: "Reusable invite link",
          reusableInviteDescription:
            "Leave the email blank if you want a shareable link that any signed-in teammate can use.",
          inviteMemberTitle: "Invite a member",
          inviteMemberDescription:
            "Owners and managers can generate share links for members to accept on their own.",
          inviteDisabledDemo: "Invite flow is disabled in the sample workspace.",
          inviteDisabledPermission:
            "Only owners and managers can create invite links for this project.",
          restrictEmail: "Restrict to one email (optional)",
          roleAfterJoining: "Role after joining",
          createInvite: "Create invite link",
          creatingInvite: "Creating invite...",
          copyInvite: "Copy invite link",
          pendingInviteLinksTitle: "Pending invite links",
          pendingInviteLinksDescription:
            "Managers can resend or revoke these links any time before they are accepted.",
          noInvites: "No invite links yet.",
          invite: "Invite",
          status: "Status",
          expires: "Expires",
          created: "Created",
          action: "Action",
          reusableShareLink: "Reusable share link",
          revoke: "Revoke",
          member: "Member",
          manager: "Manager",
        };
  const copyButtonLabel = locale === "vi" ? "Sao chep" : "Copy";
  const copiedMessage = locale === "vi" ? "Da sao chep link moi." : "Invite link copied.";
  const copyFailedMessage =
    locale === "vi"
      ? "Khong the sao chep tu dong. Ban van co the tu copy link nay."
      : "Could not copy automatically. You can still copy the link manually.";
  const revokeFailedMessage =
    locale === "vi" ? "Khong the thu hoi loi moi." : "Unable to revoke invite.";
  const revokedMessage = locale === "vi" ? "Da thu hoi loi moi." : "Invite revoked.";
  const memberLabel = locale === "vi" ? "Thanh vien" : "Member";

  async function copyInvite(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopyMessage(copiedMessage);
      setTimeout(() => setCopyMessage(null), 2500);
    } catch {
      setCopyMessage(copyFailedMessage);
      setTimeout(() => setCopyMessage(null), 3500);
    }
  }

  function revokeInvite(inviteId: string) {
    setRevokeMessage(null);
    setRevokeError(null);

    startRevokeTransition(async () => {
      const result = await revokeProjectInviteAction(projectId, inviteId);

      if (result.status === "error") {
        setRevokeError(result.message ?? revokeFailedMessage);
        return;
      }

      setRevokeMessage(result.message ?? revokedMessage);
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
              <p className="text-sm text-slate-500">{copy.currentMembers}</p>
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
              <p className="text-sm text-slate-500">{copy.pendingInvites}</p>
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
              <p className="text-sm text-slate-500">{copy.joinFlow}</p>
              <p className="text-sm font-medium text-slate-900">
                {copy.joinFlowDescription}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle>{copy.currentMembersTitle}</CardTitle>
          <CardDescription>
            {copy.currentMembersDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{memberLabel}</TableHead>
                <TableHead>{copy.email}</TableHead>
                <TableHead>{copy.role}</TableHead>
                <TableHead>{copy.joined}</TableHead>
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
                  <TableCell className="text-slate-600">{member.email || copy.noEmail}</TableCell>
                  <TableCell>
                    <RoleBadge role={member.role} />
                  </TableCell>
                  <TableCell>{formatDateLabel(member.joinedAt, locale)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-[1.75rem] border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.18),_transparent_34%),linear-gradient(180deg,_#0f172a_0%,_#1e293b_100%)] text-white shadow-[0_24px_80px_-45px_rgba(15,23,42,0.55)]">
          <CardHeader>
            <CardTitle className="text-white">{copy.howMembersJoinTitle}</CardTitle>
            <CardDescription className="text-slate-200">
              {copy.howMembersJoinDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-slate-200">
            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5">
              <p className="font-medium text-teal-100">{copy.emailRestrictedTitle}</p>
              <p className="mt-2">
                {copy.emailRestrictedDescription}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5">
              <p className="font-medium text-teal-100">{copy.reusableInviteTitle}</p>
              <p className="mt-2">
                {copy.reusableInviteDescription}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
          <CardHeader>
          <CardTitle>{copy.inviteMemberTitle}</CardTitle>
          <CardDescription>
            {copy.inviteMemberDescription}
          </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!liveModeEnabled ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {copy.inviteDisabledDemo}
              </div>
            ) : !canManageInvites ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {copy.inviteDisabledPermission}
              </div>
            ) : (
              <form action={createAction} className="space-y-4">
                <input type="hidden" name="projectId" value={projectId} />
                <div className="space-y-2">
                  <Label htmlFor="invite-email">{copy.restrictEmail}</Label>
                  <Input
                    id="invite-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="bao@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">{copy.roleAfterJoining}</Label>
                  <select
                    id="invite-role"
                    name="role"
                    defaultValue="member"
                    className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-300 sm:max-w-[220px]"
                  >
                    <option value="member">{copy.member}</option>
                    <option value="manager">{copy.manager}</option>
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
                        {copy.copyInvite}
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
                  {createPending ? copy.creatingInvite : copy.createInvite}
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
          <CardTitle>{copy.pendingInviteLinksTitle}</CardTitle>
          <CardDescription>
            {copy.pendingInviteLinksDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
              {copy.noInvites}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{copy.invite}</TableHead>
                  <TableHead>{copy.role}</TableHead>
                  <TableHead>{copy.status}</TableHead>
                  <TableHead>{copy.expires}</TableHead>
                  <TableHead>{copy.created}</TableHead>
                  <TableHead className="text-right">{copy.action}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium text-slate-950">
                          {invite.email || copy.reusableShareLink}
                        </p>
                        <p className="text-xs text-slate-500">{invite.inviteLink}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={invite.role} />
                    </TableCell>
                    <TableCell className="capitalize text-slate-700">
                      {locale === "vi"
                        ? ({
                            pending: "đang chờ",
                            accepted: "đã chấp nhận",
                            revoked: "đã thu hồi",
                            expired: "đã hết hạn",
                          } as const)[invite.status]
                        : invite.status}
                    </TableCell>
                    <TableCell>{formatDateLabel(invite.expiresAt, locale)}</TableCell>
                    <TableCell>{formatDateLabel(invite.createdAt, locale)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => copyInvite(invite.inviteLink)}
                        >
                          <Copy className="size-4" />
                          {copyButtonLabel}
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
                            {copy.revoke}
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
