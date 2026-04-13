import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useReducer, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "@/stores/ui-store";
import type { AddFeedDialogController, AddFeedDialogControllerParams } from "./add-feed-dialog.types";
import {
  addFeedDialogReducer,
  createInitialAddFeedDialogState,
  resolveAddFeedDialogDerived,
} from "./add-feed-dialog-state";
import { useAddFeedDialogActions } from "./use-add-feed-dialog-actions";
import { buildFolderOptions, useFolderSelection } from "./use-folder-selection";

export function useAddFeedDialogController({
  open,
  onOpenChange,
  accountId,
  folders,
  noFolderLabel,
}: AddFeedDialogControllerParams): AddFeedDialogController {
  const { t } = useTranslation("reader");
  const [state, dispatch] = useReducer(addFeedDialogReducer, undefined, createInitialAddFeedDialogState);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    selectedFolderId,
    newFolderName,
    isCreatingFolder,
    newFolderInputRef,
    folderSelectValue,
    handleFolderChange,
    resetFolderSelection,
    setNewFolderName,
  } = useFolderSelection(null);
  const qc = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);

  useEffect(() => {
    if (!open) {
      return;
    }

    dispatch({ type: "reset" });
    resetFolderSelection(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, resetFolderSelection]);

  const trimmedUrl = state.url.trim();
  const derived = resolveAddFeedDialogDerived({
    state,
    isCreatingFolder,
    newFolderName,
    invalidUrlHint: t("feed_url_help_invalid"),
    exampleUrlHint: t("feed_url_help_example"),
  });

  const { handleDiscover, handleSubmit } = useAddFeedDialogActions({
    accountId,
    state,
    dispatch,
    derived,
    trimmedUrl,
    selectedFolderId,
    isCreatingFolder,
    newFolderName,
    queryClient: qc,
    onOpenChange,
    showToast,
    t,
  });

  return {
    inputRef,
    url: state.url,
    error: state.error,
    successMessage:
      state.successMessage === "feed_url_ready"
        ? t("feed_url_ready")
        : state.successMessage === "feed_detected"
          ? t("feed_detected")
          : null,
    loading: state.loading,
    discovering: state.discovering,
    discoveredFeeds: state.discoveredFeeds,
    selectedFeedUrl: state.selectedFeedUrl,
    setUrl: (url: string) => dispatch({ type: "set-url", url }),
    setSelectedFeedUrl: (url: string | null) => dispatch({ type: "set-selected-feed-url", url }),
    handleDiscover,
    handleSubmit,
    folderSelectProps: {
      selectedFolderId,
      newFolderName,
      isCreatingFolder,
      newFolderInputRef,
      folderSelectValue,
      handleFolderChange,
      setNewFolderName,
      folderOptions: buildFolderOptions(folders, noFolderLabel),
    },
    derived,
  } as const;
}
