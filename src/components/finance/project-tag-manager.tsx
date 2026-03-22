"use client";

import { useMemo, useState, useTransition } from "react";
import { FolderTree, LoaderCircle, PencilLine, Plus, Trash2 } from "lucide-react";

import {
  createProjectTagAction,
  deleteProjectTagAction,
  updateProjectTagAction,
  type ProjectTagActionState,
} from "@/app/actions/project-tags";
import { useLocale } from "@/components/app/locale-provider";
import { TableSurface, TableToolbar } from "@/components/finance/table-toolbar";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { normalizeSearchText } from "@/lib/search";

type TagSummary = {
  id: string;
  name: string;
  slug: string;
  entryCount: number;
  taggedAmount: number;
  inflowAmount: number;
  expenseAmount: number;
};

const idleState: ProjectTagActionState = { status: "idle" };

export function ProjectTagManager({
  projectId,
  currencyCode,
  tagSummaries,
  liveModeEnabled,
}: {
  projectId: string;
  currencyCode: string;
  tagSummaries: TagSummary[];
  liveModeEnabled: boolean;
}) {
  const { locale } = useLocale();
  const [createName, setCreateName] = useState("");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_use" | "unused">(
    "all"
  );
  const [sortOrder, setSortOrder] = useState<
    "name_asc" | "entries_desc" | "amount_desc"
  >("name_asc");
  const [feedback, setFeedback] = useState<ProjectTagActionState>(idleState);
  const [isPending, startTransition] = useTransition();

  const usedTagCount = useMemo(
    () => tagSummaries.filter((tag) => tag.entryCount > 0).length,
    [tagSummaries]
  );

  const copy =
    locale === "vi"
      ? {
          tagsInProject: "Tag trong dự án",
          tagsInUse: "Tag đang được dùng",
          unusedTags: "Tag chưa dùng",
          tagLibrary: "Thư viện tag",
          tagLibraryDescription:
            "Tạo các nhóm báo cáo để team tái sử dụng trên giao dịch. Mọi người đều có thể tạo tag, còn đổi tên và xóa nên được xem là thao tác dọn dẹp ở cấp manager.",
          demoDisabled:
            "CRUD tag bị tắt trong chế độ demo. Hãy đăng nhập bằng tài khoản live để lưu thay đổi.",
          liveHint:
            "Tạo tag đã chạy trên dự án live. Đổi tên và xóa có thể cần quyền manager, và xóa còn phụ thuộc migration tag-policy mới nhất trên Supabase.",
          createPlaceholder:
            "Tạo tag như Pháp lý, Tiền cọc khách, hoặc Lãi vay ngân hàng",
          createTag: "Tạo tag",
          noTags: "Chưa có tag nào. Hãy tạo nhóm báo cáo đầu tiên ở đây.",
          tag: "Tag",
          entries: "Số giao dịch",
          taggedAmount: "Tổng giá trị gắn tag",
          inflow: "Tiền vào",
          expense: "Chi phí",
          actions: "Thao tác",
          unused: "Chưa dùng",
          inUse: "Đang dùng",
          save: "Lưu",
          cancel: "Hủy",
          rename: "Đổi tên",
          delete: "Xóa",
          deleteConfirm: (tagName: string) =>
            `Xóa tag "${tagName}"? Hành động này cũng sẽ gỡ tag khỏi các giao dịch cũ.`,
          searchPlaceholder: "Tìm theo tên tag hoặc slug...",
          searchLabel: "Tìm kiếm",
          status: "Trạng thái",
          sort: "Sắp xếp",
          allTags: "Tất cả tag",
          sortByName: "Tên A-Z",
          sortByEntries: "Nhiều giao dịch nhất",
          sortByAmount: "Giá trị gắn tag cao nhất",
          showing: (count: number) => `${count} tag đang hiển thị.`,
          emptyFiltered: "Không có tag nào khớp với tìm kiếm hoặc bộ lọc hiện tại.",
        }
      : {
          tagsInProject: "Tags in this project",
          tagsInUse: "Tags already in use",
          unusedTags: "Unused tags",
          tagLibrary: "Tag library",
          tagLibraryDescription:
            "Create the reporting buckets people will reuse on transactions. Members can create tags. Rename and delete should be treated as manager-level cleanup.",
          demoDisabled:
            "Tag CRUD is disabled in demo mode. Sign in with a live account to persist changes.",
          liveHint:
            "Create works on the live project. Rename and delete may require manager permission, and delete also depends on the latest tag-policy migration being present in Supabase.",
          createPlaceholder:
            "Create a tag like Legal, Buyer deposit, or Bank interest",
          createTag: "Create tag",
          noTags: "No tags yet. Create your first reporting bucket here.",
          tag: "Tag",
          entries: "Entries",
          taggedAmount: "Total tagged amount",
          inflow: "Inflow",
          expense: "Expense",
          actions: "Actions",
          unused: "Unused",
          inUse: "In use",
          save: "Save",
          cancel: "Cancel",
          rename: "Rename",
          delete: "Delete",
          deleteConfirm: (tagName: string) =>
            `Delete the tag "${tagName}"? This also removes it from older tagged entries.`,
          searchPlaceholder: "Search tag name or slug...",
          searchLabel: "Search",
          status: "Status",
          sort: "Sort",
          allTags: "All tags",
          sortByName: "Name A-Z",
          sortByEntries: "Most entries",
          sortByAmount: "Highest tagged amount",
          showing: (count: number) => `${count} tags shown.`,
          emptyFiltered: "No tags match the current search or filters.",
        };

  const displayedTags = useMemo(() => {
    const normalizedSearch = normalizeSearchText(search);

    return [...tagSummaries]
      .filter((tag) => {
        if (statusFilter === "in_use" && tag.entryCount === 0) {
          return false;
        }

        if (statusFilter === "unused" && tag.entryCount > 0) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return (
          normalizeSearchText(tag.name).includes(normalizedSearch) ||
          normalizeSearchText(tag.slug).includes(normalizedSearch)
        );
      })
      .sort((left, right) => {
        if (sortOrder === "entries_desc") {
          return right.entryCount - left.entryCount;
        }

        if (sortOrder === "amount_desc") {
          return right.taggedAmount - left.taggedAmount;
        }

        return left.name.localeCompare(right.name, locale);
      });
  }, [locale, search, sortOrder, statusFilter, tagSummaries]);

  function handleCreate() {
    startTransition(async () => {
      const result = await createProjectTagAction({
        projectId,
        tagName: createName,
      });

      setFeedback(result);

      if (result.status === "success") {
        setCreateName("");
        window.location.reload();
      }
    });
  }

  function startEditing(tag: TagSummary) {
    setEditingTagId(tag.id);
    setEditingName(tag.name);
    setFeedback(idleState);
  }

  function cancelEditing() {
    setEditingTagId(null);
    setEditingName("");
  }

  function handleUpdate(tagId: string) {
    startTransition(async () => {
      const result = await updateProjectTagAction({
        projectId,
        tagId,
        tagName: editingName,
      });

      setFeedback(result);

      if (result.status === "success") {
        cancelEditing();
        window.location.reload();
      }
    });
  }

  function handleDelete(tag: TagSummary) {
    const confirmed = window.confirm(copy.deleteConfirm(tag.name));

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await deleteProjectTagAction({
        projectId,
        tagId: tag.id,
      });

      setFeedback(result);

      if (result.status === "success") {
        if (editingTagId === tag.id) {
          cancelEditing();
        }
        window.location.reload();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-[1.5rem] border-white/70 bg-white/90">
          <CardContent className="px-5 py-5">
            <p className="text-sm text-slate-500">{copy.tagsInProject}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {tagSummaries.length}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-[1.5rem] border-white/70 bg-white/90">
          <CardContent className="px-5 py-5">
            <p className="text-sm text-slate-500">{copy.tagsInUse}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {usedTagCount}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-[1.5rem] border-white/70 bg-white/90">
          <CardContent className="px-5 py-5">
            <p className="text-sm text-slate-500">{copy.unusedTags}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {Math.max(tagSummaries.length - usedTagCount, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[1.75rem] border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="size-4 text-teal-700" />
            {copy.tagLibrary}
          </CardTitle>
          <CardDescription>{copy.tagLibraryDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!liveModeEnabled ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              {copy.demoDisabled}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
              {copy.liveHint}
            </div>
          )}

          {feedback.status !== "idle" ? (
            <div
              className={
                feedback.status === "success"
                  ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800"
                  : "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700"
              }
            >
              {feedback.message}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 md:flex-row">
            <Input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder={copy.createPlaceholder}
              disabled={!liveModeEnabled || isPending}
            />
            <Button
              type="button"
              className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
              disabled={!liveModeEnabled || isPending}
              onClick={handleCreate}
            >
              {isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {copy.createTag}
            </Button>
          </div>

          {tagSummaries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
              {copy.noTags}
            </div>
          ) : (
            <div className="space-y-4">
              <TableToolbar
                searchLabel={copy.searchLabel}
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder={copy.searchPlaceholder}
                resultLabel={copy.showing(displayedTags.length)}
                filters={[
                  {
                    key: "status",
                    label: copy.status,
                    value: statusFilter,
                    onValueChange: (value) =>
                      setStatusFilter(value as "all" | "in_use" | "unused"),
                    options: [
                      { value: "all", label: copy.allTags },
                      { value: "in_use", label: copy.inUse },
                      { value: "unused", label: copy.unused },
                    ],
                  },
                  {
                    key: "sort",
                    label: copy.sort,
                    value: sortOrder,
                    onValueChange: (value) =>
                      setSortOrder(
                        value as "name_asc" | "entries_desc" | "amount_desc"
                      ),
                    options: [
                      { value: "name_asc", label: copy.sortByName },
                      { value: "entries_desc", label: copy.sortByEntries },
                      { value: "amount_desc", label: copy.sortByAmount },
                    ],
                  },
                ]}
              />

              <TableSurface>
                <Table className="min-w-[980px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">{copy.tag}</TableHead>
                      <TableHead className="w-[180px]">Slug</TableHead>
                      <TableHead className="w-[120px]">{copy.entries}</TableHead>
                      <TableHead className="w-[180px]">{copy.taggedAmount}</TableHead>
                      <TableHead className="w-[160px]">{copy.inflow}</TableHead>
                      <TableHead className="w-[160px]">{copy.expense}</TableHead>
                      <TableHead className="w-[220px] text-right">
                        {copy.actions}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedTags.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="py-10 text-center whitespace-normal text-slate-500"
                        >
                          {copy.emptyFiltered}
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayedTags.map((tag) => {
                        const isEditing = editingTagId === tag.id;

                        return (
                          <TableRow key={tag.id}>
                            <TableCell className="align-top whitespace-normal">
                              {isEditing ? (
                                <Input
                                  value={editingName}
                                  onChange={(event) =>
                                    setEditingName(event.target.value)
                                  }
                                  disabled={isPending}
                                />
                              ) : (
                                <div className="space-y-2">
                                  <p className="font-medium text-slate-950">{tag.name}</p>
                                  {tag.entryCount === 0 ? (
                                    <Badge className="rounded-full bg-slate-100 text-slate-700">
                                      {copy.unused}
                                    </Badge>
                                  ) : (
                                    <Badge className="rounded-full bg-teal-100 text-teal-800">
                                      {copy.inUse}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="align-top text-sm text-slate-500">
                              {tag.slug}
                            </TableCell>
                            <TableCell className="align-top">{tag.entryCount}</TableCell>
                            <TableCell className="align-top">
                              {formatCurrency(tag.taggedAmount, currencyCode, locale)}
                            </TableCell>
                            <TableCell className="align-top text-emerald-700">
                              {formatCurrency(tag.inflowAmount, currencyCode, locale)}
                            </TableCell>
                            <TableCell className="align-top text-rose-700">
                              {formatCurrency(tag.expenseAmount, currencyCode, locale)}
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="flex justify-end gap-2">
                                {isEditing ? (
                                  <>
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="rounded-xl bg-slate-950 text-white hover:bg-slate-800"
                                      disabled={!liveModeEnabled || isPending}
                                      onClick={() => handleUpdate(tag.id)}
                                    >
                                      {copy.save}
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="rounded-xl"
                                      disabled={isPending}
                                      onClick={cancelEditing}
                                    >
                                      {copy.cancel}
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="rounded-xl"
                                      disabled={!liveModeEnabled || isPending}
                                      onClick={() => startEditing(tag)}
                                    >
                                      <PencilLine className="size-3.5" />
                                      {copy.rename}
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
                                      disabled={!liveModeEnabled || isPending}
                                      onClick={() => handleDelete(tag)}
                                    >
                                      <Trash2 className="size-3.5" />
                                      {copy.delete}
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableSurface>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
