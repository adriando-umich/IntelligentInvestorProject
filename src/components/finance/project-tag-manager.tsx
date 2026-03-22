"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderTree, LoaderCircle, PencilLine, Plus, Trash2 } from "lucide-react";

import {
  createProjectTagAction,
  deleteProjectTagAction,
  updateProjectTagAction,
  type ProjectTagActionState,
} from "@/app/actions/project-tags";
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
  const router = useRouter();
  const [createName, setCreateName] = useState("");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [feedback, setFeedback] = useState<ProjectTagActionState>(idleState);
  const [isPending, startTransition] = useTransition();

  const usedTagCount = useMemo(
    () => tagSummaries.filter((tag) => tag.entryCount > 0).length,
    [tagSummaries]
  );

  function handleCreate() {
    startTransition(async () => {
      const result = await createProjectTagAction({
        projectId,
        tagName: createName,
      });

      setFeedback(result);

      if (result.status === "success") {
        setCreateName("");
        router.refresh();
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
        router.refresh();
      }
    });
  }

  function handleDelete(tag: TagSummary) {
    const confirmed = window.confirm(
      `Delete the tag "${tag.name}"? This also removes it from older tagged entries.`
    );

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
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-[1.5rem] border-white/70 bg-white/90">
          <CardContent className="px-5 py-5">
            <p className="text-sm text-slate-500">Tags in this project</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {tagSummaries.length}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-[1.5rem] border-white/70 bg-white/90">
          <CardContent className="px-5 py-5">
            <p className="text-sm text-slate-500">Tags already in use</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {usedTagCount}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-[1.5rem] border-white/70 bg-white/90">
          <CardContent className="px-5 py-5">
            <p className="text-sm text-slate-500">Unused tags</p>
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
            Tag library
          </CardTitle>
          <CardDescription>
            Create the reporting buckets people will reuse on transactions.
            Members can create tags. Rename and delete should be treated as
            manager-level cleanup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!liveModeEnabled ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              Tag CRUD is disabled in demo mode. Sign in with a live account to
              persist changes.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
              Create works on the live project. Rename and delete may require
              manager permission, and delete also depends on the latest
              tag-policy migration being present in Supabase.
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
              placeholder="Create a tag like Legal, Buyer deposit, or Bank interest"
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
              Create tag
            </Button>
          </div>

          {tagSummaries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
              No tags yet. Create your first reporting bucket here.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Entries</TableHead>
                  <TableHead>Total tagged amount</TableHead>
                  <TableHead>Inflow</TableHead>
                  <TableHead>Expense</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tagSummaries.map((tag) => {
                  const isEditing = editingTagId === tag.id;
                  return (
                    <TableRow key={tag.id}>
                      <TableCell className="align-top">
                        {isEditing ? (
                          <Input
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                            disabled={isPending}
                          />
                        ) : (
                          <div className="space-y-2">
                            <p className="font-medium text-slate-950">{tag.name}</p>
                            {tag.entryCount === 0 ? (
                              <Badge className="rounded-full bg-slate-100 text-slate-700">
                                Unused
                              </Badge>
                            ) : (
                              <Badge className="rounded-full bg-teal-100 text-teal-800">
                                In use
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
                        {formatCurrency(tag.taggedAmount, currencyCode)}
                      </TableCell>
                      <TableCell className="align-top text-emerald-700">
                        {formatCurrency(tag.inflowAmount, currencyCode)}
                      </TableCell>
                      <TableCell className="align-top text-rose-700">
                        {formatCurrency(tag.expenseAmount, currencyCode)}
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
                                Save
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-xl"
                                disabled={isPending}
                                onClick={cancelEditing}
                              >
                                Cancel
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
                                Rename
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
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
