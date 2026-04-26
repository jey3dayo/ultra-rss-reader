import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useReducer } from "react";
import { useTranslation } from "react-i18next";
import { syncFeed } from "@/api/tauri-commands";
import { useUpdateFeedDisplaySettings } from "@/hooks/use-update-feed-display-mode";
import { useUpdateFeedFolder } from "@/hooks/use-update-feed-folder";
import { resolveFeedDisplayPreset } from "@/lib/article-display";
import { copyValueToClipboard } from "@/lib/clipboard";
import { invalidateArticleQueries, invalidateFeedQueries } from "@/lib/query-invalidation";
import { useUiStore } from "@/stores/ui-store";
import { type FeedEditDisplayPreset, type FeedEditorState, submitFeedEdits } from "../reader/feed-edit-submit";
import { buildFolderOptions, useFolderSelection } from "../reader/use-folder-selection";
import type {
  FeedCleanupDisplayModeOption,
  FeedCleanupFeedEditorController,
  FeedCleanupFeedEditorControllerParams,
} from "./feed-cleanup.types";

type FeedCleanupFeedEditorState = FeedEditorState<{
  refetching: boolean;
}>;

type FeedCleanupFeedEditorAction =
  | { type: "set-title"; value: string }
  | { type: "set-display-preset"; value: FeedEditDisplayPreset }
  | { type: "set-loading"; value: boolean }
  | { type: "set-refetching"; value: boolean };

function createInitialFeedCleanupFeedEditorState(feed: FeedCleanupFeedEditorControllerParams["feed"]) {
  return {
    title: feed.title,
    displayPreset: resolveFeedDisplayPreset(feed),
    loading: false,
    refetching: false,
  } satisfies FeedCleanupFeedEditorState;
}

function feedCleanupFeedEditorReducer(
  state: FeedCleanupFeedEditorState,
  action: FeedCleanupFeedEditorAction,
): FeedCleanupFeedEditorState {
  switch (action.type) {
    case "set-title":
      return { ...state, title: action.value };
    case "set-display-preset":
      return { ...state, displayPreset: action.value };
    case "set-loading":
      return { ...state, loading: action.value };
    case "set-refetching":
      return { ...state, refetching: action.value };
    default:
      return state;
  }
}

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
  const [state, dispatch] = useReducer(feedCleanupFeedEditorReducer, feed, createInitialFeedCleanupFeedEditorState);
  const { title, displayPreset, loading, refetching } = state;
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

    dispatch({ type: "set-loading", value: true });
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
      dispatch({ type: "set-loading", value: false });
    }
  };

  const handleRefetch = async () => {
    dispatch({ type: "set-refetching", value: true });
    const result = await syncFeed(feed.id);
    dispatch({ type: "set-refetching", value: false });

    Result.pipe(
      result,
      Result.inspect((syncResult) => {
        invalidateFeedQueries(qc, { includeAccountUnreadCount: true });
        invalidateArticleQueries(qc, {
          includeStarredArticles: false,
          includeAccountUnreadCount: false,
          includeAccountStarredCount: false,
          includeFeeds: false,
          includeArticlesByTag: false,
          includeSearch: false,
          includeFeedIntegrityReport: true,
        });

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
    setTitle: (value) => dispatch({ type: "set-title", value }),
    setDisplayPreset: (value) => dispatch({ type: "set-display-preset", value }),
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
