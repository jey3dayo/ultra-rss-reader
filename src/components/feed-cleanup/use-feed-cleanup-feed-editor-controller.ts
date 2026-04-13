import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { syncFeed } from "@/api/tauri-commands";
import { useUpdateFeedDisplaySettings } from "@/hooks/use-update-feed-display-mode";
import { useUpdateFeedFolder } from "@/hooks/use-update-feed-folder";
import { resolveFeedDisplayPreset } from "@/lib/article-display";
import { copyValueToClipboard } from "@/lib/clipboard";
import { useUiStore } from "@/stores/ui-store";
import { type FeedEditDisplayPreset, submitFeedEdits } from "../reader/feed-edit-submit";
import { buildFolderOptions, useFolderSelection } from "../reader/use-folder-selection";
import type {
  FeedCleanupDisplayModeOption,
  FeedCleanupFeedEditorController,
  FeedCleanupFeedEditorControllerParams,
} from "./feed-cleanup.types";

export function useFeedCleanupFeedEditorController({
  feed,
  folders,
  onSaved,
}: FeedCleanupFeedEditorControllerParams): FeedCleanupFeedEditorController {
  const { t } = useTranslation("reader");
  const { t: tCleanup } = useTranslation("cleanup");
  const qc = useQueryClient();
  const showToast = useUiStore((state) => state.showToast);
  const updateFeedFolderMutation = useUpdateFeedFolder();
  const updateFeedDisplaySettings = useUpdateFeedDisplaySettings();
  const [title, setTitle] = useState(feed.title);
  const [displayPreset, setDisplayPreset] = useState<FeedEditDisplayPreset>(() => resolveFeedDisplayPreset(feed));
  const [loading, setLoading] = useState(false);
  const [refetching, setRefetching] = useState(false);
  const {
    selectedFolderId,
    newFolderName,
    isCreatingFolder,
    newFolderInputRef,
    folderSelectValue,
    handleFolderChange,
    setNewFolderName,
  } = useFolderSelection(feed.folder_id);

  const handleCopy = async (value: string) => {
    await copyValueToClipboard(value, {
      onSuccess: () => showToast(t("copied_to_clipboard")),
      onError: (message) => showToast(message),
    });
  };

  const handleSave = async () => {
    if (!title.trim()) {
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
        onSaved();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefetch = async () => {
    setRefetching(true);
    const result = await syncFeed(feed.id);
    setRefetching(false);

    Result.pipe(
      result,
      Result.inspect((syncResult) => {
        void qc.invalidateQueries({ queryKey: ["feeds"] });
        void qc.invalidateQueries({ queryKey: ["folders"] });
        void qc.invalidateQueries({ queryKey: ["articles"] });
        void qc.invalidateQueries({ queryKey: ["accountArticles"] });
        void qc.invalidateQueries({ queryKey: ["accountUnreadCount"] });
        void qc.invalidateQueries({ queryKey: ["feedIntegrityReport"] });

        if (!syncResult.synced) {
          showToast(tCleanup("editor_refetch_in_progress"));
        } else if (syncResult.failed.length > 0) {
          const names = syncResult.failed.map((failure) => failure.account_name).join(", ");
          showToast(tCleanup("editor_refetch_failed", { message: names }));
        } else if (syncResult.warnings.length > 0) {
          showToast(tCleanup("editor_refetch_completed_with_warnings"));
        } else {
          showToast(tCleanup("editor_refetch_complete"));
        }
      }),
      Result.inspectError((error) => {
        showToast(tCleanup("editor_refetch_failed", { message: error.message }));
      }),
    );
  };

  const displayModeOptions: readonly FeedCleanupDisplayModeOption[] = [
    { value: "default", label: t("display_mode_default") },
    { value: "standard", label: t("display_mode_standard") },
    { value: "preview", label: t("display_mode_preview") },
  ];

  return {
    title,
    displayPreset,
    loading,
    refetching,
    displayModeOptions,
    setTitle,
    setDisplayPreset,
    handleCopy,
    handleSave,
    handleRefetch,
    folderSelectProps: {
      folderSelectValue,
      folderOptions: buildFolderOptions(folders, t("no_folder")),
      isCreatingFolder,
      newFolderName,
      newFolderInputRef,
      handleFolderChange,
      setNewFolderName,
    },
  };
}
