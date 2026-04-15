import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TagDto } from "@/api/tauri-commands";
import { useDeleteTag, useRenameTag } from "@/hooks/use-tags";
import { useUiStore } from "@/stores/ui-store";
import { DeleteTagDialogView } from "./delete-tag-dialog-view";
import { RenameTagDialogView } from "./rename-tag-dialog-view";
import { TagContextMenuView } from "./tag-context-menu-view";

const TAG_COLOR_PRESETS = [
  "#cf7868",
  "#c88d62",
  "#b59a64",
  "#5f9670",
  "#5f9695",
  "#6f8eb8",
  "#8c79b2",
  "#b97a90",
  "#726d66",
];

export type TagContextMenuContentProps = {
  tag: TagDto;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unknown error";
}

export function TagContextMenuContent({ tag }: TagContextMenuContentProps) {
  const { t } = useTranslation("reader");
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [renameName, setRenameName] = useState(tag.name);
  const [renameColor, setRenameColor] = useState<string | null>(tag.color);
  const showToast = useUiStore((s) => s.showToast);
  const renameTag = useRenameTag();
  const deleteTag = useDeleteTag();

  useEffect(() => {
    if (!showRenameDialog) {
      return;
    }

    setRenameName(tag.name);
    setRenameColor(tag.color);
  }, [showRenameDialog, tag.color, tag.name]);

  const handleRenameOpenChange = (open: boolean) => {
    setShowRenameDialog(open);
  };

  const handleDeleteOpenChange = (open: boolean) => {
    setShowDeleteDialog(open);
  };

  const handleRenameSubmit = () => {
    const trimmed = renameName.trim();
    const nameChanged = trimmed !== tag.name;
    const colorChanged = renameColor !== tag.color;
    if (!trimmed || (!nameChanged && !colorChanged)) {
      handleRenameOpenChange(false);
      return;
    }

    renameTag.mutate(
      { tagId: tag.id, name: trimmed, color: renameColor },
      {
        onSuccess: () => {
          handleRenameOpenChange(false);
        },
        onError: (error: unknown) => {
          showToast(t("failed_to_rename_tag", { message: getErrorMessage(error) }));
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
          showToast(t("failed_to_delete_tag", { message: getErrorMessage(error) }));
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
        color={renameColor}
        loading={renameTag.isPending}
        onOpenChange={handleRenameOpenChange}
        onNameChange={setRenameName}
        onColorChange={setRenameColor}
        colorOptions={TAG_COLOR_PRESETS}
        noColorLabel={t("no_color")}
        onSubmit={handleRenameSubmit}
      />
      <DeleteTagDialogView
        open={showDeleteDialog}
        tagName={tag.name}
        onOpenChange={handleDeleteOpenChange}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
