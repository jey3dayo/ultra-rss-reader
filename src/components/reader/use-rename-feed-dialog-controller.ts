import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFolders } from "@/hooks/use-folders";
import { useUpdateFeedDisplaySettings } from "@/hooks/use-update-feed-display-mode";
import { useUpdateFeedFolder } from "@/hooks/use-update-feed-folder";
import { resolveFeedDisplayPreset } from "@/lib/article-display";
import { copyValueToClipboard } from "@/lib/clipboard";
import { useUiStore } from "@/stores/ui-store";
import { type FeedEditDisplayPreset, submitFeedEdits } from "./feed-edit-submit";
import type { RenameFeedDialogController, RenameFeedDialogControllerParams } from "./rename-feed-dialog.types";
import { buildFolderOptions, useFolderSelection } from "./use-folder-selection";

export function useRenameFeedDialogController({
  feed,
  open,
  onOpenChange,
}: RenameFeedDialogControllerParams): RenameFeedDialogController {
  const { t } = useTranslation("reader");
  const [title, setTitle] = useState(feed.title);
  const [displayPreset, setDisplayPreset] = useState<FeedEditDisplayPreset>(() => resolveFeedDisplayPreset(feed));
  const [loading, setLoading] = useState(false);
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
  } = useFolderSelection(feed.folder_id);
  const qc = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);
  const updateFeedDisplaySettings = useUpdateFeedDisplaySettings();
  const { data: folders } = useFolders(feed.account_id);
  const updateFeedFolderMutation = useUpdateFeedFolder();

  useEffect(() => {
    if (!open) {
      return;
    }

    setTitle(feed.title);
    resetFolderSelection(feed.folder_id);
    setDisplayPreset(resolveFeedDisplayPreset(feed));
    setLoading(false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [open, feed, feed.folder_id, feed.title, resetFolderSelection]);

  const handleCopy = async (value: string) => {
    await copyValueToClipboard(value, {
      onSuccess: () => showToast(t("copied_to_clipboard")),
      onError: (message, error) => {
        console.error("Copy failed:", error);
        showToast(message);
      },
    });
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      onOpenChange(false);
      return;
    }

    setLoading(true);
    try {
      const saved = await submitFeedEdits({
        feed,
        title,
        displayPreset,
        selectedFolderId,
        isCreatingFolder,
        newFolderName,
        queryClient: qc,
        showToast,
        createFolderErrorMessage: (error) => t("failed_to_create_folder", { message: error.message }),
        renameErrorMessage: (error) => t("failed_to_rename", { message: error.message }),
        updateFeedFolder: ({ feedId, folderId }) =>
          updateFeedFolderMutation
            .mutateAsync({ feedId, folderId })
            .then(() => true)
            .catch(() => false),
        updateDisplaySettings: updateFeedDisplaySettings,
      });

      if (saved) {
        onOpenChange(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    title,
    loading,
    displayPreset,
    inputRef,
    folders,
    setTitle,
    setDisplayPreset,
    handleCopy,
    handleSubmit,
    folderSelectProps: {
      folderSelectValue,
      folderOptions: buildFolderOptions(folders, t("no_folder")),
      isCreatingFolder,
      newFolderName,
      newFolderInputRef,
      handleFolderChange,
      setNewFolderName,
    },
  } as const;
}
