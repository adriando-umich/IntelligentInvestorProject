"use client";

import { useActionState, useState } from "react";
import {
  Archive,
  CopyPlus,
  MoreVertical,
  Pencil,
  RotateCcw,
  Settings2,
  Trash2,
} from "lucide-react";

import {
  deleteProjectAction,
  duplicateProjectAction,
  renameProjectAction,
  updateProjectStatusAction,
  type ProjectActionState,
} from "@/app/actions/projects";
import { useLocale } from "@/components/app/locale-provider";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ProjectActionState = { status: "idle" };

export function ProjectManagementMenu({
  projectId,
  projectName,
  projectStatus,
  canManageProject,
  renameRedirectTo,
  archiveRedirectTo,
  restoreRedirectTo,
  deleteRedirectTo,
  triggerVariant = "icon",
}: {
  projectId: string;
  projectName: string;
  projectStatus: "active" | "archived" | "closed";
  canManageProject: boolean;
  renameRedirectTo: string;
  archiveRedirectTo: string;
  restoreRedirectTo: string;
  deleteRedirectTo: string;
  triggerVariant?: "icon" | "button" | "sidebar";
}) {
  const { locale } = useLocale();
  const [renameOpen, setRenameOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renameState, renameFormAction, renamePending] = useActionState(
    renameProjectAction,
    initialState
  );
  const [duplicateState, duplicateFormAction, duplicatePending] = useActionState(
    duplicateProjectAction,
    initialState
  );
  const [statusState, statusFormAction, statusPending] = useActionState(
    updateProjectStatusAction,
    initialState
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteProjectAction,
    initialState
  );

  const copy =
    locale === "vi"
      ? {
          trigger: "Project settings",
          rename: "Doi ten",
          duplicate: "Nhan ban",
          archive: "An project",
          restore: "Hien lai project",
          delete: "Xoa project",
          renameTitle: "Doi ten project",
          renameDescription:
            "Cap nhat ten project. Slug se duoc lam moi tu dong neu can.",
          duplicateTitle: "Nhan ban project",
          duplicateDescription:
            "Tao mot project moi tu metadata co ban cua project nay. Lich su ledger khong duoc copy sang ban moi.",
          duplicateSuffix: "Ban sao",
          restrictedTitle: "Chi owner/manager moi duoc quan ly project nay.",
          archiveTitle: "An project nay?",
          archiveDescription:
            "Project se bien khoi danh sach active nhung van co the mo lai va restore sau.",
          restoreTitle: "Hien lai project nay?",
          restoreDescription:
            "Project se quay lai danh sach active va sidebar cua workspace.",
          deleteTitle: "Xoa vinh vien project nay?",
          deleteDescription:
            "Tat ca members, entries, tags va du lieu lien quan cua project nay se bi xoa theo cascade. Khong the undo.",
          nameLabel: "Ten project",
          namePlaceholder: "Vi du: Nha Trang 03",
          cancel: "Huy",
          save: "Luu thay doi",
          duplicateCta: "Tao ban sao",
          archiveCta: "An project",
          restoreCta: "Hien lai",
          deleteCta: "Xoa vinh vien",
        }
      : {
          trigger: "Project settings",
          rename: "Rename",
          duplicate: "Duplicate",
          archive: "Hide project",
          restore: "Restore project",
          delete: "Delete project",
          renameTitle: "Rename project",
          renameDescription:
            "Update the project name. The project slug will be refreshed automatically when needed.",
          duplicateTitle: "Duplicate project",
          duplicateDescription:
            "Create a new project from this project's basic metadata. Ledger history does not carry into the duplicate.",
          duplicateSuffix: "Copy",
          restrictedTitle: "Only owners and managers can manage this project.",
          archiveTitle: "Hide this project?",
          archiveDescription:
            "The project will disappear from active lists, but it can still be opened and restored later.",
          restoreTitle: "Restore this project?",
          restoreDescription:
            "The project will return to the active project list and workspace sidebar.",
          deleteTitle: "Delete this project forever?",
          deleteDescription:
            "All members, entries, tags, and related project data will be deleted by cascade. This cannot be undone.",
          nameLabel: "Project name",
          namePlaceholder: "Example: Nha Trang 03",
          cancel: "Cancel",
          save: "Save changes",
          duplicateCta: "Create duplicate",
          archiveCta: "Hide project",
          restoreCta: "Restore project",
          deleteCta: "Delete forever",
        };

  const actionMessage = (state: ProjectActionState) =>
    state.status === "error" && state.message ? (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {state.message}
      </div>
    ) : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            triggerVariant === "button" ? (
              <Button variant="outline" size="lg" className="rounded-2xl px-4" />
            ) : triggerVariant === "sidebar" ? (
              <Button
                variant="ghost"
                size="icon-xs"
                className="rounded-full text-slate-500 hover:bg-white/80 hover:text-slate-950"
              />
            ) : (
              <Button variant="outline" size="icon-sm" />
            )
          }
        >
          {triggerVariant === "button" ? (
            <>
              <Settings2 className="mr-2 size-4" />
              {copy.trigger}
            </>
          ) : (
            <MoreVertical className="size-4" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {canManageProject ? (
            <>
              <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                <Pencil className="size-4" />
                {copy.rename}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDuplicateOpen(true)}>
                <CopyPlus className="size-4" />
                {copy.duplicate}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {projectStatus !== "active" ? (
                <DropdownMenuItem onClick={() => setArchiveOpen(true)}>
                  <RotateCcw className="size-4" />
                  {copy.restore}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setArchiveOpen(true)}>
                  <Archive className="size-4" />
                  {copy.archive}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
                {copy.delete}
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuLabel className="max-w-[220px] px-2 py-2 text-xs leading-5 text-slate-500">
                {copy.restrictedTitle}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <Pencil className="size-4" />
                {copy.rename}
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <CopyPlus className="size-4" />
                {copy.duplicate}
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Archive className="size-4" />
                {copy.archive}
              </DropdownMenuItem>
              <DropdownMenuItem disabled variant="destructive">
                <Trash2 className="size-4" />
                {copy.delete}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-md rounded-[1.6rem] p-0">
          <form action={renameFormAction} className="space-y-6 p-6">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="redirectTo" value={renameRedirectTo} />
            <DialogHeader>
              <DialogTitle>{copy.renameTitle}</DialogTitle>
              <DialogDescription>{copy.renameDescription}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor={`rename-project-${projectId}`}>{copy.nameLabel}</Label>
              <Input
                id={`rename-project-${projectId}`}
                name="name"
                defaultValue={projectName}
                placeholder={copy.namePlaceholder}
                autoComplete="off"
              />
            </div>
            {actionMessage(renameState)}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
              >
                {copy.cancel}
              </Button>
              <Button type="submit" disabled={renamePending}>
                {copy.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent className="max-w-md rounded-[1.6rem] p-0">
          <form action={duplicateFormAction} className="space-y-6 p-6">
            <input type="hidden" name="sourceProjectId" value={projectId} />
            <DialogHeader>
              <DialogTitle>{copy.duplicateTitle}</DialogTitle>
              <DialogDescription>{copy.duplicateDescription}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor={`duplicate-project-${projectId}`}>{copy.nameLabel}</Label>
              <Input
                id={`duplicate-project-${projectId}`}
                name="name"
                defaultValue={`${projectName} ${copy.duplicateSuffix}`}
                placeholder={copy.namePlaceholder}
                autoComplete="off"
              />
            </div>
            {actionMessage(duplicateState)}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDuplicateOpen(false)}
              >
                {copy.cancel}
              </Button>
              <Button type="submit" disabled={duplicatePending}>
                {copy.duplicateCta}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent className="rounded-[1.6rem] p-0">
          <form action={statusFormAction} className="space-y-6 p-6">
            <input type="hidden" name="projectId" value={projectId} />
            <input
              type="hidden"
              name="status"
              value={projectStatus === "active" ? "archived" : "active"}
            />
            <input
              type="hidden"
              name="redirectTo"
              value={projectStatus === "active" ? archiveRedirectTo : restoreRedirectTo}
            />
            <AlertDialogHeader className="items-start text-left">
              <AlertDialogTitle>
                {projectStatus === "active" ? copy.archiveTitle : copy.restoreTitle}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {projectStatus === "active"
                  ? copy.archiveDescription
                  : copy.restoreDescription}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {actionMessage(statusState)}
            <AlertDialogFooter className="mx-0 mb-0 rounded-[1.2rem] border-0 bg-transparent p-0">
              <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
              <Button type="submit" disabled={statusPending}>
                {projectStatus === "active" ? copy.archiveCta : copy.restoreCta}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-[1.6rem] p-0">
          <form action={deleteFormAction} className="space-y-6 p-6">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="redirectTo" value={deleteRedirectTo} />
            <AlertDialogHeader className="items-start text-left">
              <AlertDialogTitle>{copy.deleteTitle}</AlertDialogTitle>
              <AlertDialogDescription>{copy.deleteDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            {actionMessage(deleteState)}
            <AlertDialogFooter className="mx-0 mb-0 rounded-[1.2rem] border-0 bg-transparent p-0">
              <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
              <Button type="submit" variant="destructive" disabled={deletePending}>
                {copy.deleteCta}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
