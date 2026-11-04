import { useEffect, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { normalizeTagColorForCommand, normalizeTagColorForView } from "@/api/schemas/commands";
import type { TagDto } from "@/api/tauri-commands";
import { TAG_COLOR_PRESETS } from "@/design-system";
import { normalizeRenameInput } from "@/hooks/normalize-rename-input";
import { useDeleteTag, useRenameTag } from "@/hooks/use-tags";
import { getErrorMessage } from "@/lib/ui/errors";
import { useUiStore } from "@/stores/ui-store";
import { DeleteTagDialogView } from "./delete-tag-dialog-view";
import { RenameTagDialogView } from "./rename-tag-dialog-view";
import { TagContextMenuView } from "./tag-context-menu-view";

type TagContextMenuContentProps = {
  tag: TagDto;
};

type TagContextMenuState = {
  showRenameDialog: boolean;
  showDeleteDialog: boolean;
  renameName: string;
  renameColor: string | null;
  renameError: string | null;
  deleteError: string | null;
};

type TagContextMenuAction =
  | { type: "open-rename-dialog"; tag: TagDto }
  | { type: "close-rename-dialog" }
  | { type: "sync-rename-draft"; name: string; color: string | null }
  | { type: "set-delete-dialog"; value: boolean }
  | { type: "set-rename-name"; value: string }
  | { type: "set-rename-color"; value: string | null }
  | { type: "set-rename-error"; message: string | null }
  | { type: "set-delete-error"; message: string | null };

const DEFAULT_RENAME_TAG_COLOR = TAG_COLOR_PRESETS[0] ?? null;

function getEditableTagColor(color: string | null | undefined): string | null {
  return normalizeTagColorForView(color) ?? DEFAULT_RENAME_TAG_COLOR;
}

function createInitialTagContextMenuState(tag: TagDto): TagContextMenuState {
  return {
    showRenameDialog: false,
    showDeleteDialog: false,
    renameName: tag.name,
    renameColor: getEditableTagColor(tag.color),
    renameError: null,
    deleteError: null,
  };
}

function tagContextMenuReducer(state: TagContextMenuState, action: TagContextMenuAction): TagContextMenuState {
  switch (action.type) {
    case "open-rename-dialog":
      return {
        ...state,
        showRenameDialog: true,
        renameName: action.tag.name,
        renameColor: getEditableTagColor(action.tag.color),
        renameError: null,
      };
    case "close-rename-dialog":
      return { ...state, showRenameDialog: false, renameError: null };
    case "sync-rename-draft":
      return {
        ...state,
        renameName: action.name,
        renameColor: action.color,
      };
    case "set-delete-dialog":
      return { ...state, showDeleteDialog: action.value, deleteError: null };
    case "set-rename-name":
      return { ...state, renameName: action.value, renameError: null };
    case "set-rename-color":
      return { ...state, renameColor: action.value, renameError: null };
    case "set-rename-error":
      return { ...state, renameError: action.message };
    case "set-delete-error":
      return { ...state, deleteError: action.message };
    default:
      return state;
  }
}

export function TagContextMenuContent({ tag }: TagContextMenuContentProps) {
  const { t } = useTranslation("reader");
  const [state, dispatch] = useReducer(tagContextMenuReducer, tag, createInitialTagContextMenuState);
  const { showRenameDialog, showDeleteDialog, renameName, renameColor, renameError, deleteError } = state;
  const showToast = useUiStore((s) => s.showToast);
  const renameTag = useRenameTag();
  const deleteTag = useDeleteTag();
  const deleteInFlightRef = useRef(false);
  const renameDraftTagIdRef = useRef<string | null>(null);
  const [deleteInFlight, setDeleteInFlight] = useState(false);

  useEffect(() => {
    if (!showRenameDialog) {
      renameDraftTagIdRef.current = null;
      return;
    }

    if (renameDraftTagIdRef.current === tag.id) {
      return;
    }

    renameDraftTagIdRef.current = tag.id;
    dispatch({ type: "sync-rename-draft", name: tag.name, color: getEditableTagColor(tag.color) });
  }, [showRenameDialog, tag.id, tag.name, tag.color]);

  const handleRenameOpenChange = (open: boolean) => {
    if (open) {
      dispatch({ type: "open-rename-dialog", tag });
      return;
    }

    dispatch({ type: "close-rename-dialog" });
  };

  const handleDeleteOpenChange = (open: boolean) => {
    if (!open && deleteInFlightRef.current) {
      return;
    }

    dispatch({ type: "set-delete-dialog", value: open });
  };

  const handleRenameSubmit = () => {
    const trimmed = normalizeRenameInput(renameName);
    const nameChanged = trimmed !== tag.name;
    const nextColor = normalizeTagColorForCommand(renameColor);
    const colorChanged = nextColor !== getEditableTagColor(tag.color);
    if (!trimmed || (!nameChanged && !colorChanged)) {
      handleRenameOpenChange(false);
      return;
    }

    dispatch({ type: "set-rename-error", message: null });
    renameTag.mutate(
      { tagId: tag.id, name: trimmed, color: nextColor },
      {
        onSuccess: () => {
          handleRenameOpenChange(false);
        },
        onError: (error: unknown) => {
          const message = t("failed_to_rename_tag", { message: getErrorMessage(error) });
          dispatch({ type: "set-rename-error", message });
          showToast(message);
        },
      },
    );
  };

  const handleDeleteConfirm = async () => {
    if (deleteInFlightRef.current) {
      return;
    }

    deleteInFlightRef.current = true;
    setDeleteInFlight(true);
    dispatch({ type: "set-delete-error", message: null });
    try {
      await deleteTag.mutateAsync({ tagId: tag.id });
      dispatch({ type: "set-delete-dialog", value: false });
    } catch (error) {
      const message = t("failed_to_delete_tag", { message: getErrorMessage(error) });
      dispatch({ type: "set-delete-error", message });
      showToast(message);
    } finally {
      deleteInFlightRef.current = false;
      setDeleteInFlight(false);
    }
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
        errorMessage={renameError}
        onSubmit={handleRenameSubmit}
      />
      <DeleteTagDialogView
        open={showDeleteDialog}
        tagName={tag.name}
        loading={deleteInFlight || deleteTag.isPending}
        errorMessage={deleteError}
        onOpenChange={handleDeleteOpenChange}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </>
  );
}
