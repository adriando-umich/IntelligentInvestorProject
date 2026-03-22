"use client";

import { useActionState } from "react";
import { ArrowRight, UserCheck } from "lucide-react";

import {
  acceptProjectInviteAction,
  type ProjectInviteActionState,
} from "@/app/actions/project-invites";
import { useLocale } from "@/components/app/locale-provider";
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
  const { locale } = useLocale();
  const [state, formAction, pending] = useActionState(
    acceptProjectInviteAction,
    initialState
  );

  const disabled = status !== "pending";
  const roleLabel =
    role === "manager"
      ? locale === "vi"
        ? "quản lý"
        : "manager"
      : locale === "vi"
        ? "thành viên"
        : "member";
  const statusLabel =
    locale === "vi"
      ? status === "accepted"
        ? "đã chấp nhận"
        : status === "revoked"
          ? "đã thu hồi"
          : status === "expired"
            ? "đã hết hạn"
            : "đang chờ"
      : status;

  return (
    <Card className="rounded-[1.75rem] border-white/70 bg-white/90 shadow-[0_24px_80px_-45px_rgba(15,23,42,0.35)]">
      <CardHeader>
        <CardTitle>
          {locale === "vi" ? `Tham gia ${projectName}` : `Join ${projectName}`}
        </CardTitle>
        <CardDescription>
          {invitedEmail
            ? locale === "vi"
              ? `Lời mời này chỉ dành cho ${invitedEmail}.`
              : `This invite is reserved for ${invitedEmail}.`
            : locale === "vi"
              ? "Đây là link mời dùng lại được. Bất kỳ đồng đội nào đã đăng nhập và có link đều có thể chấp nhận."
              : "This is a reusable project invite link. Any signed-in teammate with the link can accept it."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-5 text-sm leading-6 text-slate-700">
          <p>
            {locale === "vi" ? "Bạn sẽ tham gia dự án này với vai trò " : "You will join this project as "}
            <span className="font-medium">{roleLabel}</span>.
          </p>
          <p className="mt-2">
            {locale === "vi"
              ? "Sau khi chấp nhận, bạn sẽ được chuyển vào workspace live và có thể bắt đầu ghi nhận hoạt động của dự án theo đúng quyền đó."
              : "After accepting, you will be redirected into the live workspace and can start recording project activity based on that role."}
          </p>
        </div>

        {state.status === "error" ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {state.message}
          </div>
        ) : null}

        {status !== "pending" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {locale === "vi"
              ? `Lời mời này hiện đang ở trạng thái ${statusLabel}. Nếu bạn vẫn cần quyền truy cập, hãy xin manager một link mới.`
              : `This invite is currently ${statusLabel}. Ask a project manager for a fresh link if you still need access.`}
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
            {pending
              ? locale === "vi"
                ? "Đang tham gia dự án..."
                : "Joining project..."
              : locale === "vi"
                ? "Chấp nhận lời mời"
                : "Accept invite"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
