import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useReducer, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { FeedDto } from "@/api/tauri-commands";
import { buildFolderOptions, useFolderSelection } from "@/components/reader/hooks/feed-dialogs/use-folder-selection";
import { useFolders } from "@/hooks/use-folders";
import { useUpdateFeedDisplaySettings } from "@/hooks/use-update-feed-display-mode";
import { useUpdateFeedFolder } from "@/hooks/use-update-feed-folder";
import { resolveFeedDisplayPreset } from "@/lib/articles/article-display";
import { copyValueToClipboard } from "@/lib/runtime/clipboard";
import { useUiStore } from "@/stores/ui-store";
import { type FeedEditorState, submitFeedEdits } from "../../feed-edit-submit";
import type {
  FeedEditDisplayPreset,
  RenameFeedDialogController,
  RenameFeedDialogControllerParams,
} from "../../rename-feed-dialog.types";

type RenameFeedDialogState = FeedEditorState;

type RenameFeedDialogAction =
  | { type: "reset"; feed: FeedDto }
  | { type: "set-title"; value: string }
  | { type: "set-display-preset"; value: FeedEditDisplayPreset }
  | { type: "set-loading"; value: boolean };

function createInitialRenameFeedDialogState(feed: FeedDto): RenameFeedDialogState {
  return {
    title: feed.title,
    displayPreset: resolveFeedDisplayPreset(feed),
    loading: false,
  };
}

function renameFeedDialogReducer(state: RenameFeedDialogState, action: RenameFeedDialogAction): RenameFeedDialogState {
  switch (action.type) {
    case "reset":
      return createInitialRenameFeedDialogState(action.feed);
    case "set-title":
      return { ...state, title: action.value };
    case "set-display-preset":
      return { ...state, displayPreset: action.value };
    case "set-loading":
      return { ...state, loading: action.value };
    default:
      return state;
  }
}

export function useRenameFeedDialogController({
  feed,
  open,
  onOpenChange,
}: RenameFeedDialogControllerParams): RenameFeedDialogController {
  const { t } = useTranslation("reader");
  const [state, dispatch] = useReducer(renameFeedDialogReducer, feed, createInitialRenameFeedDialogState);
  const { title, displayPreset, loading } = state;
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

    dispatch({ type: "reset", feed });
    resetFolderSelection(feed.folder_id);
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
      showToast(t("title_required", { defaultValue: "Title is required" }));
      return;
    }

    const folderSelection = {
      selectedFolderId,
      isCreatingFolder,
      newFolderName,
    };

    dispatch({ type: "set-loading", value: true });
    try {
      const saved = await submitFeedEdits({
        feed,
        title,
        displayPreset,
        folderSelection,
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
      dispatch({ type: "set-loading", value: false });
    }
  };

  return {
    title,
    loading,
    displayPreset,
    inputRef,
    folders,
    setTitle: (value) => dispatch({ type: "set-title", value }),
    setDisplayPreset: (value) => dispatch({ type: "set-display-preset", value }),
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
  };
}
