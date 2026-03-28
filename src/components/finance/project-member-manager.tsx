"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState, useTransition } from "react";
import { Copy, Link2, Mail, ShieldCheck, Trash2, Users } from "lucide-react";

import {
  createProjectInviteAction,
  revokeProjectInviteAction,
  type ProjectInviteActionState,
} from "@/app/actions/project-invites";
import {
  removeProjectMemberAction,
  transferProjectOwnershipAction,
} from "@/app/actions/projects";
import { useLocale } from "@/components/app/locale-provider";
import { ProfileAvatar } from "@/components/app/profile-avatar";
import { TableSurface, TableToolbar } from "@/components/finance/table-toolbar";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
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
import {
  canRemoveProjectMember,
  canTransferOwnershipToMember,
} from "@/lib/projects/member-governance";
import { normalizeSearchText } from "@/lib/search";

type MemberSummary = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  role: "owner" | "manager" | "member";
  joinedAt: string;
  membershipStatus: "active" | "pending_invite";
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

type MemberGovernanceActivity = {
  id: string;
  actorDisplayName: string;
  targetDisplayName: string;
  eventType: "ownership_transferred" | "member_removed";
  occurredAt: string;
};

const initialState: ProjectInviteActionState = { status: "idle" };

function RoleBadge({
  role,
}: {
  role: MemberSummary["role"] | InviteSummary["role"];
}) {
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

function MembershipBadge({
  status,
}: {
  status: MemberSummary["membershipStatus"];
}) {
  const { locale } = useLocale();

  if (status === "active") {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
        {locale === "vi" ? "Dang hoat dong" : "Active"}
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
      {locale === "vi" ? "Cho chap nhan" : "Pending invite"}
    </span>
  );
}

export function ProjectMemberManager({
  projectId,
  projectName,
  members,
  memberActivity,
  invites,
  canManageInvites,
  canTransferOwnership,
  viewerProjectMemberId,
  viewerRole,
  liveModeEnabled,
}: {
  projectId: string;
  projectName: string;
  members: MemberSummary[];
  memberActivity: MemberGovernanceActivity[];
  invites: InviteSummary[];
  canManageInvites: boolean;
  canTransferOwnership: boolean;
  viewerProjectMemberId: string | null;
  viewerRole: MemberSummary["role"] | null;
  liveModeEnabled: boolean;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const [createState, createAction, createPending] = useActionState(
    createProjectInviteAction,
    initialState
  );
  const [revokeMessage, setRevokeMessage] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revokePending, startRevokeTransition] = useTransition();
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<MemberSummary | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferPending, startTransferTransition] = useTransition();
  const [removeMessage, setRemoveMessage] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MemberSummary | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removePending, startRemoveTransition] = useTransition();
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberRoleFilter, setMemberRoleFilter] = useState<
    "all" | "owner" | "manager" | "member"
  >("all");
  const [memberSort, setMemberSort] = useState<
    "name_asc" | "joined_desc" | "role"
  >("name_asc");
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteStatusFilter, setInviteStatusFilter] = useState<
    "all" | InviteSummary["status"]
  >("all");
  const [inviteSort, setInviteSort] = useState<
    "created_desc" | "expires_asc" | "email_asc"
  >("created_desc");

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
          statement: "Statement",
          pdf: "PDF",
          transferOwnership: "Chuyen ownership",
          transferOwnershipTitle: "Chuyen ownership project?",
          transferOwnershipDescription: (memberName: string) =>
            `${memberName} se tro thanh owner moi cua ${projectName}.`,
          transferOwnershipWarning:
            "Owner hien tai se duoc doi thanh manager va van giu quyen quan ly project.",
          transferOwnershipConfirm: "Xac nhan chuyen ownership",
          transferringOwnership: "Dang chuyen ownership...",
          transferOwnershipUnavailable:
            "Chi owner hien tai moi co the chuyen ownership cho mot thanh vien dang hoat dong khac.",
          removeMember: "Remove member",
          removeMemberTitle: "Remove member from project?",
          removeMemberDescription: (memberName: string) =>
            `${memberName} se mat quyen truy cap vao ${projectName}, nhung lich su giao dich truoc do van duoc giu nguyen.`,
          removeMemberWarning:
            "Remove member se chi deactivate membership hien tai. Statement va cac giao dich cu van duoc giu de bao toan lich su.",
          removeMemberConfirm: "Xac nhan remove member",
          removingMember: "Dang remove member...",
          removeMemberUnavailable:
            "Chi owner hoac manager dang hoat dong moi co the remove mot thanh vien dang hoat dong khac.",
          transferOwnershipSuccess: "Da cap nhat owner moi cho project.",
          removeMemberSuccess: "Da remove member khoi project.",
          cancel: "Huy",
          governanceActivityTitle: "Lich su quan ly thanh vien",
          governanceActivityDescription:
            "Theo doi cac thay doi quan trong nhu chuyen ownership va remove member.",
          noGovernanceActivity:
            "Chua co thay doi ownership hay remove member nao duoc ghi nhan.",
          ownershipTransferredActivity: (
            actorName: string,
            targetName: string
          ) => `${actorName} da chuyen ownership cho ${targetName}.`,
          memberRemovedActivity: (actorName: string, targetName: string) =>
            `${actorName} da remove ${targetName} khoi project.`,
          reusableShareLink: "Link chia sẻ dùng lại được",
          revoke: "Thu hồi",
          member: "Thành viên",
          manager: "Quản lý",
          owner: "Owner",
          memberSearchPlaceholder: "Tìm theo tên thành viên hoặc email...",
          searchLabel: "Tìm kiếm",
          inviteSearchPlaceholder: "Tìm theo email hoặc chính link mời...",
          allRoles: "Tất cả vai trò",
          allStatuses: "Tất cả trạng thái",
          sort: "Sắp xếp",
          sortByName: "Tên A-Z",
          sortByJoined: "Mới tham gia nhất",
          sortByRole: "Theo vai trò",
          sortByCreated: "Lời mời mới nhất",
          sortByExpiry: "Sắp hết hạn",
          sortByEmail: "Email A-Z",
          showingMembers: (count: number) => `${count} thành viên đang hiển thị.`,
          showingInvites: (count: number) => `${count} lời mời đang hiển thị.`,
          noMembersMatch: "Không có thành viên nào khớp với tìm kiếm hoặc bộ lọc hiện tại.",
          noInvitesMatch: "Không có lời mời nào khớp với tìm kiếm hoặc bộ lọc hiện tại.",
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
          statement: "Statement",
          pdf: "PDF",
          transferOwnership: "Transfer ownership",
          transferOwnershipTitle: "Transfer project ownership?",
          transferOwnershipDescription: (memberName: string) =>
            `${memberName} will become the new owner of ${projectName}.`,
          transferOwnershipWarning:
            "The current owner will be downgraded to manager and will still keep project-management access.",
          transferOwnershipConfirm: "Transfer ownership",
          transferringOwnership: "Transferring ownership...",
          transferOwnershipUnavailable:
            "Only the current owner can transfer ownership to another active project member.",
          removeMember: "Remove member",
          removeMemberTitle: "Remove member from project?",
          removeMemberDescription: (memberName: string) =>
            `${memberName} will lose access to ${projectName}, but prior transaction history will stay intact.`,
          removeMemberWarning:
            "Removing a member only deactivates their current membership. Existing statements and ledger history stay in place for auditability.",
          removeMemberConfirm: "Remove member",
          removingMember: "Removing member...",
          removeMemberUnavailable:
            "Only an active owner or manager can remove another active member.",
          transferOwnershipSuccess: "Project ownership updated.",
          removeMemberSuccess: "Member removed from the project.",
          cancel: "Cancel",
          governanceActivityTitle: "Member governance activity",
          governanceActivityDescription:
            "Track important membership changes like ownership transfers and member removals.",
          noGovernanceActivity:
            "No ownership transfer or member-removal activity has been recorded yet.",
          ownershipTransferredActivity: (
            actorName: string,
            targetName: string
          ) => `${actorName} transferred ownership to ${targetName}.`,
          memberRemovedActivity: (actorName: string, targetName: string) =>
            `${actorName} removed ${targetName} from the project.`,
          reusableShareLink: "Reusable share link",
          revoke: "Revoke",
          member: "Member",
          manager: "Manager",
          owner: "Owner",
          memberSearchPlaceholder: "Search member name or email...",
          searchLabel: "Search",
          inviteSearchPlaceholder: "Search email or invite link...",
          allRoles: "All roles",
          allStatuses: "All statuses",
          sort: "Sort",
          sortByName: "Name A-Z",
          sortByJoined: "Newest joined",
          sortByRole: "Role",
          sortByCreated: "Newest invite",
          sortByExpiry: "Expiring soon",
          sortByEmail: "Email A-Z",
          showingMembers: (count: number) => `${count} members shown.`,
          showingInvites: (count: number) => `${count} invites shown.`,
          noMembersMatch: "No members match the current search or filters.",
          noInvitesMatch: "No invites match the current search or filters.",
        };

  const copyButtonLabel = locale === "vi" ? "Sao chép" : "Copy";
  const copiedMessage = locale === "vi" ? "Đã sao chép link mời." : "Invite link copied.";
  const copyFailedMessage =
    locale === "vi"
      ? "Không thể sao chép tự động. Bạn vẫn có thể tự copy link này."
      : "Could not copy automatically. You can still copy the link manually.";
  const revokeFailedMessage =
    locale === "vi" ? "Không thể thu hồi lời mời." : "Unable to revoke invite.";
  const revokedMessage = locale === "vi" ? "Đã thu hồi lời mời." : "Invite revoked.";
  const memberLabel = locale === "vi" ? "Thành viên" : "Member";

  const memberStatusLabel = locale === "vi" ? "Tráº¡ng thÃ¡i" : "Status";
  const pendingInviteHelper =
    locale === "vi"
      ? "Invite cÃ³ email sáº½ táº¡o sáºµn má»™t pending member Ä‘á»ƒ báº¡n chia chi phÃ­ trÆ°á»›c khi há» tham gia."
      : "Targeted email invites create a pending member immediately, so you can split shared costs before that person joins.";

  const displayedMembers = useMemo(() => {
    const normalizedSearch = normalizeSearchText(memberSearch);

    const roleRank: Record<MemberSummary["role"], number> = {
      owner: 0,
      manager: 1,
      member: 2,
    };

    return [...members]
      .filter((member) => {
        if (memberRoleFilter !== "all" && member.role !== memberRoleFilter) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return (
          normalizeSearchText(member.displayName).includes(normalizedSearch) ||
          normalizeSearchText(member.email).includes(normalizedSearch)
        );
      })
      .sort((left, right) => {
        if (memberSort === "joined_desc") {
          return new Date(right.joinedAt).getTime() - new Date(left.joinedAt).getTime();
        }

        if (memberSort === "role") {
          const diff = roleRank[left.role] - roleRank[right.role];

          if (diff !== 0) {
            return diff;
          }
        }

        return left.displayName.localeCompare(right.displayName, locale);
      });
  }, [locale, memberRoleFilter, memberSearch, memberSort, members]);

  const displayedInvites = useMemo(() => {
    const normalizedSearch = normalizeSearchText(inviteSearch);

    return [...invites]
      .filter((invite) => {
        if (inviteStatusFilter !== "all" && invite.status !== inviteStatusFilter) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return (
          normalizeSearchText(invite.email).includes(normalizedSearch) ||
          normalizeSearchText(invite.inviteLink).includes(normalizedSearch)
        );
      })
      .sort((left, right) => {
        if (inviteSort === "expires_asc") {
          return new Date(left.expiresAt).getTime() - new Date(right.expiresAt).getTime();
        }

        if (inviteSort === "email_asc") {
          return (left.email ?? "").localeCompare(right.email ?? "", locale);
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });
  }, [inviteSearch, inviteSort, inviteStatusFilter, invites, locale]);

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
      router.refresh();
    });
  }

  function openTransferDialog(member: MemberSummary) {
    setTransferMessage(null);
    setTransferError(null);
    setTransferTarget(member);
    setTransferOpen(true);
  }

  function openRemoveDialog(member: MemberSummary) {
    setRemoveMessage(null);
    setRemoveError(null);
    setRemoveTarget(member);
    setRemoveOpen(true);
  }

  function handleTransferOpenChange(open: boolean) {
    if (transferPending) {
      return;
    }

    setTransferOpen(open);

    if (!open) {
      setTransferTarget(null);
      setTransferError(null);
    }
  }

  function handleRemoveOpenChange(open: boolean) {
    if (removePending) {
      return;
    }

    setRemoveOpen(open);

    if (!open) {
      setRemoveTarget(null);
      setRemoveError(null);
    }
  }

  function transferOwnership() {
    if (!transferTarget) {
      return;
    }

    setTransferError(null);

    startTransferTransition(async () => {
      const result = await transferProjectOwnershipAction(
        projectId,
        transferTarget.id
      );

      if (result.status === "error") {
        setTransferError(result.message ?? copy.transferOwnershipUnavailable);
        return;
      }

      setTransferOpen(false);
      setTransferTarget(null);
      setTransferMessage(result.message ?? copy.transferOwnershipSuccess);
      router.refresh();
    });
  }

  function removeMember() {
    if (!removeTarget) {
      return;
    }

    setRemoveError(null);

    startRemoveTransition(async () => {
      const result = await removeProjectMemberAction(projectId, removeTarget.id);

      if (result.status === "error") {
        setRemoveError(result.message ?? copy.removeMemberUnavailable);
        return;
      }

      setRemoveOpen(false);
      setRemoveTarget(null);
      setRemoveMessage(result.message ?? copy.removeMemberSuccess);
      router.refresh();
    });
  }

  function getGovernanceActivityLabel(activity: MemberGovernanceActivity) {
    if (activity.eventType === "ownership_transferred") {
      return copy.ownershipTransferredActivity(
        activity.actorDisplayName,
        activity.targetDisplayName
      );
    }

    return copy.memberRemovedActivity(
      activity.actorDisplayName,
      activity.targetDisplayName
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-[1.5rem] border-white/70 bg-white/90">
            <CardContent className="flex items-center gap-4 py-6">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Users className="size-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{copy.currentMembers}</p>
                <p className="text-2xl font-semibold text-slate-950">
                  {members.length}
                </p>
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
                <p className="text-2xl font-semibold text-slate-950">
                  {pendingInvites.length}
                </p>
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
            <CardDescription>{copy.currentMembersDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {transferMessage ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {transferMessage}
              </div>
            ) : null}
            {removeMessage ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {removeMessage}
              </div>
            ) : null}
            {transferError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {transferError}
              </div>
            ) : null}
            {removeError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {removeError}
              </div>
            ) : null}
            <TableToolbar
              searchLabel={copy.searchLabel}
              searchValue={memberSearch}
              onSearchChange={setMemberSearch}
              searchPlaceholder={copy.memberSearchPlaceholder}
              resultLabel={copy.showingMembers(displayedMembers.length)}
              filters={[
                {
                  key: "member-role",
                  label: copy.role,
                  value: memberRoleFilter,
                  onValueChange: (value) =>
                    setMemberRoleFilter(
                      value as "all" | "owner" | "manager" | "member"
                    ),
                  options: [
                    { value: "all", label: copy.allRoles },
                    { value: "owner", label: copy.owner },
                    { value: "manager", label: copy.manager },
                    { value: "member", label: copy.member },
                  ],
                },
                {
                  key: "member-sort",
                  label: copy.sort,
                  value: memberSort,
                  onValueChange: (value) =>
                    setMemberSort(value as "name_asc" | "joined_desc" | "role"),
                  options: [
                    { value: "name_asc", label: copy.sortByName },
                    { value: "joined_desc", label: copy.sortByJoined },
                    { value: "role", label: copy.sortByRole },
                  ],
                },
              ]}
            />

            <TableSurface>
              <Table className="min-w-[880px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[240px]">{memberLabel}</TableHead>
                    <TableHead className="min-w-[220px]">{copy.email}</TableHead>
                    <TableHead className="w-[160px]">{copy.role}</TableHead>
                    <TableHead className="w-[160px]">{memberStatusLabel}</TableHead>
                    <TableHead className="w-[150px]">{copy.joined}</TableHead>
                    <TableHead className="w-[320px] text-right">
                      {copy.action}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedMembers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-10 text-center whitespace-normal text-slate-500"
                      >
                        {copy.noMembersMatch}
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <ProfileAvatar
                              name={member.displayName}
                              avatarUrl={member.avatarUrl}
                              size="sm"
                              className="after:hidden"
                            />
                            <Link
                              href={`/projects/${projectId}/members/${member.id}`}
                              className="font-medium text-slate-950 underline-offset-4 hover:text-teal-700 hover:underline"
                            >
                              {member.displayName}
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {member.email || copy.noEmail}
                        </TableCell>
                        <TableCell>
                          <RoleBadge role={member.role} />
                        </TableCell>
                        <TableCell>
                          <MembershipBadge status={member.membershipStatus} />
                        </TableCell>
                        <TableCell>
                          {formatDateLabel(member.joinedAt, locale)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {liveModeEnabled &&
                            canTransferOwnershipToMember({
                              liveModeEnabled,
                              canTransferOwnership,
                              viewerProjectMemberId,
                              member,
                            }) ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="rounded-full"
                                disabled={transferPending}
                                onClick={() => openTransferDialog(member)}
                              >
                                {copy.transferOwnership}
                              </Button>
                            ) : null}
                            {canRemoveProjectMember({
                              liveModeEnabled,
                              viewerProjectMemberId,
                              viewerRole,
                              member,
                            }) ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-full border-rose-200 text-rose-700 hover:bg-rose-50"
                                disabled={removePending}
                                onClick={() => openRemoveDialog(member)}
                              >
                                <Trash2 className="size-4" />
                                {copy.removeMember}
                              </Button>
                            ) : null}
                            <Link
                              href={`/projects/${projectId}/members/${member.id}`}
                              className={buttonVariants({
                                variant: "outline",
                                size: "sm",
                                className: "rounded-full",
                              })}
                            >
                              {locale === "vi" ? "Xem statement" : "Statement"}
                            </Link>
                            <a
                              href={`/projects/${projectId}/members/${member.id}/export`}
                              download
                              className={buttonVariants({
                                variant: "outline",
                                size: "sm",
                                className: "rounded-full",
                              })}
                            >
                              {locale === "vi" ? "Tải PDF" : "PDF"}
                            </a>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableSurface>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
          <CardHeader>
            <CardTitle>{copy.governanceActivityTitle}</CardTitle>
            <CardDescription>{copy.governanceActivityDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {memberActivity.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
                {copy.noGovernanceActivity}
              </div>
            ) : (
              <div className="space-y-3">
                {memberActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <p className="text-sm font-medium leading-6 text-slate-900">
                      {getGovernanceActivityLabel(activity)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDateLabel(activity.occurredAt, locale)}
                    </p>
                  </div>
                ))}
              </div>
            )}
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
              <p className="mt-2">{copy.emailRestrictedDescription}</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5">
              <p className="font-medium text-teal-100">{copy.reusableInviteTitle}</p>
              <p className="mt-2">{copy.reusableInviteDescription}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
          <CardHeader>
            <CardTitle>{copy.inviteMemberTitle}</CardTitle>
            <CardDescription>{copy.inviteMemberDescription}</CardDescription>
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
                  <p className="text-sm leading-6 text-slate-500">
                    {pendingInviteHelper}
                  </p>
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
                      <div className="rounded-2xl border border-emerald-200 bg-white px-3 py-3 text-xs break-all text-slate-700">
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
          <CardDescription>{copy.pendingInviteLinksDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
              {copy.noInvites}
            </div>
          ) : (
            <div className="space-y-4">
              <TableToolbar
                searchLabel={copy.searchLabel}
                searchValue={inviteSearch}
                onSearchChange={setInviteSearch}
                searchPlaceholder={copy.inviteSearchPlaceholder}
                resultLabel={copy.showingInvites(displayedInvites.length)}
                filters={[
                  {
                    key: "invite-status",
                    label: copy.status,
                    value: inviteStatusFilter,
                    onValueChange: (value) =>
                      setInviteStatusFilter(value as "all" | InviteSummary["status"]),
                    options: [
                      { value: "all", label: copy.allStatuses },
                      { value: "pending", label: locale === "vi" ? "Đang chờ" : "Pending" },
                      { value: "accepted", label: locale === "vi" ? "Đã chấp nhận" : "Accepted" },
                      { value: "revoked", label: locale === "vi" ? "Đã thu hồi" : "Revoked" },
                      { value: "expired", label: locale === "vi" ? "Đã hết hạn" : "Expired" },
                    ],
                  },
                  {
                    key: "invite-sort",
                    label: copy.sort,
                    value: inviteSort,
                    onValueChange: (value) =>
                      setInviteSort(
                        value as "created_desc" | "expires_asc" | "email_asc"
                      ),
                    options: [
                      { value: "created_desc", label: copy.sortByCreated },
                      { value: "expires_asc", label: copy.sortByExpiry },
                      { value: "email_asc", label: copy.sortByEmail },
                    ],
                  },
                ]}
              />

              <TableSurface>
                <Table className="min-w-[1080px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[300px]">{copy.invite}</TableHead>
                      <TableHead className="w-[140px]">{copy.role}</TableHead>
                      <TableHead className="w-[140px]">{copy.status}</TableHead>
                      <TableHead className="w-[150px]">{copy.expires}</TableHead>
                      <TableHead className="w-[150px]">{copy.created}</TableHead>
                      <TableHead className="w-[200px] text-right">{copy.action}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedInvites.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-10 text-center whitespace-normal text-slate-500"
                        >
                          {copy.noInvitesMatch}
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayedInvites.map((invite) => (
                        <TableRow key={invite.id}>
                          <TableCell className="whitespace-normal">
                            <div className="space-y-1">
                              <p className="font-medium text-slate-950">
                                {invite.email || copy.reusableShareLink}
                              </p>
                              <p className="break-all text-xs text-slate-500">
                                {invite.inviteLink}
                              </p>
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
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableSurface>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      <AlertDialog open={transferOpen} onOpenChange={handleTransferOpenChange}>
        <AlertDialogContent className="rounded-[1.6rem] p-0">
          <div className="space-y-5 p-6">
            <AlertDialogHeader className="items-start text-left">
              <AlertDialogTitle>{copy.transferOwnershipTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {transferTarget
                  ? copy.transferOwnershipDescription(transferTarget.displayName)
                  : copy.transferOwnershipUnavailable}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {copy.transferOwnershipWarning}
            </div>
            {transferError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {transferError}
              </div>
            ) : null}
            <AlertDialogFooter className="mx-0 mb-0 rounded-[1.2rem] border-0 bg-transparent p-0">
              <AlertDialogCancel disabled={transferPending}>
                {copy.cancel}
              </AlertDialogCancel>
              <Button
                type="button"
                variant="default"
                disabled={transferPending || !transferTarget}
                onClick={transferOwnership}
              >
                {transferPending
                  ? copy.transferringOwnership
                  : copy.transferOwnershipConfirm}
              </Button>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={removeOpen} onOpenChange={handleRemoveOpenChange}>
        <AlertDialogContent className="rounded-[1.6rem] p-0">
          <div className="space-y-5 p-6">
            <AlertDialogHeader className="items-start text-left">
              <AlertDialogTitle>{copy.removeMemberTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {removeTarget
                  ? copy.removeMemberDescription(removeTarget.displayName)
                  : copy.removeMemberUnavailable}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {copy.removeMemberWarning}
            </div>
            {removeError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {removeError}
              </div>
            ) : null}
            <AlertDialogFooter className="mx-0 mb-0 rounded-[1.2rem] border-0 bg-transparent p-0">
              <AlertDialogCancel disabled={removePending}>
                {copy.cancel}
              </AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                disabled={removePending || !removeTarget}
                onClick={removeMember}
              >
                {removePending ? copy.removingMember : copy.removeMemberConfirm}
              </Button>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
