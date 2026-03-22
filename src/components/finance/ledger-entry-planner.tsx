"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeftRight,
  CircleAlert,
  FolderTree,
  Landmark,
  PiggyBank,
  Tags,
  Wallet,
} from "lucide-react";

import {
  createLedgerEntryAction,
  type LedgerActionState,
} from "@/app/actions/ledger";
import { useLocale } from "@/components/app/locale-provider";
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
  getPlannerEntryLabel,
  getPlannerEntrySchema,
  getPlannerEntryTypesForFamily,
  isAllocationEntryType,
  isCapitalEntryType,
  parseTagNames,
  supportsLiveCreate,
  type PlannerEntryFormValues,
  type PlannerEntryType,
  type PlannerEntryValues,
} from "@/lib/finance/entry-form";
import {
  type EntryFamily,
  getEntryFamily,
  getEntryFamilyLabel,
} from "@/lib/finance/types";
import { formatCurrency } from "@/lib/format";

type MemberOption = {
  id: string;
  name: string;
  membershipStatus: "active" | "pending_invite";
};

function cashOutLabel(entryType: PlannerEntryType, locale: "en" | "vi") {
  if (entryType === "reconciliation_adjustment") {
    return locale === "vi" ? "Giảm tiền dự án kỳ vọng của" : "Decrease expected cash for";
  }

  if (entryType === "expense_settlement_payment") {
    return locale === "vi" ? "Ai là người trả lại tiền" : "Who is paying back";
  }

  if (entryType === "cash_handover") {
    return locale === "vi" ? "Ai là người chuyển tiền đi" : "Who hands the money over";
  }

  return locale === "vi" ? "Tiền ra bởi" : "Money out by";
}

function cashInLabel(entryType: PlannerEntryType, locale: "en" | "vi") {
  if (entryType === "reconciliation_adjustment") {
    return locale === "vi" ? "Tăng tiền dự án kỳ vọng của" : "Increase expected cash for";
  }

  if (entryType === "expense_settlement_payment") {
    return locale === "vi" ? "Ai là người nhận lại tiền" : "Who gets paid back";
  }

  if (entryType === "cash_handover") {
    return locale === "vi" ? "Ai là người nhận tiền" : "Who receives the handover";
  }

  return locale === "vi" ? "Tiền vào cho" : "Money in to";
}

function memberTransferHelperCopy(entryType: PlannerEntryType, locale: "en" | "vi") {
  if (entryType === "reconciliation_adjustment") {
    return locale === "vi"
      ? "Chỉ dùng một bên. Chọn tăng tiền dự án kỳ vọng khi hệ thống cần cộng thêm tiền dự án cho một thành viên, hoặc chọn giảm khi cần trừ bớt sau đối chiếu."
      : "Use one side only. Choose increase expected cash when the app should add project money to a member, or decrease expected cash when the app should remove it after reconciliation.";
  }

  if (entryType === "expense_settlement_payment") {
    return locale === "vi"
      ? "Ví dụ A đã trả hộ B trước đó, sau đó B gửi tiền lại cho A. Hãy chọn B là người trả và A là người nhận."
      : "Example: A paid for B earlier, then B sends the money back to A. Choose B as the payer and A as the receiver.";
  }

  if (entryType === "cash_handover") {
    return locale === "vi"
      ? "Dùng loại này khi tiền dự án chỉ được chuyển giữa các thành viên mà không nhằm tất toán một khoản nợ."
      : "Use this when project cash is physically moved from one member to another without settling a debt.";
  }

  return null;
}

function effectCopy(entryType: PlannerEntryType, locale: "en" | "vi") {
  if (entryType === "capital_contribution") {
    return {
      icon: <PiggyBank className="size-4" />,
      title: locale === "vi" ? "Vốn sẽ thay đổi" : "Capital will change",
      description:
        locale === "vi"
          ? "Giao dịch này làm tăng số dư vốn và thay đổi tỷ trọng chia lợi nhuận về sau."
          : "This adds to capital balance and changes future profit-sharing weight.",
    };
  }
  if (entryType === "capital_return") {
    return {
      icon: <PiggyBank className="size-4" />,
      title: locale === "vi" ? "Vốn sẽ giảm" : "Capital will go down",
      description:
        locale === "vi"
          ? "Giao dịch này hoàn vốn và làm giảm tỷ trọng chia lợi nhuận về sau."
          : "This returns invested capital and reduces future profit-sharing weight.",
    };
  }
  if (entryType === "operating_income") {
    return {
      icon: <Wallet className="size-4" />,
      title:
        locale === "vi"
          ? "Tiền dự án và lợi nhuận vận hành sẽ tăng"
          : "Project cash and operating profit will go up",
      description:
        locale === "vi"
          ? "Tiền khách hàng hoặc dòng tiền vào vận hành sẽ làm tăng tiền dự án và P&L của dự án, chứ không tạo khoản hoàn trả."
          : "Customer money or other operating inflow increases project cash custody and project P&L, not reimbursement.",
    };
  }
  if (entryType === "shared_loan_drawdown") {
    return {
      icon: <Landmark className="size-4" />,
      title:
        locale === "vi"
          ? "Tiền vay đi vào dự án"
          : "Borrowed money comes into the project",
      description:
        locale === "vi"
          ? "Khoản này đưa tiền vay vào dự án nhưng không tính là vốn góp của bất kỳ ai. Lãi ngân hàng hãy ghi riêng ở chi phí vận hành."
          : "This brings project cash in from a lender without giving capital credit to any member. Record bank interest separately as operating expense.",
    };
  }
  if (entryType === "shared_loan_repayment_principal") {
    return {
      icon: <Landmark className="size-4" />,
      title:
        locale === "vi"
          ? "Tiền gốc vay đi ra khỏi dự án"
          : "Borrowed principal goes back out",
      description:
        locale === "vi"
          ? "Dùng khi dự án trả phần gốc vay. Nó làm giảm tiền dự án nhưng không được tính là chi phí vận hành, hoàn vốn hay chia lợi nhuận. Lãi vay hãy ghi riêng thành chi phí vận hành."
          : "Use this when the project repays loan principal. It reduces project cash, but it does not count as operating expense, capital return, or profit distribution. Record loan interest separately as operating expense.",
    };
  }
  if (entryType === "shared_loan_interest_payment") {
    return {
      icon: <Landmark className="size-4" />,
      title:
        locale === "vi"
          ? "Lãi vay trở thành chi phí của dự án"
          : "Loan interest becomes a project cost",
      description:
        locale === "vi"
          ? "Dùng shortcut này khi dự án trả lãi vay chung. Nó làm giảm P&L vận hành, có thể tạo số dư hoàn trả giữa các thành viên và luôn tách riêng khỏi gốc vay."
          : "Use this shortcut when the project pays shared bank interest. It lowers operating P&L, can create teammate reimbursement balances, and stays separate from loan principal.",
    };
  }
  if (entryType === "operating_expense") {
    return {
      icon: <CircleAlert className="size-4" />,
      title:
        locale === "vi"
          ? "Số dư chi phí chung có thể thay đổi"
          : "Shared-expense balances may change",
      description:
        locale === "vi"
          ? "Người chi sẽ ứng tiền trước, sau đó app mới gợi ý ai nên trả ai dựa trên phần phân bổ chi phí."
          : "The payer advances cash first, then the app can suggest who owes whom based on the expense allocation.",
    };
  }
  if (entryType === "reconciliation_adjustment") {
    return {
      icon: <CircleAlert className="size-4" />,
      title:
        locale === "vi"
          ? "Tiền dự án kỳ vọng sẽ được điều chỉnh"
          : "Expected project cash gets corrected",
      description:
        locale === "vi"
          ? "Dùng loại điều chỉnh này sau đối chiếu khi tiền dự án kỳ vọng của một thành viên cần tăng hoặc giảm. Chỉ chọn một bên tiền."
          : "Use this correction after reconciliation when one member's expected project cash needs to move up or down. Pick only one side of the cash leg.",
    };
  }
  if (entryType === "cash_handover") {
    return {
      icon: <ArrowLeftRight className="size-4" />,
      title:
        locale === "vi"
          ? "Chỉ vị trí giữ tiền thay đổi"
          : "Only cash custody moves",
      description:
        locale === "vi"
          ? "Giao dịch này chỉ đổi người đang cầm tiền dự án. Nó không làm thay đổi vốn, khoản hoàn trả hay lợi nhuận."
          : "This shifts who is physically holding project money. It does not change capital, reimbursement, or profit.",
    };
  }
  if (entryType === "expense_settlement_payment") {
    return {
      icon: <ArrowLeftRight className="size-4" />,
      title:
        locale === "vi"
          ? "Một thành viên trả lại tiền cho thành viên khác"
          : "One member pays another member back",
      description:
        locale === "vi"
          ? "Dùng khi một người trả lại tiền cho người khác sau khi đã được trả hộ trước đó. Ví dụ A trả hộ B, sau đó B trả lại A."
          : "Use this when one teammate returns money to another teammate after being paid for earlier. Example: A paid for B, then B pays A back.",
    };
  }
  return {
    icon: <Wallet className="size-4" />,
    title: locale === "vi" ? "Lợi nhuận được chi ra" : "Profit gets paid out",
    description:
      locale === "vi"
        ? "Luồng này cần màn thao tác riêng vì nó phụ thuộc vào tỷ trọng vốn và từng đợt chia lợi nhuận."
        : "This flow will need a dedicated distribution action because it depends on capital weights and distribution runs.",
  };
}

export function LedgerEntryPlanner({
  projectId,
  projectName,
  currencyCode,
  memberOptions,
  tagOptions,
  initialValues,
  liveModeEnabled,
}: {
  projectId: string;
  projectName: string;
  currencyCode: string;
  memberOptions: MemberOption[];
  tagOptions: string[];
  initialValues: Partial<PlannerEntryFormValues>;
  liveModeEnabled: boolean;
}) {
  const { locale } = useLocale();
  const router = useRouter();
  const [preview, setPreview] = useState<PlannerEntryValues | null>(null);
  const [liveState, setLiveState] = useState<LedgerActionState>({
    status: "idle",
  });
  const [isSavingLive, startSavingLive] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const copy =
    locale === "vi"
      ? {
          plannerTitle: "Lập giao dịch mới",
          plannerDescription:
            "Hãy chọn trước đây là nghiệp vụ thật hay điều chỉnh sổ cho dự án này. Các dòng tiền vào và chi phí chung sẽ được chia đều cho những thành viên bạn chọn, còn tag sẽ giúp tổng hợp báo cáo về sau.",
          fullGuide: "Cần xem hướng dẫn đầy đủ?",
          guideHint:
            "Giữ form này gọn để nhập nhanh, còn ma trận đầy đủ giữa nghiệp vụ thật và điều chỉnh đã nằm ở trang hướng dẫn riêng.",
          openGuide: "Mở hướng dẫn giao dịch",
          manageTags: "Quản lý tag",
          entryFamily: "Nhóm giao dịch",
          entryFamilyHint:
            "Hãy chọn nghiệp vụ thật hay điều chỉnh sổ trước khi chọn loại giao dịch cụ thể.",
          businessDescription: "Có dòng tiền thật xảy ra trong dự án.",
          correctionDescription:
            "Ngoài đời không có nghiệp vụ mới. Bạn chỉ đang sửa lại ledger.",
          entryType: "Loại giao dịch",
          correctionGuideHint:
            "Loại đảo bút toán hiện vẫn để ở trang hướng dẫn riêng vì còn cần flow chọn giao dịch gốc.",
          amount: "Số tiền",
          effectiveDate: "Ngày hiệu lực",
          description: "Mô tả",
          descriptionPlaceholder: "Đã xảy ra việc gì?",
          noPayerSelected: "Chưa chọn người chi",
          noReceiverSelected: "Chưa chọn người nhận",
          capitalOwner: "Người sở hữu phần vốn",
          chooseCapitalOwner: "Chọn người sở hữu phần vốn",
          allocationMembers: "Những người cùng chia khoản này",
          allocationHint:
            "Khi lưu live, hệ thống sẽ chia đều khoản này cho các thành viên bạn chọn.",
          tags: "Tag",
          tagsHint:
            "Dùng tag cách nhau bằng dấu phẩy như legal, deposit, bank-loan để sau này nhóm tiền vào và chi phí dễ hơn.",
          editTags: "Tạo, đổi tên hoặc xóa tag",
          tagsPlaceholder: "legal, marketing, buyer-deposit",
          externalCounterparty: "Đối tác bên ngoài",
          externalCounterpartyPlaceholder: "Tên vendor, khách mua hoặc đối tác nếu có",
          notes: "Ghi chú",
          notesPlaceholder:
            "Bối cảnh thêm, ghi chú phân bổ hoặc lời nhắc cho team.",
          savePreview: "Lưu preview",
          saving: "Đang lưu...",
          createLiveEntry: "Tạo giao dịch live",
          realWorld: "Nghiệp vụ thật ngoài đời",
          correctionOnly: "Chỉ là điều chỉnh sổ",
          currentAmount: "Số tiền hiện tại",
          moneyOut: "Tiền ra bởi",
          moneyIn: "Tiền vào cho",
          notSet: "Chưa chọn",
          selectedAllocationMembers: "Thành viên được phân bổ",
          noMembersSelected: "Chưa chọn thành viên nào",
          noTagsYet: "Chưa thêm tag nào",
          saveStatus: "Trạng thái lưu",
          saveStatusDescription:
            "Preview luôn dùng được. Lưu live cần Supabase và người dùng thật đã đăng nhập.",
          demoLiveDisabled:
            "App hiện đang ở demo mode nên chưa thể lưu live.",
          profitDistributionPreviewOnly:
            "Loại chia lợi nhuận vẫn cần flow post riêng, nên form này hiện chỉ preview cho loại đó.",
          previewSaved: "Đã lưu preview",
          previewEmpty:
            'Điền form rồi bấm "Lưu preview" để xem payload sắp được gửi.',
          type: "Loại",
          previewDescription: "Mô tả",
          previewAmount: "Số tiền",
          previewTags: "Tag",
          noTags: "Chưa có tag",
        }
      : {
          plannerTitle: "Plan a new ledger entry",
          plannerDescription:
            "Start by choosing whether you are recording a real business event or a ledger correction for this project. Shared income and expense lines are split equally across the selected members, and tags can be attached for later aggregation.",
          fullGuide: "Need the full guide?",
          guideHint:
            "Keep this planner compact here, then open the separate guide page for the full business-versus-correction matrix.",
          openGuide: "Open transaction guide",
          manageTags: "Manage tags",
          entryFamily: "Entry family",
          entryFamilyHint:
            "Choose a real business event or a correction before picking the exact transaction type.",
          businessDescription: "Real money happened in the project.",
          correctionDescription:
            "Nothing new happened in real life. You are fixing the ledger.",
          entryType: "Entry type",
          correctionGuideHint:
            "Reversal stays in the separate guide for now because it still needs a dedicated reference-to-original-entry flow.",
          amount: "Amount",
          effectiveDate: "Effective date",
          description: "Description",
          descriptionPlaceholder: "What happened?",
          noPayerSelected: "No payer selected",
          noReceiverSelected: "No receiver selected",
          capitalOwner: "Capital owner",
          chooseCapitalOwner: "Choose the capital owner",
          allocationMembers: "Members sharing this amount",
          allocationHint:
            "The live save splits this amount equally across the selected members.",
          tags: "Tags",
          tagsHint:
            "Use comma-separated tags like legal, deposit, bank-loan so you can group inflows and expenses later.",
          editTags: "Create, rename, or delete tags",
          tagsPlaceholder: "legal, marketing, buyer-deposit",
          externalCounterparty: "External counterparty",
          externalCounterpartyPlaceholder: "Optional vendor, buyer, or partner",
          notes: "Notes",
          notesPlaceholder:
            "Optional context, allocation note, or reminder for the team.",
          savePreview: "Save preview",
          saving: "Saving...",
          createLiveEntry: "Create live entry",
          realWorld: "Real-world project activity",
          correctionOnly: "Ledger correction only",
          currentAmount: "Current amount",
          moneyOut: "Money out by",
          moneyIn: "Money in to",
          notSet: "Not set",
          selectedAllocationMembers: "Selected allocation members",
          noMembersSelected: "No members selected yet",
          noTagsYet: "No tags added yet",
          saveStatus: "Save status",
          saveStatusDescription:
            "Preview works in every mode. Live create requires Supabase plus a real signed-in user.",
          demoLiveDisabled:
            "The app is currently using demo mode, so live save is disabled.",
          profitDistributionPreviewOnly:
            "Profit distribution still needs a dedicated posting flow, so this planner only previews that entry type for now.",
          previewSaved: "Preview saved",
          previewEmpty:
            'Fill the form and click "Save preview" to inspect the pending payload.',
          type: "Type",
          previewDescription: "Description",
          previewAmount: "Amount",
          previewTags: "Tags",
          noTags: "No tags",
        };
  const plannerDescription =
    locale === "vi"
      ? `Bắt đầu bằng việc chọn đây là nghiệp vụ thật hay điều chỉnh sổ cho ${projectName}. Các dòng tiền vào và chi phí chung sẽ được chia đều cho những thành viên bạn chọn, còn tag sẽ giúp tổng hợp báo cáo về sau.`
      : `Start by choosing whether you are recording a real business event or a ledger correction for ${projectName}. Shared income and expense lines are split equally across the selected members, and tags can be attached for later aggregation.`;
  const plannerSummary =
    locale === "vi"
      ? `Chọn nhóm giao dịch, điền luồng tiền, rồi preview hoặc lưu live cho ${projectName}.`
      : `Choose the entry family, fill in the money movement, then preview or save the ledger entry for ${projectName}.`;
  const plannerSchema = useMemo(() => getPlannerEntrySchema(locale), [locale]);

  const form = useForm<PlannerEntryFormValues, undefined, PlannerEntryValues>({
    resolver: zodResolver(plannerSchema),
    defaultValues: {
      projectId,
      currencyCode,
      entryType: initialValues.entryType ?? "operating_expense",
      description: initialValues.description ?? "",
      amount: initialValues.amount ?? 0,
      effectiveDate: initialValues.effectiveDate ?? today,
      cashInProjectMemberId: initialValues.cashInProjectMemberId ?? "",
      cashOutProjectMemberId: initialValues.cashOutProjectMemberId ?? "",
      capitalOwnerProjectMemberId:
        initialValues.capitalOwnerProjectMemberId ?? "",
      allocationProjectMemberIds: initialValues.allocationProjectMemberIds ?? [],
      tagNamesText: initialValues.tagNamesText ?? "",
      externalCounterparty: initialValues.externalCounterparty ?? "",
      note: initialValues.note ?? "",
    },
  });

  const watched = useWatch({
    control: form.control,
  }) as Partial<PlannerEntryFormValues>;

  const watchedEntryType =
    watched.entryType ?? initialValues.entryType ?? "operating_expense";
  const currentEffect = effectCopy(watchedEntryType, locale);
  const currentAmount =
    typeof watched.amount === "number"
      ? watched.amount
      : Number(watched.amount ?? 0);
  const watchedCashOutProjectMemberId =
    typeof watched.cashOutProjectMemberId === "string"
      ? watched.cashOutProjectMemberId
      : "";
  const watchedCashInProjectMemberId =
    typeof watched.cashInProjectMemberId === "string"
      ? watched.cashInProjectMemberId
      : "";
  const watchedCapitalOwnerProjectMemberId =
    typeof watched.capitalOwnerProjectMemberId === "string"
      ? watched.capitalOwnerProjectMemberId
      : "";
  const watchedTagNamesText =
    typeof watched.tagNamesText === "string" ? watched.tagNamesText : "";
  const selectedAllocationIds = Array.isArray(watched.allocationProjectMemberIds)
    ? watched.allocationProjectMemberIds
    : [];
  const cashMemberOptions = useMemo(
    () =>
      memberOptions.filter(
        (member) => member.membershipStatus === "active"
      ),
    [memberOptions]
  );
  const pendingMemberSuffix = locale === "vi" ? " (cho chap nhan)" : " (pending)";
  const labelById = useMemo(
    () =>
      new Map(
        memberOptions.map((member) => [
          member.id,
          member.membershipStatus === "pending_invite"
            ? `${member.name}${pendingMemberSuffix}`
            : member.name,
        ])
      ),
    [memberOptions, pendingMemberSuffix]
  );
  const selectedAllocationNames = selectedAllocationIds
    .map((memberId) => labelById.get(memberId))
    .filter((value): value is string => Boolean(value));
  const selectedTagNames = parseTagNames(watchedTagNamesText);
  const liveSupported = liveModeEnabled && supportsLiveCreate(watchedEntryType);
  const transferHelperCopy = memberTransferHelperCopy(watchedEntryType, locale);
  const currentEntryFamily = getEntryFamily(watchedEntryType);
  const availableEntryTypes = getPlannerEntryTypesForFamily(currentEntryFamily);
  const pendingAllocationHelper =
    locale === "vi"
      ? "Pending member co the duoc chia chi phi va gan phan von, nhung chua duoc chon o vai tro tra tien/nhan tien cho toi khi ho join."
      : "Pending members can receive cost allocations and capital ownership now, but they cannot be selected as the payer or receiver until they join.";

  function changeEntryFamily(nextFamily: EntryFamily) {
    const nextType = getPlannerEntryTypesForFamily(nextFamily)[0];

    if (!nextType || nextType === watchedEntryType) {
      return;
    }

    form.setValue("entryType", nextType, {
      shouldDirty: true,
      shouldTouch: true,
    });
  }

  function handlePreview(values: PlannerEntryValues) {
    setPreview(values);
    setLiveState({ status: "idle" });
  }

  function addSuggestedTag(tagName: string) {
    const nextTags = parseTagNames(
      [watchedTagNamesText, tagName].filter(Boolean).join(", ")
    );
    form.setValue("tagNamesText", nextTags.join(", "), {
      shouldDirty: true,
      shouldTouch: true,
    });
  }

  function handleLiveCreate(values: PlannerEntryValues) {
    startSavingLive(async () => {
      const result = await createLedgerEntryAction(values);
      setLiveState(result);

      if (result.status === "success" && result.redirectTo) {
        router.push(result.redirectTo);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle>{copy.plannerTitle}</CardTitle>
          <CardDescription>{plannerSummary}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>{copy.entryFamily}</Label>
                <p className="text-sm text-slate-500">{copy.entryFamilyHint}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ["business", copy.businessDescription],
                  ["correction", copy.correctionDescription],
                ] as const).map(([family, description]) => {
                  const isActive = currentEntryFamily === family;
                  return (
                    <button
                      key={family}
                      type="button"
                      onClick={() => changeEntryFamily(family)}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        isActive
                          ? "border-teal-300 bg-teal-50 text-teal-950"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            isActive
                              ? "rounded-full bg-teal-700 text-white"
                              : "rounded-full bg-slate-900 text-white"
                          }
                        >
                          {getEntryFamilyLabel(family, locale)}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm leading-6">{description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="entryType">{copy.entryType}</Label>
                <select
                  id="entryType"
                  className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-300"
                  {...form.register("entryType")}
                >
                  {availableEntryTypes.map((entryType) => (
                    <option key={entryType} value={entryType}>
                      {getPlannerEntryLabel(entryType, locale)}
                    </option>
                  ))}
                </select>
                {currentEntryFamily === "correction" ? (
                  <p className="text-sm leading-6 text-slate-500">
                    {copy.correctionGuideHint}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">{copy.amount}</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  {...form.register("amount")}
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="effectiveDate">{copy.effectiveDate}</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  {...form.register("effectiveDate")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{copy.description}</Label>
                <Input
                  id="description"
                  placeholder={copy.descriptionPlaceholder}
                  {...form.register("description")}
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cashOutProjectMemberId">
                  {cashOutLabel(watchedEntryType, locale)}
                </Label>
                <select
                  id="cashOutProjectMemberId"
                  className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-300"
                  {...form.register("cashOutProjectMemberId")}
                >
                  <option value="">{copy.noPayerSelected}</option>
                  {cashMemberOptions.map((member) => (
                    <option key={member.id} value={member.id}>
                      {labelById.get(member.id) ?? member.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cashInProjectMemberId">
                  {cashInLabel(watchedEntryType, locale)}
                </Label>
                <select
                  id="cashInProjectMemberId"
                  className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-300"
                  {...form.register("cashInProjectMemberId")}
                >
                  <option value="">{copy.noReceiverSelected}</option>
                  {cashMemberOptions.map((member) => (
                    <option key={member.id} value={member.id}>
                      {labelById.get(member.id) ?? member.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {transferHelperCopy ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                {transferHelperCopy}
              </div>
            ) : null}

            {isCapitalEntryType(watchedEntryType) ? (
              <div className="space-y-2">
                <Label htmlFor="capitalOwnerProjectMemberId">
                  {copy.capitalOwner}
                </Label>
                <select
                  id="capitalOwnerProjectMemberId"
                  className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-300"
                  {...form.register("capitalOwnerProjectMemberId")}
                >
                  <option value="">{copy.chooseCapitalOwner}</option>
                  {memberOptions.map((member) => (
                    <option key={member.id} value={member.id}>
                      {labelById.get(member.id) ?? member.name}
                    </option>
                  ))}
                </select>
                <p className="text-sm leading-6 text-slate-500">
                  {pendingAllocationHelper}
                </p>
              </div>
            ) : null}

            {isAllocationEntryType(watchedEntryType) ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Members sharing this amount</Label>
                  <p className="text-sm text-slate-500">
                    {copy.allocationHint}
                  </p>
                  <p className="text-sm text-slate-500">
                    {pendingAllocationHelper}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {memberOptions.map((member) => {
                    const checked = selectedAllocationIds.includes(member.id);
                    return (
                      <label
                        key={member.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                          checked
                            ? "border-teal-300 bg-teal-50 text-teal-900"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          value={member.id}
                          className="size-4 rounded border-slate-300"
                          {...form.register("allocationProjectMemberIds")}
                        />
                        <span>{labelById.get(member.id) ?? member.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="tagNamesText">Tags</Label>
                <p className="text-sm text-slate-500">
                  {copy.tagsHint}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/projects/${projectId}/tags`}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <FolderTree className="size-3.5" />
                    {copy.editTags}
                  </Link>
                </div>
              </div>
              <Input
                id="tagNamesText"
                placeholder={copy.tagsPlaceholder}
                {...form.register("tagNamesText")}
              />
              {tagOptions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tagOptions.map((tagName) => (
                    <Button
                      key={tagName}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      onClick={() => addSuggestedTag(tagName)}
                    >
                      <Tags className="size-3.5" />
                      {tagName}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="externalCounterparty">{copy.externalCounterparty}</Label>
                <Input
                  id="externalCounterparty"
                  placeholder={copy.externalCounterpartyPlaceholder}
                  {...form.register("externalCounterparty")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">{copy.notes}</Label>
                <Textarea
                  id="note"
                  placeholder={copy.notesPlaceholder}
                  {...form.register("note")}
                />
              </div>
            </div>

            {form.formState.errors.description ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {form.formState.errors.description.message}
              </div>
            ) : null}
            {form.formState.errors.amount ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {form.formState.errors.amount.message}
              </div>
            ) : null}
            {form.formState.errors.cashInProjectMemberId ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {form.formState.errors.cashInProjectMemberId.message}
              </div>
            ) : null}
            {form.formState.errors.cashOutProjectMemberId ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {form.formState.errors.cashOutProjectMemberId.message}
              </div>
            ) : null}
            {form.formState.errors.capitalOwnerProjectMemberId ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {form.formState.errors.capitalOwnerProjectMemberId.message}
              </div>
            ) : null}
            {form.formState.errors.allocationProjectMemberIds ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {form.formState.errors.allocationProjectMemberIds.message}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                className="w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800 sm:w-auto"
                onClick={form.handleSubmit(handlePreview)}
              >
                {copy.savePreview}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-2xl border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                disabled={!liveSupported || isSavingLive}
                onClick={form.handleSubmit(handleLiveCreate)}
              >
                {isSavingLive ? copy.saving : copy.createLiveEntry}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {currentEffect.icon}
              {currentEffect.title}
            </CardTitle>
            <CardDescription>{currentEffect.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-slate-900 text-white">
                {getEntryFamilyLabel(currentEntryFamily, locale)}
              </Badge>
              <span className="text-sm text-slate-500">
                {currentEntryFamily === "business"
                  ? copy.realWorld
                  : copy.correctionOnly}
              </span>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <p className="text-sm text-slate-500">{copy.currentAmount}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatCurrency(currentAmount || 0, currencyCode, locale)}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">{copy.moneyOut}</p>
                <p className="mt-2 font-medium text-slate-950">
                  {watchedCashOutProjectMemberId
                    ? labelById.get(watchedCashOutProjectMemberId)
                    : copy.notSet}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">{copy.moneyIn}</p>
                <p className="mt-2 font-medium text-slate-950">
                  {watchedCashInProjectMemberId
                    ? labelById.get(watchedCashInProjectMemberId)
                    : copy.notSet}
                </p>
              </div>
            </div>
            {isCapitalEntryType(watchedEntryType) ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">{copy.capitalOwner}</p>
                <p className="mt-2 font-medium text-slate-950">
                  {watchedCapitalOwnerProjectMemberId
                    ? labelById.get(watchedCapitalOwnerProjectMemberId)
                    : copy.notSet}
                </p>
              </div>
            ) : null}
            {isAllocationEntryType(watchedEntryType) ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">{copy.selectedAllocationMembers}</p>
                <p className="mt-2 font-medium text-slate-950">
                  {selectedAllocationNames.length > 0
                    ? selectedAllocationNames.join(", ")
                    : copy.noMembersSelected}
                </p>
              </div>
            ) : null}
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <p className="text-sm text-slate-500">{copy.tags}</p>
              <p className="mt-2 font-medium text-slate-950">
                {selectedTagNames.length > 0
                  ? selectedTagNames.join(", ")
                  : copy.noTagsYet}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
          <CardHeader>
            <CardTitle>{copy.saveStatus}</CardTitle>
            <CardDescription>{copy.saveStatusDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!liveModeEnabled ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                {copy.demoLiveDisabled}
              </div>
            ) : null}
            {liveModeEnabled && !supportsLiveCreate(watchedEntryType) ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                {copy.profitDistributionPreviewOnly}
              </div>
            ) : null}
            {liveState.status === "error" ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                {liveState.message}
              </div>
            ) : null}
            {preview ? (
              <div className="space-y-3 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                <Badge className="rounded-full bg-emerald-100 text-emerald-800">
                  {copy.previewSaved}
                </Badge>
                <p>
                  <span className="font-medium text-slate-950">{copy.type}:</span>{" "}
                  {getPlannerEntryLabel(preview.entryType, locale)}
                </p>
                <p>
                  <span className="font-medium text-slate-950">{copy.previewDescription}:</span>{" "}
                  {preview.description}
                </p>
                <p>
                  <span className="font-medium text-slate-950">{copy.previewAmount}:</span>{" "}
                  {formatCurrency(preview.amount, currencyCode, locale)}
                </p>
                <p>
                  <span className="font-medium text-slate-950">{copy.previewTags}:</span>{" "}
                  {parseTagNames(preview.tagNamesText).length > 0
                    ? parseTagNames(preview.tagNamesText).join(", ")
                    : copy.noTags}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
                {copy.previewEmpty}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
