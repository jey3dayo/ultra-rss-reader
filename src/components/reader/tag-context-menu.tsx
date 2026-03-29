import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TagDto } from "@/api/tauri-commands";
import { useDeleteTag, useRenameTag } from "@/hooks/use-tags";
import { useUiStore } from "@/stores/ui-store";
import { DeleteTagDialogView } from "./delete-tag-dialog-view";
import { RenameTagDialogView } from "./rename-tag-dialog-view";
import { TagContextMenuView } from "./tag-context-menu-view";

export function TagContextMenuContent({ tag }: { tag: TagDto }) {
  const { t } = useTranslation("reader");
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [renameName, setRenameName] = useState(tag.name);
  const showToast = useUiStore((s) => s.showToast);
  const renameTag = useRenameTag();
  const deleteTag = useDeleteTag();

  useEffect(() => {
    if (!showRenameDialog) {
      return;
    }

    setRenameName(tag.name);
  }, [showRenameDialog, tag.name]);

  const handleRenameOpenChange = (open: boolean) => {
    setShowRenameDialog(open);
  };

  const handleDeleteOpenChange = (open: boolean) => {
    setShowDeleteDialog(open);
  };

  const handleRenameSubmit = () => {
    const trimmed = renameName.trim();
    if (!trimmed || trimmed === tag.name) {
      handleRenameOpenChange(false);
      return;
    }

    renameTag.mutate(
      { tagId: tag.id, name: trimmed },
      {
        onSuccess: () => {
          handleRenameOpenChange(false);
        },
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          showToast(t("failed_to_rename_tag", { message }));
        },
      },
    );
  };

  const handleDeleteConfirm = () => {
    deleteTag.mutate(
      { tagId: tag.id },
      {
        onSuccess: () => {
          handleDeleteOpenChange(false);
        },
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          showToast(t("failed_to_delete_tag", { message }));
        },
      },
    );
  };

  return (
    <>
      <TagContextMenuView onRename={() => handleRenameOpenChange(true)} onDelete={() => handleDeleteOpenChange(true)} />
      <RenameTagDialogView
        open={showRenameDialog}
        name={renameName}
        loading={renameTag.isPending}
        onOpenChange={handleRenameOpenChange}
        onNameChange={setRenameName}
        onSubmit={handleRenameSubmit}
      />
      <DeleteTagDialogView
        open={showDeleteDialog}
        tagName={tag.name}
        loading={deleteTag.isPending}
        onOpenChange={handleDeleteOpenChange}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
