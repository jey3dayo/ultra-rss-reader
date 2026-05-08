import { useEffect, useReducer } from "react";
import { useTranslation } from "react-i18next";
import type { TagDto } from "@/api/tauri-commands";
import { TAG_COLOR_PRESETS } from "@/components/shared/exception-palettes";
import { useDeleteTag, useRenameTag } from "@/hooks/use-tags";
import { getErrorMessage } from "@/lib/ui/errors";
import { useUiStore } from "@/stores/ui-store";
import { DeleteTagDialogView } from "./delete-tag-dialog-view";
import { RenameTagDialogView } from "./rename-tag-dialog-view";
import { TagContextMenuView } from "./tag-context-menu-view";

export type TagContextMenuContentProps = {
  tag: TagDto;
};

type TagContextMenuState = {
  showRenameDialog: boolean;
  showDeleteDialog: boolean;
  renameName: string;
  renameColor: string | null;
};

type TagContextMenuAction =
  | { type: "open-rename-dialog"; tag: TagDto }
  | { type: "close-rename-dialog" }
  | { type: "sync-rename-draft"; tag: TagDto }
  | { type: "set-delete-dialog"; value: boolean }
  | { type: "set-rename-name"; value: string }
  | { type: "set-rename-color"; value: string | null };

function createInitialTagContextMenuState(tag: TagDto): TagContextMenuState {
  return {
    showRenameDialog: false,
    showDeleteDialog: false,
    renameName: tag.name,
    renameColor: tag.color,
  };
}

function tagContextMenuReducer(state: TagContextMenuState, action: TagContextMenuAction): TagContextMenuState {
  switch (action.type) {
    case "open-rename-dialog":
      return {
        ...state,
        showRenameDialog: true,
        renameName: action.tag.name,
        renameColor: action.tag.color,
      };
    case "close-rename-dialog":
      return { ...state, showRenameDialog: false };
    case "sync-rename-draft":
      return {
        ...state,
        renameName: action.tag.name,
        renameColor: action.tag.color,
      };
    case "set-delete-dialog":
      return { ...state, showDeleteDialog: action.value };
    case "set-rename-name":
      return { ...state, renameName: action.value };
    case "set-rename-color":
      return { ...state, renameColor: action.value };
    default:
      return state;
  }
}

export function TagContextMenuContent({ tag }: TagContextMenuContentProps) {
  const { t } = useTranslation("reader");
  const [state, dispatch] = useReducer(tagContextMenuReducer, tag, createInitialTagContextMenuState);
  const { showRenameDialog, showDeleteDialog, renameName, renameColor } = state;
  const showToast = useUiStore((s) => s.showToast);
  const renameTag = useRenameTag();
  const deleteTag = useDeleteTag();

  useEffect(() => {
    if (!showRenameDialog) {
      return;
    }

    dispatch({ type: "sync-rename-draft", tag });
  }, [showRenameDialog, tag]);

  const handleRenameOpenChange = (open: boolean) => {
    if (open) {
      dispatch({ type: "open-rename-dialog", tag });
      return;
    }

    dispatch({ type: "close-rename-dialog" });
  };

  const handleDeleteOpenChange = (open: boolean) => {
    dispatch({ type: "set-delete-dialog", value: open });
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
        onNameChange={(value) => dispatch({ type: "set-rename-name", value })}
        onColorChange={(value) => dispatch({ type: "set-rename-color", value })}
        colorOptions={[...TAG_COLOR_PRESETS]}
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
