"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
  createProfitDistributionEntryAction,
  createLedgerEntryAction,
  updateProfitDistributionEntryAction,
  updateLedgerEntryAction,
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
  areAllocationSharesEqual,
  buildCapitalAllocationShares,
  buildEqualAllocationShares,
  computeAllocationAmountPreviews,
  reconcileCustomAllocationShares,
} from "@/lib/finance/allocation-shares";
import {
  entryTypeNeedsAllocation,
  entryTypeNeedsCapitalOwner,
  entryTypeNeedsCashIn,
  entryTypeNeedsCashOut,
  entryTypeNeedsSingleCashSide,
  getPlannerEntryLabel,
  getPlannerEntrySchema,
  getPlannerEntryTypesForFamily,
  parseTagNames,
  supportsLiveCreate,
  supportsLiveEdit,
  type PlannerAllocationShare,
  type PlannerAllocationSplitMode,
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
  capitalBalance: number;
};

function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100;
}

function buildRawAllocationAmountPreviewRows(
  totalAmount: number,
  shares: PlannerAllocationShare[]
) {
  const safeAmount = Math.max(totalAmount, 0);

  return shares.map((share) => ({
    ...share,
    amount: roundToTwoDecimals((safeAmount * share.weightPercent) / 100),
  }));
}

function cashOutLabel(entryType: PlannerEntryType, locale: "en" | "vi") {
  if (entryType === "capital_return") {
    return locale === "vi" ? "Ai đang chi tiền dự án ra" : "Who pays the project money out";
  }

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
  if (entryType === "capital_contribution") {
    return locale === "vi"
      ? "Ai đang giữ tiền dự án sau khi góp"
      : "Who is holding the project money";
  }

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
  if (entryType === "capital_contribution") {
    return locale === "vi"
      ? "Với giao dịch góp vốn, hãy chọn ai đang giữ tiền dự án sau khi góp. 'Capital owner' là người có số dư vốn tăng."
      : "For capital contribution, choose who is physically holding the project money after the contribution. 'Capital owner' is whose capital balance increases.";
  }

  if (entryType === "capital_return") {
    return locale === "vi"
      ? "Với hoàn vốn, hãy chọn ai đang chi tiền dự án ra. 'Capital owner' là người có số dư vốn giảm."
      : "For capital return, choose who is paying the project money out. 'Capital owner' is whose capital balance decreases.";
  }

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
        : "Choose who is paying the profit out, then review the recipients suggested from the current capital weights.",
  };
}

export function LedgerEntryPlanner({
  projectId,
  projectName,
  currencyCode,
  editingEntryId,
  editingEntryType,
  memberOptions,
  tagOptions,
  initialValues,
  liveModeEnabled,
}: {
  projectId: string;
  projectName: string;
  currencyCode: string;
  editingEntryId?: string;
  editingEntryType?: PlannerEntryType;
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
  const isEditMode = Boolean(editingEntryId);
  const today = new Date().toISOString().slice(0, 10);
  const copy =
    locale === "vi"
      ? {
          plannerTitle: "Lập giao dịch mới",
          plannerDescription:
            "Hãy chọn trước đây là nghiệp vụ thật hay điều chỉnh sổ cho dự án này. Chi phí chung và lãi vay chung mặc định sẽ chia theo tỷ lệ vốn hiện tại, còn tag sẽ giúp tổng hợp báo cáo về sau.",
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
            "Mặc định là chia theo tỷ lệ vốn hiện tại. Nếu cần, bạn vẫn có thể chuyển sang chia đều hoặc custom split.",
          allocationMode: "Che do chia",
          allocationModeHint:
            "Ty le von bam theo so du von hien tai. Chia deu giu cung mot ty le cho moi nguoi. Custom split cho phep sua tung ty le phan tram.",
          allocationCapital: "Theo ty le von",
          allocationEqual: "Chia deu",
          allocationCustom: "Custom split",
          allocationPercent: "Ty le",
          allocationAmount: "So tien",
          allocationRunningTotal: "Tong hien tai",
          allocationTotalRequired:
            "Custom split phai cong dung 100% truoc khi luu.",
          allocationEqualHint:
            "Moi thanh vien dang duoc chia deu khoan chi phi nay.",
          allocationCapitalHint:
            "Lay so du von hien tai cua nhung thanh vien da chon de dat ty le chia mac dinh.",
          allocationCustomHint:
            "Sua ty le phan tram cua tung thanh vien. Tong phai bang 100%.",
          allocationCapitalFallback:
            "Nhung thanh vien dang chon chua co so du von duong, nen he thong tam thoi chia deu de ban co the tiep tuc.",
          allocationCapitalZeroMember:
            "Co thanh vien duoc chon chua co so du von duong. Neu van muon tinh cho ho, hay chuyen sang chia deu hoac custom split.",
          allocationSplitSummary: "Cach chia hien tai",
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
            "Start by choosing whether you are recording a real business event or a ledger correction for this project. Operating expenses and shared loan interest default to the current capital ratio, and tags can be attached for later aggregation.",
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
          allocationMembers: "Members sharing this expense",
          allocationHint:
            "Capital ratio is the default. Switch to equal or custom if this expense should use a different split.",
          allocationMode: "Split mode",
          allocationModeHint:
            "Capital ratio follows the selected members' current capital balances. Equal keeps everyone on the same percentage. Custom lets you edit each member's share.",
          allocationCapital: "By capital ratio",
          allocationEqual: "Equal split",
          allocationCustom: "Custom split",
          allocationPercent: "Share %",
          allocationAmount: "Amount",
          allocationRunningTotal: "Current total",
          allocationTotalRequired:
            "Custom split must total 100% before saving.",
          allocationEqualHint:
            "Each selected member is currently carrying the same share of this expense.",
          allocationCapitalHint:
            "Use the selected members' current capital balances to set the default split.",
          allocationCustomHint:
            "Edit each selected member's percentage. The total must stay at 100%.",
          allocationCapitalFallback:
            "The selected members do not have positive capital yet, so this automatic split falls back to equal for now.",
          allocationCapitalZeroMember:
            "One or more selected members do not currently have positive capital. Switch modes if they should still carry part of this expense.",
          allocationSplitSummary: "Current split",
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
      ? `Bắt đầu bằng việc chọn đây là nghiệp vụ thật hay điều chỉnh sổ cho ${projectName}. Chi phí chung và lãi vay chung mặc định sẽ chia theo tỷ lệ vốn hiện tại, còn tag sẽ giúp tổng hợp báo cáo về sau.`
      : `Start by choosing whether you are recording a real business event or a ledger correction for ${projectName}. Operating expenses and shared loan interest default to the current capital ratio, and tags can be attached for later aggregation.`;
  const plannerSummary =
    locale === "vi"
      ? `Chọn nhóm giao dịch, điền luồng tiền, rồi preview hoặc lưu live cho ${projectName}.`
      : `Choose the entry family, fill in the money movement, then preview or save the ledger entry for ${projectName}.`;
  const plannerTitle = isEditMode
    ? locale === "vi"
      ? "Chinh sua giao dich"
      : "Edit this transaction"
    : copy.plannerTitle;
  const plannerHeaderDescription = isEditMode
    ? locale === "vi"
      ? `Dieu chinh transaction hien tai cho ${projectName}. Khi luu, app se cap nhat dung dong ledger nay thay vi tao transaction moi.`
      : `Adjust the current transaction for ${projectName}. Saving will update this ledger row instead of creating a duplicate.`
    : plannerSummary;
  const editNotice = isEditMode
    ? locale === "vi"
      ? "Ban dang sua mot transaction da ton tai."
      : "You are editing an existing transaction."
    : null;
  const liveActionLabel = isEditMode
    ? locale === "vi"
      ? "Cap nhat giao dich"
      : "Update transaction"
    : copy.createLiveEntry;
  const cancelEditLabel =
    locale === "vi" ? "Quay lai dashboard" : "Back to dashboard";
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
      allocationSplitMode: initialValues.allocationSplitMode ?? "capital",
      allocationShares: initialValues.allocationShares ?? [],
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
  const watchedAllocationSplitMode: PlannerAllocationSplitMode =
    watched.allocationSplitMode === "equal"
      ? "equal"
      : watched.allocationSplitMode === "custom"
        ? "custom"
        : "capital";
  const watchedAllocationShares = Array.isArray(watched.allocationShares)
    ? watched.allocationShares.filter(
        (share): share is PlannerAllocationShare =>
          Boolean(share) &&
          typeof share.projectMemberId === "string" &&
          share.projectMemberId.length > 0 &&
          typeof share.weightPercent === "number" &&
          Number.isFinite(share.weightPercent)
      )
    : [];
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
  const capitalBalanceByMemberId = useMemo(
    () =>
      new Map(
        memberOptions.map((member) => [member.id, member.capitalBalance])
      ),
    [memberOptions]
  );
  const defaultProfitDistributionShares = useMemo(() => {
    const memberIds = memberOptions
      .filter((member) => member.capitalBalance > 0)
      .map((member) => member.id);

    return buildCapitalAllocationShares(memberIds, capitalBalanceByMemberId);
  }, [capitalBalanceByMemberId, memberOptions]);
  const allocationShareByMemberId = useMemo(
    () =>
      new Map(
        watchedAllocationShares.map((share) => [
          share.projectMemberId,
          share.weightPercent,
        ])
      ),
    [watchedAllocationShares]
  );
  const selectedAllocationShareRows = selectedAllocationIds.map((memberId) => ({
    projectMemberId: memberId,
    weightPercent: allocationShareByMemberId.get(memberId) ?? 0,
  }));
  const selectedAllocationNames = selectedAllocationShareRows
    .map((share) => labelById.get(share.projectMemberId))
    .filter((value): value is string => Boolean(value));
  const selectedAllocationWeightTotal = roundToTwoDecimals(
    selectedAllocationShareRows.reduce(
      (sum, share) => sum + share.weightPercent,
      0
    )
  );
  const selectedAllocationCapitalTotal = roundToTwoDecimals(
    selectedAllocationIds.reduce(
      (sum, memberId) =>
        sum + Math.max(capitalBalanceByMemberId.get(memberId) ?? 0, 0),
      0
    )
  );
  const hasSelectedZeroCapitalMember =
    watchedAllocationSplitMode === "capital" &&
    selectedAllocationIds.some(
      (memberId) => (capitalBalanceByMemberId.get(memberId) ?? 0) <= 0
    );
  const capitalModeFallsBackToEqual =
    watchedAllocationSplitMode === "capital" &&
    selectedAllocationIds.length > 0 &&
    selectedAllocationCapitalTotal <= 0.01;
  const allocationWeightsValid =
    selectedAllocationShareRows.length === 0 ||
    Math.abs(selectedAllocationWeightTotal - 100) <= 0.01;
  const selectedAllocationAmountRows =
    watchedAllocationSplitMode === "custom" && !allocationWeightsValid
      ? buildRawAllocationAmountPreviewRows(
          currentAmount,
          selectedAllocationShareRows
        )
      : computeAllocationAmountPreviews(currentAmount, selectedAllocationShareRows);
  const selectedTagNames = parseTagNames(watchedTagNamesText);
  const entryTypeLocked =
    isEditMode && editingEntryType === "profit_distribution";
  const transferHelperCopy = memberTransferHelperCopy(watchedEntryType, locale);
  const currentEntryFamily = getEntryFamily(watchedEntryType);
  const availableEntryTypes = getPlannerEntryTypesForFamily(
    currentEntryFamily
  ).filter(
    (entryType) =>
      !isEditMode ||
      editingEntryType === "profit_distribution" ||
      entryType !== "profit_distribution"
  );
  const showCashInField =
    entryTypeNeedsCashIn(watchedEntryType) ||
    entryTypeNeedsSingleCashSide(watchedEntryType);
  const showCashOutField =
    entryTypeNeedsCashOut(watchedEntryType) ||
    entryTypeNeedsSingleCashSide(watchedEntryType);
  const showCapitalOwnerField = entryTypeNeedsCapitalOwner(watchedEntryType);
  const showAllocationField = entryTypeNeedsAllocation(watchedEntryType);
  const showProfitDistributionField = watchedEntryType === "profit_distribution";
  const pendingAllocationHelper =
    locale === "vi"
      ? "Pending member co the duoc chon o tat ca cac field lien quan den nguoi. Neu ho join sau, lich su van gan dung vao cung project member."
      : "Pending members can be selected in every person-related field now. If they join later, the history stays attached to the same project member.";
  const profitRecipientsLabel =
    locale === "vi" ? "Nguoi nhan loi nhuan" : "Profit recipients";
  const profitRecipientsHint =
    locale === "vi"
      ? "He thong se de xuat danh sach nguoi nhan va so tien theo ty le von hien tai. Khi sua mot dot da post, app giu nguyen split da luu de lich su khong bi drift."
      : "The app suggests recipients from the current capital weights. When you edit a posted run, it keeps the stored split so history does not drift.";
  const profitRecipientsEmpty =
    locale === "vi"
      ? "Chua co thanh vien nao co von duong de nhan loi nhuan o ngay nay."
      : "No member currently has positive capital for this distribution date.";
  const profitRecipientsLockedHint =
    locale === "vi"
      ? "Split nguoi nhan cua dot da post nay duoc giu nguyen trong man sua."
      : "This posted run keeps its stored recipient split while you edit the rest of the entry.";
  const formatPercent = (value: number) =>
    `${Number(value.toFixed(2)).toLocaleString(
      locale === "vi" ? "vi-VN" : "en-US",
      { maximumFractionDigits: 2 }
    )}%`;
  const profitDistributionShareRows =
    showProfitDistributionField &&
    isEditMode &&
    editingEntryType === "profit_distribution" &&
    selectedAllocationShareRows.length > 0
      ? selectedAllocationShareRows
      : defaultProfitDistributionShares;
  const profitDistributionAmountRows = computeAllocationAmountPreviews(
    currentAmount,
    profitDistributionShareRows
  );
  const profitDistributionWeightTotal = roundToTwoDecimals(
    profitDistributionShareRows.reduce(
      (sum, share) => sum + share.weightPercent,
      0
    )
  );
  const liveSupported =
    liveModeEnabled &&
    !(
      showProfitDistributionField && profitDistributionShareRows.length === 0
    ) &&
    (showProfitDistributionField
      ? true
      : isEditMode
        ? supportsLiveEdit(watchedEntryType)
        : supportsLiveCreate(watchedEntryType));

  useEffect(() => {
    const hasSameCustomMembership =
      watchedAllocationShares.length === selectedAllocationIds.length &&
      selectedAllocationIds.every((memberId) =>
        watchedAllocationShares.some(
          (share) => share.projectMemberId === memberId
        )
      );
    const nextShares =
      selectedAllocationIds.length === 0
        ? []
        : watchedAllocationSplitMode === "capital"
          ? buildCapitalAllocationShares(
              selectedAllocationIds,
              capitalBalanceByMemberId
            )
          : watchedAllocationSplitMode === "equal"
          ? buildEqualAllocationShares(selectedAllocationIds)
          : hasSameCustomMembership
            ? selectedAllocationIds.map((memberId) => ({
                projectMemberId: memberId,
                weightPercent: allocationShareByMemberId.get(memberId) ?? 0,
              }))
            : reconcileCustomAllocationShares(
                selectedAllocationIds,
                watchedAllocationShares
              );

    if (areAllocationSharesEqual(watchedAllocationShares, nextShares)) {
      return;
    }

    form.setValue("allocationShares", nextShares, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }, [
    form,
    allocationShareByMemberId,
    capitalBalanceByMemberId,
    selectedAllocationIds,
    watchedAllocationShares,
    watchedAllocationSplitMode,
  ]);

  function changeEntryFamily(nextFamily: EntryFamily) {
    if (entryTypeLocked) {
      return;
    }

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

  function changeAllocationSplitMode(nextMode: PlannerAllocationSplitMode) {
    form.setValue("allocationSplitMode", nextMode, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

  function updateAllocationShare(
    projectMemberId: string,
    nextWeightPercent: number
  ) {
    const safeWeightPercent = Number.isFinite(nextWeightPercent)
      ? nextWeightPercent
      : 0;
    const nextShares = selectedAllocationIds.map((memberId) => ({
      projectMemberId: memberId,
      weightPercent:
        memberId === projectMemberId
          ? safeWeightPercent
          : allocationShareByMemberId.get(memberId) ?? 0,
    }));

    form.setValue("allocationShares", nextShares, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

  function handleLiveSave(values: PlannerEntryValues) {
    startSavingLive(async () => {
      const result =
        values.entryType === "profit_distribution"
          ? isEditMode && editingEntryId
            ? await updateProfitDistributionEntryAction(editingEntryId, values)
            : await createProfitDistributionEntryAction(values)
          : isEditMode && editingEntryId
            ? await updateLedgerEntryAction(editingEntryId, values)
            : await createLedgerEntryAction(values);
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
          <CardTitle>{plannerTitle}</CardTitle>
          <CardDescription>{plannerHeaderDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5">
            {editNotice ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-4 text-sm text-emerald-900 sm:flex-row sm:items-center sm:justify-between">
                <span>{editNotice}</span>
                <Link
                  href={`/projects/${projectId}`}
                  className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                >
                  {cancelEditLabel}
                </Link>
              </div>
            ) : null}
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
                      disabled={entryTypeLocked}
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
                  disabled={entryTypeLocked}
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
                {entryTypeLocked ? (
                  <p className="text-sm leading-6 text-slate-500">
                    {locale === "vi"
                      ? "Loai phan phoi loi nhuan giu nguyen trong man sua nay de khong lam sai ty le phan bo da co."
                      : "Profit distribution keeps its existing type in edit mode so the stored split cannot drift."}
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

            {showCashInField || showCashOutField ? (
              <div
                className={`grid gap-5 ${
                  showCashInField && showCashOutField ? "sm:grid-cols-2" : ""
                }`}
              >
                {showCashOutField ? (
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
                      {memberOptions.map((member) => (
                        <option key={member.id} value={member.id}>
                          {labelById.get(member.id) ?? member.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {showCashInField ? (
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
                      {memberOptions.map((member) => (
                        <option key={member.id} value={member.id}>
                          {labelById.get(member.id) ?? member.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            ) : null}

            {transferHelperCopy ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                {transferHelperCopy}
              </div>
            ) : null}

            {showCapitalOwnerField ? (
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

            {showAllocationField ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>{copy.allocationMembers}</Label>
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
                {selectedAllocationIds.length > 0 ? (
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Label className="text-sm font-medium text-slate-900">
                          {copy.allocationMode}
                        </Label>
                        <Badge className="rounded-full bg-white text-slate-700">
                          {copy.allocationRunningTotal}:{" "}
                          {formatPercent(selectedAllocationWeightTotal)}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-500">
                        {copy.allocationModeHint}
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {(
                        [
                          ["capital", copy.allocationCapital],
                          ["equal", copy.allocationEqual],
                          ["custom", copy.allocationCustom],
                        ] as const
                      ).map(([mode, label]) => {
                        const isActive = watchedAllocationSplitMode === mode;

                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => changeAllocationSplitMode(mode)}
                            className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                              isActive
                                ? "border-teal-300 bg-teal-50 text-teal-950"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            <div className="font-medium">{label}</div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {mode === "capital"
                                ? copy.allocationCapitalHint
                                : mode === "equal"
                                  ? copy.allocationEqualHint
                                  : copy.allocationCustomHint}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                    {capitalModeFallsBackToEqual ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {copy.allocationCapitalFallback}
                      </div>
                    ) : null}
                    {!capitalModeFallsBackToEqual && hasSelectedZeroCapitalMember ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {copy.allocationCapitalZeroMember}
                      </div>
                    ) : null}
                    <div className="space-y-3">
                      {selectedAllocationShareRows.map((shareRow) => {
                        const amountRow =
                          selectedAllocationAmountRows.find(
                            (row) =>
                              row.projectMemberId === shareRow.projectMemberId
                          ) ?? null;

                        return (
                          <div
                            key={shareRow.projectMemberId}
                            className="grid gap-3 rounded-2xl border border-white/70 bg-white px-4 py-4 sm:grid-cols-[minmax(0,1fr)_132px_160px] sm:items-center"
                          >
                            <div>
                              <p className="font-medium text-slate-950">
                                {labelById.get(shareRow.projectMemberId) ??
                                  shareRow.projectMemberId}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label
                                htmlFor={`allocation-share-${shareRow.projectMemberId}`}
                                className="text-xs uppercase tracking-[0.24em] text-slate-400"
                              >
                                {copy.allocationPercent}
                              </Label>
                              <Input
                                id={`allocation-share-${shareRow.projectMemberId}`}
                                type="number"
                                min="0.01"
                                max="100"
                                step="0.01"
                                disabled={watchedAllocationSplitMode !== "custom"}
                                value={shareRow.weightPercent}
                                onChange={(event) =>
                                  updateAllocationShare(
                                    shareRow.projectMemberId,
                                    Number(event.target.value)
                                  )
                                }
                              />
                            </div>
                            <div className="rounded-2xl bg-slate-50 px-4 py-3">
                              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                                {copy.allocationAmount}
                              </p>
                              <p className="mt-2 font-medium text-slate-950">
                                {formatCurrency(
                                  amountRow?.amount ?? 0,
                                  currencyCode,
                                  locale
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {watchedAllocationSplitMode === "custom" &&
                    !allocationWeightsValid ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {copy.allocationTotalRequired}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {showProfitDistributionField ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>{profitRecipientsLabel}</Label>
                  <p className="text-sm text-slate-500">{profitRecipientsHint}</p>
                  <p className="text-sm text-slate-500">
                    {pendingAllocationHelper}
                  </p>
                </div>
                {entryTypeLocked ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    {profitRecipientsLockedHint}
                  </div>
                ) : null}
                {profitDistributionAmountRows.length > 0 ? (
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Label className="text-sm font-medium text-slate-900">
                        {profitRecipientsLabel}
                      </Label>
                      <Badge className="rounded-full bg-white text-slate-700">
                        {copy.allocationRunningTotal}:{" "}
                        {formatPercent(profitDistributionWeightTotal)}
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      {profitDistributionAmountRows.map((row) => (
                        <div
                          key={row.projectMemberId}
                          className="grid gap-3 rounded-2xl border border-white/70 bg-white px-4 py-4 sm:grid-cols-[minmax(0,1fr)_132px_160px] sm:items-center"
                          >
                            <div>
                              <p className="font-medium text-slate-950">
                                {labelById.get(row.projectMemberId) ??
                                  row.projectMemberId}
                              </p>
                            </div>
                          <div className="rounded-2xl bg-slate-50 px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                              {copy.allocationPercent}
                            </p>
                            <p className="mt-2 font-medium text-slate-950">
                              {formatPercent(row.weightPercent)}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                              {copy.allocationAmount}
                            </p>
                            <p className="mt-2 font-medium text-slate-950">
                              {formatCurrency(row.amount, currencyCode, locale)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {profitRecipientsEmpty}
                  </div>
                )}
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
            {form.formState.errors.allocationShares ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {form.formState.errors.allocationShares.message}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={form.handleSubmit(handlePreview)}
              >
                {copy.savePreview}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full border-emerald-200/80 bg-emerald-50/90 text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                disabled={!liveSupported || isSavingLive}
                onClick={form.handleSubmit(handleLiveSave)}
              >
                {isSavingLive ? copy.saving : liveActionLabel}
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
            {showCashInField || showCashOutField ? (
              <div
                className={`grid gap-3 ${
                  showCashInField && showCashOutField ? "sm:grid-cols-2" : ""
                }`}
              >
                {showCashOutField ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <p className="text-sm text-slate-500">
                      {cashOutLabel(watchedEntryType, locale)}
                    </p>
                    <p className="mt-2 font-medium text-slate-950">
                      {watchedCashOutProjectMemberId
                        ? labelById.get(watchedCashOutProjectMemberId)
                        : copy.notSet}
                    </p>
                  </div>
                ) : null}
                {showCashInField ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <p className="text-sm text-slate-500">
                      {cashInLabel(watchedEntryType, locale)}
                    </p>
                    <p className="mt-2 font-medium text-slate-950">
                      {watchedCashInProjectMemberId
                        ? labelById.get(watchedCashInProjectMemberId)
                        : copy.notSet}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {showCapitalOwnerField ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">{copy.capitalOwner}</p>
                <p className="mt-2 font-medium text-slate-950">
                  {watchedCapitalOwnerProjectMemberId
                    ? labelById.get(watchedCapitalOwnerProjectMemberId)
                    : copy.notSet}
                </p>
              </div>
            ) : null}
            {showAllocationField ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">
                    {copy.selectedAllocationMembers}
                  </p>
                  {selectedAllocationNames.length > 0 ? (
                    <Badge className="rounded-full bg-white text-slate-700">
                      {copy.allocationSplitSummary}:{" "}
                      {watchedAllocationSplitMode === "capital"
                        ? copy.allocationCapital
                        : watchedAllocationSplitMode === "equal"
                          ? copy.allocationEqual
                          : copy.allocationCustom}
                    </Badge>
                  ) : null}
                </div>
                {selectedAllocationNames.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {selectedAllocationAmountRows.map((row) => (
                      <div
                        key={row.projectMemberId}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white px-4 py-3"
                      >
                        <div>
                          <p className="font-medium text-slate-950">
                            {labelById.get(row.projectMemberId) ??
                              row.projectMemberId}
                          </p>
                          <p className="text-sm text-slate-500">
                            {formatPercent(row.weightPercent)}
                          </p>
                        </div>
                        <p className="font-medium text-slate-950">
                          {formatCurrency(row.amount, currencyCode, locale)}
                        </p>
                      </div>
                    ))}
                    <p className="text-sm text-slate-500">
                      {copy.allocationRunningTotal}:{" "}
                      <span
                        className={
                          allocationWeightsValid
                            ? "font-medium text-slate-700"
                            : "font-medium text-amber-700"
                        }
                      >
                        {formatPercent(selectedAllocationWeightTotal)}
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 font-medium text-slate-950">
                    {copy.noMembersSelected}
                  </p>
                )}
              </div>
            ) : null}
            {showProfitDistributionField ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">{profitRecipientsLabel}</p>
                  {profitDistributionAmountRows.length > 0 ? (
                    <Badge className="rounded-full bg-white text-slate-700">
                      {copy.allocationRunningTotal}:{" "}
                      {formatPercent(profitDistributionWeightTotal)}
                    </Badge>
                  ) : null}
                </div>
                {profitDistributionAmountRows.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {profitDistributionAmountRows.map((row) => (
                      <div
                        key={row.projectMemberId}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white px-4 py-3"
                      >
                        <div>
                          <p className="font-medium text-slate-950">
                            {labelById.get(row.projectMemberId) ??
                              row.projectMemberId}
                          </p>
                          <p className="text-sm text-slate-500">
                            {formatPercent(row.weightPercent)}
                          </p>
                        </div>
                        <p className="font-medium text-slate-950">
                          {formatCurrency(row.amount, currencyCode, locale)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 font-medium text-amber-800">
                    {profitRecipientsEmpty}
                  </p>
                )}
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
            {liveModeEnabled &&
            showProfitDistributionField &&
            profitDistributionAmountRows.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                {profitRecipientsEmpty}
              </div>
            ) : null}
            {liveModeEnabled &&
            !isEditMode &&
            !showProfitDistributionField &&
            !supportsLiveCreate(watchedEntryType) ? (
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
