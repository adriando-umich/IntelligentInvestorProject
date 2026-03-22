"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, ClipboardCheck, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  acceptReconciliationCheckAction,
  closeReconciliationRunAction,
  openReconciliationRunAction,
  postReconciliationAdjustmentAction,
  submitReconciliationCheckAction,
  type ReconciliationActionState,
} from "@/app/actions/reconciliation";
import { useLocale } from "@/components/app/locale-provider";
import { MetricCard } from "@/components/finance/metric-card";
import { ProjectReconciliationTable } from "@/components/finance/project-reconciliation-table";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import {
  getReconciliationStatusLabel,
  type MemberRole,
  type ProjectSnapshot,
  type ReconciliationCheckView,
} from "@/lib/finance/types";
import { formatDateLabel, formatSignedCurrency } from "@/lib/format";

function statusTone(status: string) {
  if (status === "matched") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (status === "variance_found") {
    return "bg-rose-100 text-rose-800";
  }
  if (status === "pending") {
    return "bg-amber-100 text-amber-800";
  }
  if (status === "accepted") {
    return "bg-sky-100 text-sky-800";
  }
  return "bg-slate-100 text-slate-700";
}

type WorkflowProps = {
  snapshot: ProjectSnapshot;
  viewerProjectMemberId?: string | null;
  viewerRole?: MemberRole | null;
  liveModeEnabled: boolean;
};

type OwnCheckCardProps = {
  viewerCheck: ReconciliationCheckView;
  currencyCode: string;
  locale: "en" | "vi";
  liveModeEnabled: boolean;
  isPending: boolean;
  copy: {
    yourCheckTitle: string;
    yourCheckDescription: string;
    expectedCash: string;
    yourReportedCash: string;
    yourStatus: string;
    yourNote: string;
    yourNotePlaceholder: string;
    submitCheck: string;
    updateCheck: string;
    memberReported: string;
  };
  onSubmit: (reportedProjectCash: string, memberNote: string) => void;
};

const idleState: ReconciliationActionState = { status: "idle" };

function OwnCheckCard({
  viewerCheck,
  currencyCode,
  locale,
  liveModeEnabled,
  isPending,
  copy,
  onSubmit,
}: OwnCheckCardProps) {
  const [reportedProjectCash, setReportedProjectCash] = useState(
    viewerCheck.check.reportedProjectCash?.toString() ??
      viewerCheck.check.expectedProjectCash.toString()
  );
  const [memberNote, setMemberNote] = useState(viewerCheck.check.memberNote ?? "");

  return (
    <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
      <CardHeader>
        <CardTitle>{copy.yourCheckTitle}</CardTitle>
        <CardDescription>{copy.yourCheckDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm text-slate-500">{copy.expectedCash}</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {formatSignedCurrency(
                viewerCheck.check.expectedProjectCash,
                currencyCode,
                locale
              )}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm text-slate-500">{copy.yourStatus}</p>
            <div className="mt-2">
              <Badge className={statusTone(viewerCheck.check.status)}>
                {getReconciliationStatusLabel(viewerCheck.check.status, locale)}
              </Badge>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm text-slate-500">{copy.memberReported}</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {viewerCheck.check.reportedProjectCash == null
                ? locale === "vi"
                  ? "Chưa gửi"
                  : "Not submitted yet"
                : formatSignedCurrency(
                    viewerCheck.check.reportedProjectCash,
                    currencyCode,
                    locale
                  )}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            <Label>{copy.yourReportedCash}</Label>
            <Input
              type="number"
              step="0.01"
              value={reportedProjectCash}
              onChange={(event) => setReportedProjectCash(event.target.value)}
              disabled={!liveModeEnabled || isPending}
            />
          </div>
          <div className="space-y-2">
            <Label>{copy.yourNote}</Label>
            <Textarea
              value={memberNote}
              onChange={(event) => setMemberNote(event.target.value)}
              placeholder={copy.yourNotePlaceholder}
              disabled={!liveModeEnabled || isPending}
            />
          </div>
        </div>

        <Button
          type="button"
          onClick={() => onSubmit(reportedProjectCash, memberNote)}
          disabled={!liveModeEnabled || isPending}
        >
          {viewerCheck.check.submittedAt ? copy.updateCheck : copy.submitCheck}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ProjectReconciliationWorkflow({
  snapshot,
  viewerProjectMemberId,
  viewerRole,
  liveModeEnabled,
}: WorkflowProps) {
  const { locale } = useLocale();
  const router = useRouter();
  const [actionState, setActionState] = useState<ReconciliationActionState>(idleState);
  const [isPending, startTransition] = useTransition();
  const [openAsOf, setOpenAsOf] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [openNote, setOpenNote] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const run = snapshot.openReconciliation;
  const viewerCheck =
    run?.checks.find((item) => item.member.id === viewerProjectMemberId) ?? null;
  const canManage = viewerRole === "owner" || viewerRole === "manager";
  const unresolvedCount = useMemo(
    () =>
      run?.checks.filter(
        (item) =>
          item.check.status === "pending" || item.check.status === "variance_found"
      ).length ?? 0,
    [run]
  );
  const varianceChecks = useMemo(
    () =>
      run?.checks.filter((item) => item.check.status === "variance_found") ?? [],
    [run]
  );
  const pendingChecks = useMemo(
    () =>
      run?.checks.filter((item) => item.check.status === "pending") ?? [],
    [run]
  );

  const copy =
    locale === "vi"
      ? {
          flowTitle: "Luồng đối chiếu hoạt động như thế nào",
          flowDescription:
            "Đối chiếu giúp team xác nhận số tiền dự án thực tế đang nằm trong tài khoản hoặc tiền mặt của từng người, rồi xử lý rõ ràng mọi chênh lệch trước khi đóng kỳ.",
          flowSteps: [
            "1. Quản lý mở một đợt đối chiếu với ngày chốt cụ thể.",
            "2. Mỗi thành viên nhập số tiền dự án thực tế mình đang giữ. Nếu đã ứng tiền cá nhân cho dự án, có thể nhập số âm.",
            "3. Nếu lệch, quản lý hoặc chấp nhận giải thích, hoặc post adjustment để sửa ledger.",
            "4. Khi không còn dòng pending hay variance chưa xử lý, quản lý đóng đợt đối chiếu.",
          ],
          matched: "Khớp",
          pending: "Đang chờ",
          variance: "Có chênh lệch",
          openRunTitle: "Mở đợt đối chiếu mới",
          openRunDescription:
            "Hãy chụp lại expected project cash của từng thành viên tại một ngày chốt. Sau đó mọi người sẽ tự xác nhận số tiền họ thực sự đang giữ.",
          asOfDate: "Ngày chốt",
          openNoteLabel: "Ghi chú cho đợt đối chiếu (không bắt buộc)",
          openNotePlaceholder:
            "Ví dụ: Chốt sau đợt nhận cọc đầu tiên và trước khi thanh toán nhà thầu.",
          openRunButton: "Mở đợt đối chiếu",
          waitingTitle: "Chưa có đợt đối chiếu đang mở",
          waitingDescription:
            "Khi owner hoặc manager mở một đợt đối chiếu, bạn sẽ thấy dòng của mình để xác nhận số tiền dự án thực tế đang giữ.",
          demoDisabled:
            "Workspace mẫu chỉ để xem flow. Muốn chạy reconciliation thật, hãy vào project live.",
          yourCheckTitle: "Xác nhận số tiền dự án bạn đang giữ",
          yourCheckDescription:
            "Nhập số tiền dự án thực tế đang nằm trong tài khoản hoặc tiền mặt của bạn lúc này. Nếu bạn đang ứng tiền riêng cho dự án, có thể nhập số âm.",
          expectedCash: "Theo hệ thống",
          yourReportedCash: "Bạn đang giữ thực tế",
          yourStatus: "Trạng thái hiện tại",
          yourNote: "Ghi chú của bạn",
          yourNotePlaceholder:
            "Giải thích ngắn nếu có chênh lệch, ví dụ vừa ứng thêm tiền hoặc chưa kịp ghi giao dịch.",
          submitCheck: "Gửi số liệu của tôi",
          updateCheck: "Cập nhật số liệu của tôi",
          unresolvedTitle: "Quản lý xử lý chênh lệch",
          unresolvedDescription:
            "Các dòng dưới đây đã được member báo số liệu nhưng vẫn lệch với ledger hiện tại. Quản lý cần chấp nhận giải thích hoặc post adjustment.",
          pendingMembersTitle: "Các thành viên chưa gửi số liệu",
          pendingMembersDescription:
            "Những người này vẫn chưa xác nhận số tiền dự án họ đang giữ. Bạn có thể nhắc họ vào gửi trước khi đóng đợt đối chiếu.",
          noPendingMembers: "Hiện không còn thành viên nào đang pending.",
          reviewNote: "Ghi chú review",
          reviewNotePlaceholder:
            "Ví dụ: Chấp nhận vì member vừa tạm ứng tiền cá nhân và sẽ hạch toán vào cuối ngày.",
          memberReported: "Member báo cáo",
          memberNoteLabel: "Ghi chú member",
          noMemberNote: "Member chưa để lại ghi chú.",
          acceptVariance: "Chấp nhận chênh lệch",
          postAdjustment: "Post adjustment",
          closeRunTitle: "Đóng đợt đối chiếu",
          closeRunDescription:
            "Chỉ nên đóng khi mọi dòng đã ở trạng thái matched, accepted hoặc adjustment posted.",
          unresolvedCountLabel: "Dòng còn phải xử lý",
          closeNoteLabel: "Ghi chú đóng kỳ (không bắt buộc)",
          closeNotePlaceholder:
            "Ví dụ: Đã xử lý xong tất cả chênh lệch của kỳ đối chiếu ngày 22/03.",
          closeRunButton: "Đóng đợt đối chiếu",
          closeBlocked:
            "Hãy xử lý hết các dòng pending hoặc variance trước khi đóng.",
          noRunYet:
            "Chưa có đợt đối chiếu nào đang mở cho dự án này.",
          openedAt: "Mở lúc",
          cutoffAt: "Ngày chốt",
          actionFeedbackError: "Không thể hoàn tất thao tác này.",
          openRunWaiting: "Đây là kỳ đối chiếu hiện tại mà team đang xử lý.",
          tableTitle: "Toàn bộ các dòng đối chiếu",
          tableDescription:
            "Bạn có thể tìm nhanh theo thành viên, trạng thái hoặc ghi chú để rà soát toàn bộ đợt đối chiếu.",
          noVarianceManager:
            "Hiện không còn dòng variance nào cần manager xử lý.",
        }
      : {
          flowTitle: "How reconciliation works",
          flowDescription:
            "Reconciliation helps the team confirm how much project cash is actually sitting with each person, then resolve any mismatch clearly before closing the run.",
          flowSteps: [
            "1. A manager opens a reconciliation run with a specific cutoff date.",
            "2. Each member reports the actual net project cash they are holding. Negative is allowed if they fronted personal money for the project.",
            "3. If there is a mismatch, a manager either accepts the explanation or posts an adjustment to the ledger.",
            "4. Once there are no pending or unresolved variance rows left, the manager closes the run.",
          ],
          matched: "Matched",
          pending: "Pending",
          variance: "Variance found",
          openRunTitle: "Open a new reconciliation run",
          openRunDescription:
            "Take a snapshot of each member's expected project cash at one cutoff date, then let the team confirm what they actually hold.",
          asOfDate: "Cutoff date",
          openNoteLabel: "Run note (optional)",
          openNotePlaceholder:
            "Example: Check balances after the first buyer deposit and before contractor payout.",
          openRunButton: "Open reconciliation run",
          waitingTitle: "No open reconciliation run yet",
          waitingDescription:
            "Once an owner or manager opens a run, you will see your own check here and can confirm the project cash you actually hold.",
          demoDisabled:
            "The sample workspace is view-only. Use a live project to run real reconciliation.",
          yourCheckTitle: "Confirm the project cash you actually hold",
          yourCheckDescription:
            "Enter the real project cash currently sitting in your bank or cash. If you have fronted your own money for the project, you can enter a negative number.",
          expectedCash: "Expected by the app",
          yourReportedCash: "What you actually hold",
          yourStatus: "Current status",
          yourNote: "Your note",
          yourNotePlaceholder:
            "Optional short explanation, for example you fronted extra money or one transaction has not been recorded yet.",
          submitCheck: "Submit my check",
          updateCheck: "Update my check",
          unresolvedTitle: "Manager review for variance rows",
          unresolvedDescription:
            "These members already submitted their numbers, but they still differ from the current ledger. A manager now needs to accept the explanation or post an adjustment.",
          pendingMembersTitle: "Members still waiting to report",
          pendingMembersDescription:
            "These people have not submitted their project-cash check yet. Remind them before you try to close the run.",
          noPendingMembers: "No members are still pending.",
          reviewNote: "Review note",
          reviewNotePlaceholder:
            "Example: Accepted because the member fronted cash and the ledger will be updated later today.",
          memberReported: "Member reported",
          memberNoteLabel: "Member note",
          noMemberNote: "No member note yet.",
          acceptVariance: "Accept explanation",
          postAdjustment: "Post adjustment",
          closeRunTitle: "Close this reconciliation run",
          closeRunDescription:
            "Close only after every row is matched, accepted, or adjusted.",
          unresolvedCountLabel: "Rows still unresolved",
          closeNoteLabel: "Closing note (optional)",
          closeNotePlaceholder:
            "Example: All March 22 reconciliation differences were resolved.",
          closeRunButton: "Close reconciliation run",
          closeBlocked:
            "Resolve every pending or variance row before closing the run.",
          noRunYet: "This project has no open reconciliation run right now.",
          openedAt: "Opened",
          cutoffAt: "Cutoff",
          actionFeedbackError: "Unable to complete this action.",
          openRunWaiting: "This is the reconciliation run the team is currently working through.",
          tableTitle: "All reconciliation rows",
          tableDescription:
            "Search by member, status, or notes to review the entire reconciliation run.",
          noVarianceManager:
            "There are no variance rows waiting for manager review.",
        };

  async function runAction(
    action: Promise<ReconciliationActionState>,
    onSuccess?: () => void
  ) {
    const result = await action;
    setActionState(result);

    if (result.status === "success") {
      onSuccess?.();
      router.refresh();
    }
  }

  function handleOpenRun() {
    startTransition(async () => {
      await runAction(
        openReconciliationRunAction({
          projectId: snapshot.dataset.project.id,
          asOf: openAsOf,
          note: openNote,
        }),
        () => {
          setOpenNote("");
        }
      );
    });
  }

  function handleSubmitOwnCheck(
    nextReportedProjectCash: string,
    nextMemberNote: string
  ) {
    startTransition(async () => {
      await runAction(
        submitReconciliationCheckAction({
          projectId: snapshot.dataset.project.id,
          checkId: viewerCheck?.check.id ?? "",
          reportedProjectCash:
            nextReportedProjectCash.trim() === ""
              ? Number.NaN
              : Number(nextReportedProjectCash),
          memberNote: nextMemberNote,
        })
      );
    });
  }

  function handleAccept(check: ReconciliationCheckView) {
    startTransition(async () => {
      await runAction(
        acceptReconciliationCheckAction({
          projectId: snapshot.dataset.project.id,
          checkId: check.check.id,
          reviewNote: reviewNotes[check.check.id],
        })
      );
    });
  }

  function handlePostAdjustment(check: ReconciliationCheckView) {
    startTransition(async () => {
      await runAction(
        postReconciliationAdjustmentAction({
          projectId: snapshot.dataset.project.id,
          checkId: check.check.id,
          reviewNote: reviewNotes[check.check.id],
        })
      );
    });
  }

  function handleCloseRun() {
    startTransition(async () => {
      await runAction(
        closeReconciliationRunAction({
          projectId: snapshot.dataset.project.id,
          runId: run?.run.id ?? "",
          note: closeNote,
        })
      );
    });
  }

  return (
    <div className="space-y-6">
      {actionState.status !== "idle" ? (
        <div
          className={
            actionState.status === "success"
              ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          }
        >
          {actionState.message ?? copy.actionFeedbackError}
        </div>
      ) : null}

      <Card className="rounded-[1.75rem] border-white/70 bg-[linear-gradient(135deg,rgba(240,253,250,0.98),rgba(255,255,255,0.96))]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-teal-700" />
            {copy.flowTitle}
          </CardTitle>
          <CardDescription>{copy.flowDescription}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {copy.flowSteps.map((step) => (
            <div
              key={step}
              className="rounded-2xl border border-teal-100 bg-white/90 px-4 py-4 text-sm leading-6 text-slate-700"
            >
              {step}
            </div>
          ))}
        </CardContent>
      </Card>

      {run ? (
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            title={copy.matched}
            value={`${run.matchedCount}`}
            description={
              locale === "vi"
                ? "Các dòng đã khớp với ledger."
                : "Rows already matched against the ledger."
            }
            tone="teal"
            icon={<CheckCircle2 className="size-5" />}
          />
          <MetricCard
            title={copy.pending}
            value={`${run.pendingCount}`}
            description={
              locale === "vi"
                ? "Thành viên chưa gửi số liệu đối chiếu."
                : "Members who have not submitted their check yet."
            }
            tone="amber"
            icon={<ClipboardCheck className="size-5" />}
          />
          <MetricCard
            title={copy.variance}
            value={`${run.varianceCount}`}
            description={
              locale === "vi"
                ? "Các dòng đang lệch và cần manager xử lý."
                : "Rows that still differ and need manager review."
            }
            tone="red"
            icon={<ShieldCheck className="size-5" />}
          />
        </div>
      ) : null}

      {!run ? (
        canManage ? (
          <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
            <CardHeader>
              <CardTitle>{copy.openRunTitle}</CardTitle>
              <CardDescription>{copy.openRunDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!liveModeEnabled ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {copy.demoDisabled}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <div className="space-y-2">
                  <Label>{copy.asOfDate}</Label>
                  <Input
                    type="date"
                    value={openAsOf}
                    onChange={(event) => setOpenAsOf(event.target.value)}
                    disabled={!liveModeEnabled || isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{copy.openNoteLabel}</Label>
                  <Textarea
                    value={openNote}
                    onChange={(event) => setOpenNote(event.target.value)}
                    placeholder={copy.openNotePlaceholder}
                    disabled={!liveModeEnabled || isPending}
                  />
                </div>
              </div>

              <Button
                type="button"
                onClick={handleOpenRun}
                disabled={!liveModeEnabled || isPending}
              >
                {copy.openRunButton}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
            <CardHeader>
              <CardTitle>{copy.waitingTitle}</CardTitle>
              <CardDescription>{copy.waitingDescription}</CardDescription>
            </CardHeader>
            {!liveModeEnabled ? (
              <CardContent>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {copy.demoDisabled}
                </div>
              </CardContent>
            ) : null}
          </Card>
        )
      ) : (
        <>
          <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
            <CardHeader>
              <CardTitle>
                {locale === "vi" ? "Thông tin đợt đang mở" : "Open run details"}
              </CardTitle>
              <CardDescription>{copy.openRunWaiting}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {copy.openedAt}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {formatDateLabel(run.run.openedAt, locale)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {copy.cutoffAt}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {formatDateLabel(run.run.asOf, locale)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {copy.unresolvedCountLabel}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {unresolvedCount}
                </p>
              </div>
            </CardContent>
          </Card>

          {viewerCheck ? (
            <OwnCheckCard
              key={`${viewerCheck.check.id}-${viewerCheck.check.reportedProjectCash ?? "pending"}-${viewerCheck.check.memberNote ?? ""}`}
              viewerCheck={viewerCheck}
              currencyCode={snapshot.dataset.project.currencyCode}
              locale={locale}
              liveModeEnabled={liveModeEnabled}
              isPending={isPending}
              copy={{
                yourCheckTitle: copy.yourCheckTitle,
                yourCheckDescription: copy.yourCheckDescription,
                expectedCash: copy.expectedCash,
                yourReportedCash: copy.yourReportedCash,
                yourStatus: copy.yourStatus,
                yourNote: copy.yourNote,
                yourNotePlaceholder: copy.yourNotePlaceholder,
                submitCheck: copy.submitCheck,
                updateCheck: copy.updateCheck,
                memberReported: copy.memberReported,
              }}
              onSubmit={handleSubmitOwnCheck}
            />
          ) : null}

          {canManage ? (
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
                <CardHeader>
                  <CardTitle>{copy.unresolvedTitle}</CardTitle>
                  <CardDescription>{copy.unresolvedDescription}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {varianceChecks.length === 0 ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                      {copy.noVarianceManager}
                    </div>
                  ) : (
                    varianceChecks.map((item) => (
                      <div
                        key={item.check.id}
                        className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-950">
                              {item.profile.displayName}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-600">
                              <span>
                                {copy.expectedCash}:{" "}
                                {formatSignedCurrency(
                                  item.check.expectedProjectCash,
                                  snapshot.dataset.project.currencyCode,
                                  locale
                                )}
                              </span>
                              <span>
                                {copy.memberReported}:{" "}
                                {formatSignedCurrency(
                                  item.check.reportedProjectCash ?? 0,
                                  snapshot.dataset.project.currencyCode,
                                  locale
                                )}
                              </span>
                              <span className="font-medium text-rose-700">
                                {locale === "vi" ? "Lệch" : "Variance"}:{" "}
                                {formatSignedCurrency(
                                  item.check.varianceAmount ?? 0,
                                  snapshot.dataset.project.currencyCode,
                                  locale
                                )}
                              </span>
                            </div>
                          </div>
                          <Badge className={statusTone(item.check.status)}>
                            {getReconciliationStatusLabel(item.check.status, locale)}
                          </Badge>
                        </div>

                        <div className="rounded-2xl border border-white bg-white px-4 py-3 text-sm text-slate-600">
                          <p className="font-medium text-slate-900">
                            {copy.memberNoteLabel}
                          </p>
                          <p className="mt-2">
                            {item.check.memberNote ?? copy.noMemberNote}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>{copy.reviewNote}</Label>
                          <Textarea
                            value={reviewNotes[item.check.id] ?? ""}
                            onChange={(event) =>
                              setReviewNotes((current) => ({
                                ...current,
                                [item.check.id]: event.target.value,
                              }))
                            }
                            placeholder={copy.reviewNotePlaceholder}
                            disabled={!liveModeEnabled || isPending}
                          />
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleAccept(item)}
                            disabled={!liveModeEnabled || isPending}
                          >
                            {copy.acceptVariance}
                          </Button>
                          <Button
                            type="button"
                            onClick={() => handlePostAdjustment(item)}
                            disabled={!liveModeEnabled || isPending}
                          >
                            {copy.postAdjustment}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
                  <CardHeader>
                    <CardTitle>{copy.pendingMembersTitle}</CardTitle>
                    <CardDescription>{copy.pendingMembersDescription}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {pendingChecks.length === 0 ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                        {copy.noPendingMembers}
                      </div>
                    ) : (
                      pendingChecks.map((item) => (
                        <div
                          key={item.check.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                        >
                          <p className="font-medium text-slate-950">
                            {item.profile.displayName}
                          </p>
                          <p className="mt-2 text-sm text-slate-600">
                            {formatSignedCurrency(
                              item.check.expectedProjectCash,
                              snapshot.dataset.project.currencyCode,
                              locale
                            )}
                          </p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
                  <CardHeader>
                    <CardTitle>{copy.closeRunTitle}</CardTitle>
                    <CardDescription>{copy.closeRunDescription}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-sm text-slate-500">{copy.unresolvedCountLabel}</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">
                        {unresolvedCount}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>{copy.closeNoteLabel}</Label>
                      <Textarea
                        value={closeNote}
                        onChange={(event) => setCloseNote(event.target.value)}
                        placeholder={copy.closeNotePlaceholder}
                        disabled={!liveModeEnabled || isPending}
                      />
                    </div>

                    {unresolvedCount > 0 ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {copy.closeBlocked}
                      </div>
                    ) : null}

                    <Button
                      type="button"
                      onClick={handleCloseRun}
                      disabled={!liveModeEnabled || isPending || unresolvedCount > 0}
                    >
                      {copy.closeRunButton}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}

          <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
            <CardHeader>
              <CardTitle>{copy.tableTitle}</CardTitle>
              <CardDescription>{copy.tableDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectReconciliationTable snapshot={snapshot} />
            </CardContent>
          </Card>
        </>
      )}

    </div>
  );
}
