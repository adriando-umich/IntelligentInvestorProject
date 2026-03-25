"use client";

import { useMemo, useRef, useState, useTransition } from "react";
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
import {
  ProjectReconciliationTable,
  type ReconciliationStatusFilter,
} from "@/components/finance/project-reconciliation-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  formatCurrency,
  formatDateLabel,
  formatSignedCurrency,
} from "@/lib/format";

function statusTone(status: string) {
  if (status === "matched") return "bg-emerald-100 text-emerald-800";
  if (status === "variance_found") return "bg-rose-100 text-rose-800";
  if (status === "pending") return "bg-amber-100 text-amber-800";
  if (status === "accepted") return "bg-sky-100 text-sky-800";
  return "bg-slate-100 text-slate-700";
}

type WorkflowProps = {
  snapshot: ProjectSnapshot;
  viewerProjectMemberId?: string | null;
  viewerRole?: MemberRole | null;
  liveModeEnabled: boolean;
};

type Copy = ReturnType<typeof getCopy>;

type OwnCheckCardProps = {
  viewerCheck: ReconciliationCheckView;
  currencyCode: string;
  locale: "en" | "vi";
  liveModeEnabled: boolean;
  isPending: boolean;
  submittedByLabel: string;
  copy: Copy;
  onSubmit: (reportedProjectCash: string, memberNote: string) => void;
};

const idleState: ReconciliationActionState = { status: "idle" };

function getCopy(locale: "en" | "vi") {
  if (locale === "vi") {
    return {
      flowTitle: "Quy trinh doi chieu",
      flowDescription:
        "Doi chieu giup team xac nhan so tien du an dang nam voi tung nguoi, roi giai quyet ro rang moi chenh lech truoc khi dong ky.",
      flowSteps: [
        "1. Manager mo mot reconciliation run voi ngay chot cu the.",
        "2. Moi thanh vien xac nhan so tien du an thuc te ho dang giu. So am duoc phep neu ho da ung tien rieng cho du an.",
        "3. Neu co chenh lech, manager co the chap nhan giai thich hoac post adjustment vao ledger.",
        "4. Khi khong con dong pending hay variance chua xu ly, manager dong run.",
      ],
      matched: "Khop",
      pending: "Dang cho",
      variance: "Co chenh lech",
      openRunTitle: "Mo reconciliation run moi",
      openRunDescription:
        "Chup lai expected project cash cua tung thanh vien tai mot ngay chot, sau do de moi nguoi xac nhan so tien ho thuc su dang giu.",
      asOfDate: "Ngay chot",
      openNoteLabel: "Ghi chu run (khong bat buoc)",
      openNotePlaceholder:
        "Vi du: Chot sau dot nhan coc dau tien va truoc khi thanh toan nha thau.",
      openRunButton: "Mo reconciliation run",
      waitingTitle: "Chua co reconciliation run dang mo",
      waitingDescription:
        "Khi owner hoac manager mo run, ban se thay dong cua minh de xac nhan so tien du an dang giu.",
      demoDisabled: "Workspace mau chi de xem flow. Hay vao project live de chay reconciliation that.",
      yourCheckTitle: "Xac nhan so tien du an ban dang giu",
      yourCheckDescription:
        "Nhap so tien du an thuc te dang nam trong tai khoan hoac tien mat cua ban. Neu ban dang ung tien rieng cho du an, co the nhap so am.",
      expectedCash: "Theo he thong",
      yourReportedCash: "Ban dang giu thuc te",
      yourStatus: "Trang thai hien tai",
      submittedBy: "Nguoi gui",
      yourNote: "Ghi chu cua ban",
      yourNotePlaceholder:
        "Giai thich ngan neu co chenh lech, vi du vua ung them tien hoac chua kip ghi giao dich.",
      submitCheck: "Gui so lieu cua toi",
      updateCheck: "Cap nhat so lieu cua toi",
      memberReported: "Member bao cao",
      unresolvedTitle: "Manager review cho variance rows",
      unresolvedDescription:
        "Cac dong nay da duoc member bao so nhung van lech voi ledger hien tai. Manager can chap nhan giai thich hoac post adjustment.",
      pendingMembersTitle: "Members still waiting to report",
      pendingMembersDescription:
        "Nhung nguoi nay van chua xac nhan so tien du an ho dang giu. Ban co the nhac ho hoac gui ho de dong reconciliation nhanh hon.",
      noPendingMembers: "Khong con thanh vien nao dang pending.",
      resolvePending: "Giai quyet",
      resolvePendingTitle: "Nhap so cho thanh vien nay",
      resolvePendingDescription:
        "Owner hoac manager co the gui check ho cho thanh vien sau khi xac nhan so tien thuc te ho dang giu.",
      resolveReportedCash: "So tien du an thuc te",
      resolveMemberNote: "Ghi chu gui ho",
      resolveMemberNotePlaceholder:
        "Vi du: Da xac nhan qua dien thoai va manager gui ho de dong ky doi chieu.",
      submitForMember: "Gui ho thanh vien",
      cancelResolve: "Huy",
      reviewNote: "Ghi chu review",
      reviewNotePlaceholder:
        "Vi du: Chap nhan vi member vua tam ung tien ca nhan va se hach toan vao cuoi ngay.",
      memberNoteLabel: "Ghi chu member",
      noMemberNote: "Member chua de lai ghi chu.",
      acceptVariance: "Chap nhan giai thich",
      postAdjustment: "Post adjustment",
      closeRunTitle: "Dong reconciliation run",
      closeRunDescription:
        "Chi nen dong khi moi dong da o trang thai matched, accepted, hoac adjustment posted.",
      unresolvedCountLabel: "Dong con phai xu ly",
      closeNoteLabel: "Ghi chu dong run (khong bat buoc)",
      closeNotePlaceholder:
        "Vi du: Tat ca chenh lech ngay 24/03 da duoc xu ly xong.",
      closeRunButton: "Dong reconciliation run",
      closeBlocked: "Hay xu ly het cac dong pending hoac variance truoc khi dong.",
      noRunYet: "Project nay hien khong co reconciliation run dang mo.",
      openedAt: "Mo luc",
      cutoffAt: "Ngay chot",
      actionFeedbackError: "Khong the hoan tat thao tac nay.",
      openRunWaiting: "Day la reconciliation run ma team dang lam viec.",
      tableTitle: "Tat ca cac dong doi chieu",
      tableDescription:
        "Tim nhanh theo member, trang thai, hoac ghi chu de ra soat toan bo reconciliation run.",
      noVarianceManager: "Khong con variance row nao dang cho manager review.",
      projectAccountingTitle: "Kiem tra tong tien cap project",
      projectAccountingDescription:
        "Tong so team bao dang giu duoc doi chieu voi nen ke toan hien tai cua project.",
      expectedTotalProjectCash: "Tong tien project theo ke toan",
      reportedTotalProjectCash: "Team bao dang giu",
      differenceAmount: "So lech con lai",
      capitalComponent: "Von con trong project",
      sharedLoanComponent: "Goc vay chung con lai",
      profitComponent: "Loi nhuan chua chia",
      reportingCoverage: (submitted: number, total: number) =>
        `${submitted}/${total} thanh vien da gui reconciliation check.`,
      provisionalDifference:
        "Tong team bao dang giu van tam tinh cho den khi moi thanh vien gui check.",
      differenceResolved:
        "Tong tien team bao da khop voi nen ke toan cua project tai ngay chot nay.",
      differenceNeedsReview:
        "Tong tien team bao dang giu dang lech voi nen ke toan cua project.",
      acceptDifferenceLabel:
        "Dong run nay va chap nhan so lech tong cap project con lai",
      acceptDifferenceHelp:
        "Manager hoac owner co the dong run khi van con so lech, nhung phai xac nhan va ghi ro ly do.",
    };
  }

  return {
    flowTitle: "How reconciliation works",
    flowDescription:
      "Reconciliation helps the team confirm how much project cash is actually sitting with each person, then resolve any mismatch before closing the run.",
    flowSteps: [
      "1. A manager opens a reconciliation run with one cutoff date.",
      "2. Each member confirms the net project cash they are actually holding. Negative is allowed if they fronted personal money.",
      "3. If there is a mismatch, a manager accepts the explanation or posts an adjustment to the ledger.",
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
    demoDisabled: "The sample workspace is view-only. Use a live project to run real reconciliation.",
    yourCheckTitle: "Confirm the project cash you actually hold",
    yourCheckDescription:
      "Enter the real project cash currently sitting in your bank or cash. If you have fronted your own money for the project, you can enter a negative number.",
    expectedCash: "Expected by the app",
    yourReportedCash: "What you actually hold",
    yourStatus: "Current status",
    submittedBy: "Submitted by",
    yourNote: "Your note",
    yourNotePlaceholder:
      "Optional short explanation, for example you fronted extra money or one transaction has not been recorded yet.",
    submitCheck: "Submit my check",
    updateCheck: "Update my check",
    memberReported: "Member reported",
    unresolvedTitle: "Manager review for variance rows",
    unresolvedDescription:
      "These members already submitted their numbers, but they still differ from the current ledger. A manager now needs to accept the explanation or post an adjustment.",
    pendingMembersTitle: "Members still waiting to report",
    pendingMembersDescription:
      "These people have not submitted their project-cash check yet. You can remind them or resolve the row on their behalf.",
    noPendingMembers: "No members are still pending.",
    resolvePending: "Resolve",
    resolvePendingTitle: "Submit a check on behalf of this member",
    resolvePendingDescription:
      "An owner or manager can resolve a waiting row by entering the member's confirmed project cash and a short note.",
    resolveReportedCash: "Reported project cash",
    resolveMemberNote: "Submission note",
    resolveMemberNotePlaceholder:
      "Example: Confirmed by phone and submitted on behalf of the member before closing the run.",
    submitForMember: "Submit for member",
    cancelResolve: "Cancel",
    reviewNote: "Review note",
    reviewNotePlaceholder:
      "Example: Accepted because the member fronted cash and the ledger will be updated later today.",
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
      "Example: All March 24 reconciliation differences were resolved.",
    closeRunButton: "Close reconciliation run",
    closeBlocked: "Resolve every pending or variance row before closing the run.",
    noRunYet: "This project has no open reconciliation run right now.",
    openedAt: "Opened",
    cutoffAt: "Cutoff",
    actionFeedbackError: "Unable to complete this action.",
    openRunWaiting: "This is the reconciliation run the team is currently working through.",
    tableTitle: "All reconciliation rows",
    tableDescription:
      "Search by member, status, or notes to review the entire reconciliation run.",
    noVarianceManager: "There are no variance rows waiting for manager review.",
    projectAccountingTitle: "Project-level accounting check",
    projectAccountingDescription:
      "Compare the team's reported cash total against the current accounting basis for this project.",
    expectedTotalProjectCash: "Expected total project cash",
    reportedTotalProjectCash: "Reported by the team",
    differenceAmount: "Remaining difference",
    capitalComponent: "Capital still invested",
    sharedLoanComponent: "Shared loan principal outstanding",
    profitComponent: "Profit still undistributed",
    reportingCoverage: (submitted: number, total: number) =>
      `${submitted}/${total} members have submitted their reconciliation check.`,
    provisionalDifference:
      "The team-reported total is still provisional until every member submits a check.",
    differenceResolved:
      "The team total matches the project's accounting basis at this cutoff.",
    differenceNeedsReview:
      "The team total still differs from the project's accounting basis.",
    acceptDifferenceLabel:
      "Close this run and accept the remaining project-level difference",
    acceptDifferenceHelp:
      "A manager or owner can still close the run with a documented explanation when the remaining gap is acceptable.",
  };
}

function getSubmittedByLabel(
  checkView: ReconciliationCheckView,
  locale: "en" | "vi",
  profilesById: Map<string, { displayName: string }>
) {
  if (!checkView.check.submittedAt) {
    return locale === "vi" ? "Chua gui" : "Not submitted yet";
  }

  const submittedByName =
    (checkView.check.submittedBy
      ? profilesById.get(checkView.check.submittedBy)?.displayName
      : null) ?? (locale === "vi" ? "Da gui" : "Submitted");

  if (
    checkView.check.submittedBy &&
    checkView.check.submittedBy !== checkView.profile.userId
  ) {
    return locale === "vi"
      ? `${submittedByName} (gui ho)`
      : `${submittedByName} (on behalf)`;
  }

  return submittedByName;
}

function OwnCheckCard({
  viewerCheck,
  currencyCode,
  locale,
  liveModeEnabled,
  isPending,
  submittedByLabel,
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
        <div className="grid gap-4 md:grid-cols-4">
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
                  ? "Chua gui"
                  : "Not submitted yet"
                : formatSignedCurrency(
                    viewerCheck.check.reportedProjectCash,
                    currencyCode,
                    locale
                  )}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm text-slate-500">{copy.submittedBy}</p>
            <p className="mt-2 text-base font-semibold text-slate-950">
              {submittedByLabel}
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
  const copy = getCopy(locale);
  const [actionState, setActionState] = useState<ReconciliationActionState>(idleState);
  const [isPending, startTransition] = useTransition();
  const pendingSectionRef = useRef<HTMLDivElement | null>(null);
  const varianceSectionRef = useRef<HTMLDivElement | null>(null);
  const tableSectionRef = useRef<HTMLDivElement | null>(null);
  const [openAsOf, setOpenAsOf] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [openNote, setOpenNote] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [acceptRemainingDifference, setAcceptRemainingDifference] = useState(false);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [tableStatusFilter, setTableStatusFilter] =
    useState<ReconciliationStatusFilter>("all");
  const [resolveCheckId, setResolveCheckId] = useState<string | null>(null);
  const [resolveReportedProjectCash, setResolveReportedProjectCash] = useState("");
  const [resolveMemberNote, setResolveMemberNote] = useState("");

  const run = snapshot.openReconciliation;
  const projectAccounting = run?.projectAccounting ?? null;
  const viewerCheck =
    run?.checks.find((item) => item.member.id === viewerProjectMemberId) ?? null;
  const canManage = viewerRole === "owner" || viewerRole === "manager";
  const profilesById = useMemo(
    () =>
      new Map(
        snapshot.dataset.profiles.map((profile) => [
          profile.userId,
          { displayName: profile.displayName },
        ])
      ),
    [snapshot.dataset.profiles]
  );

  const unresolvedCount = useMemo(
    () =>
      run?.checks.filter(
        (item) =>
          item.check.status === "pending" || item.check.status === "variance_found"
      ).length ?? 0,
    [run]
  );
  const varianceChecks = useMemo(
    () => run?.checks.filter((item) => item.check.status === "variance_found") ?? [],
    [run]
  );
  const pendingChecks = useMemo(
    () => run?.checks.filter((item) => item.check.status === "pending") ?? [],
    [run]
  );
  const resolveCheck =
    pendingChecks.find((item) => item.check.id === resolveCheckId) ?? null;
  const differenceRequiresAcceptance =
    projectAccounting != null &&
    Math.abs(projectAccounting.differenceAmount) > 0.01;
  const closeBlockedByDifference =
    differenceRequiresAcceptance &&
    (!acceptRemainingDifference || closeNote.trim().length === 0);
  const canCloseRun =
    liveModeEnabled &&
    !isPending &&
    unresolvedCount === 0 &&
    !closeBlockedByDifference;

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

  function scrollToSection(target: HTMLElement | null) {
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSummaryCardClick(
    status: Exclude<ReconciliationStatusFilter, "all" | "accepted" | "adjustment_posted">
  ) {
    setTableStatusFilter(status);

    if (status === "pending") {
      scrollToSection((pendingChecks.length > 0 ? pendingSectionRef : tableSectionRef).current);
      return;
    }

    if (status === "variance_found") {
      scrollToSection((varianceChecks.length > 0 ? varianceSectionRef : tableSectionRef).current);
      return;
    }

    scrollToSection(tableSectionRef.current);
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

  function handleStartResolve(checkView: ReconciliationCheckView) {
    setResolveCheckId(checkView.check.id);
    setResolveReportedProjectCash(
      checkView.check.reportedProjectCash?.toString() ??
        checkView.check.expectedProjectCash.toString()
    );
    setResolveMemberNote(checkView.check.memberNote ?? "");
    setTableStatusFilter("pending");
    scrollToSection(pendingSectionRef.current);
  }

  function handleCancelResolve() {
    setResolveCheckId(null);
    setResolveReportedProjectCash("");
    setResolveMemberNote("");
  }

  function handleSubmitOnBehalf(checkView: ReconciliationCheckView) {
    startTransition(async () => {
      await runAction(
        submitReconciliationCheckAction({
          projectId: snapshot.dataset.project.id,
          checkId: checkView.check.id,
          reportedProjectCash:
            resolveReportedProjectCash.trim() === ""
              ? Number.NaN
              : Number(resolveReportedProjectCash),
          memberNote: resolveMemberNote,
        }),
        () => {
          handleCancelResolve();
        }
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
          acceptRemainingDifference,
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
                ? "Click de loc cac dong da khop voi ledger."
                : "Click to filter rows that already match the ledger."
            }
            tone="teal"
            icon={<CheckCircle2 className="size-5" />}
            onClick={() => handleSummaryCardClick("matched")}
            active={tableStatusFilter === "matched"}
          />
          <MetricCard
            title={copy.pending}
            value={`${run.pendingCount}`}
            description={
              locale === "vi"
                ? "Click de xem ai dang cho va giai quyet ngay tren page nay."
                : "Click to see who is still waiting and resolve the row from this page."
            }
            tone="amber"
            icon={<ClipboardCheck className="size-5" />}
            onClick={() => handleSummaryCardClick("pending")}
            active={tableStatusFilter === "pending"}
          />
          <MetricCard
            title={copy.variance}
            value={`${run.varianceCount}`}
            description={
              locale === "vi"
                ? "Click de nhay toi cac dong lech can manager review."
                : "Click to jump to rows with mismatches that need manager review."
            }
            tone="red"
            icon={<ShieldCheck className="size-5" />}
            onClick={() => handleSummaryCardClick("variance_found")}
            active={tableStatusFilter === "variance_found"}
          />
        </div>
      ) : null}

      {run && projectAccounting ? (
        <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
          <CardHeader>
            <CardTitle>{copy.projectAccountingTitle}</CardTitle>
            <CardDescription>{copy.projectAccountingDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">
                  {copy.expectedTotalProjectCash}
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {formatCurrency(
                    projectAccounting.expectedTotalProjectCash,
                    snapshot.dataset.project.currencyCode,
                    locale
                  )}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">
                  {copy.reportedTotalProjectCash}
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {formatCurrency(
                    projectAccounting.reportedTotalProjectCash,
                    snapshot.dataset.project.currencyCode,
                    locale
                  )}
                </p>
              </div>
              <div
                className={
                  Math.abs(projectAccounting.differenceAmount) <= 0.01
                    ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4"
                    : "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4"
                }
              >
                <p className="text-sm text-slate-500">{copy.differenceAmount}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {formatSignedCurrency(
                    projectAccounting.differenceAmount,
                    snapshot.dataset.project.currencyCode,
                    locale
                  )}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">{copy.capitalComponent}</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {formatCurrency(
                    projectAccounting.expectedTotalCapitalOutstanding,
                    snapshot.dataset.project.currencyCode,
                    locale
                  )}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">{copy.sharedLoanComponent}</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {formatCurrency(
                    projectAccounting.expectedTotalSharedLoanPrincipal,
                    snapshot.dataset.project.currencyCode,
                    locale
                  )}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">{copy.profitComponent}</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {formatCurrency(
                    projectAccounting.expectedTotalUndistributedProfit,
                    snapshot.dataset.project.currencyCode,
                    locale
                  )}
                </p>
              </div>
            </div>

            <div
              className={
                !projectAccounting.allMembersSubmitted
                  ? "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                  : Math.abs(projectAccounting.differenceAmount) <= 0.01
                    ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                    : "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              }
            >
              <p className="font-medium">
                {copy.reportingCoverage(
                  projectAccounting.submittedCount,
                  projectAccounting.totalMemberCount
                )}
              </p>
              <p className="mt-1">
                {!projectAccounting.allMembersSubmitted
                  ? copy.provisionalDifference
                  : Math.abs(projectAccounting.differenceAmount) <= 0.01
                    ? copy.differenceResolved
                    : copy.differenceNeedsReview}
              </p>
            </div>
          </CardContent>
        </Card>
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
              <CardTitle>{locale === "vi" ? "Thong tin run dang mo" : "Open run details"}</CardTitle>
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
              submittedByLabel={getSubmittedByLabel(viewerCheck, locale, profilesById)}
              copy={copy}
              onSubmit={handleSubmitOwnCheck}
            />
          ) : null}

          {canManage ? (
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div ref={varianceSectionRef}>
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
                                <span>
                                  {copy.submittedBy}:{" "}
                                  {getSubmittedByLabel(item, locale, profilesById)}
                                </span>
                                <span className="font-medium text-rose-700">
                                  {locale === "vi" ? "Lech" : "Variance"}:{" "}
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
              </div>

              <div className="space-y-6">
                <div ref={pendingSectionRef}>
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
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
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
                              <Button
                                type="button"
                                variant={resolveCheckId === item.check.id ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => handleStartResolve(item)}
                                disabled={!liveModeEnabled || isPending}
                              >
                                {copy.resolvePending}
                              </Button>
                            </div>

                            {resolveCheckId === item.check.id ? (
                              <div className="mt-4 space-y-4 rounded-2xl border border-emerald-100 bg-white px-4 py-4">
                                <div>
                                  <p className="font-medium text-slate-950">
                                    {copy.resolvePendingTitle}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-600">
                                    {copy.resolvePendingDescription}
                                  </p>
                                </div>

                                <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                                  <div className="space-y-2">
                                    <Label>{copy.resolveReportedCash}</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={resolveReportedProjectCash}
                                      onChange={(event) =>
                                        setResolveReportedProjectCash(event.target.value)
                                      }
                                      disabled={!liveModeEnabled || isPending}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>{copy.resolveMemberNote}</Label>
                                    <Textarea
                                      value={resolveMemberNote}
                                      onChange={(event) =>
                                        setResolveMemberNote(event.target.value)
                                      }
                                      placeholder={copy.resolveMemberNotePlaceholder}
                                      disabled={!liveModeEnabled || isPending}
                                    />
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-3">
                                  <Button
                                    type="button"
                                    onClick={() => handleSubmitOnBehalf(item)}
                                    disabled={!liveModeEnabled || isPending}
                                  >
                                    {copy.submitForMember}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleCancelResolve}
                                    disabled={!liveModeEnabled || isPending}
                                  >
                                    {copy.cancelResolve}
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>

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

                    {differenceRequiresAcceptance && projectAccounting ? (
                      <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                        <div>
                          <p className="font-medium">{copy.differenceNeedsReview}</p>
                          <p className="mt-1">
                            {copy.differenceAmount}:{" "}
                            {formatSignedCurrency(
                              projectAccounting.differenceAmount,
                              snapshot.dataset.project.currencyCode,
                              locale
                            )}
                          </p>
                        </div>

                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={acceptRemainingDifference}
                            onCheckedChange={(nextValue) =>
                              setAcceptRemainingDifference(nextValue === true)
                            }
                            disabled={!liveModeEnabled || isPending}
                            className="mt-1"
                          />
                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-slate-900">
                              {copy.acceptDifferenceLabel}
                            </Label>
                            <p className="text-sm text-slate-700">
                              {copy.acceptDifferenceHelp}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <Button
                      type="button"
                      onClick={handleCloseRun}
                      disabled={!canCloseRun}
                    >
                      {copy.closeRunButton}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}

          <div ref={tableSectionRef}>
            <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
              <CardHeader>
                <CardTitle>{copy.tableTitle}</CardTitle>
                <CardDescription>{copy.tableDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <ProjectReconciliationTable
                  snapshot={snapshot}
                  statusFilter={tableStatusFilter}
                  onStatusFilterChange={setTableStatusFilter}
                  canResolvePending={canManage}
                  onResolveCheck={canManage ? handleStartResolve : undefined}
                  activeResolveCheckId={resolveCheck?.check.id ?? null}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
