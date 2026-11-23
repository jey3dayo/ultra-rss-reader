import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useReducer, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { FeedDto } from "@/api/tauri-commands";
import { buildFolderOptions, useFolderSelection } from "@/components/reader/hooks/feed-dialogs/use-folder-selection";
import { useFolders } from "@/hooks/use-folders";
import { useUpdateFeedDisplaySettings } from "@/hooks/use-update-feed-display-mode";
import { useUpdateFeedFolder } from "@/hooks/use-update-feed-folder";
import { resolveFeedDisplayPreset } from "@/lib/articles/article-display";
import { scheduleAnimationFrame } from "@/lib/dom/animation-frame";
import { focusAndSelectInput } from "@/lib/dom/input-focus";
import { copyTextToClipboard } from "@/lib/runtime/clipboard";
import { localizeUserVisibleAppErrorMessage } from "@/lib/ui/localize-app-error-message";
import { useUiStore } from "@/stores/ui-store";
import type {
  FeedEditDialogController,
  FeedEditDialogControllerParams,
  FeedEditDisplayPreset,
  FeedEditSaveSummary,
  FeedEditTitleError,
} from "../../feed-edit-dialog.types";
import { type FeedEditorState, submitFeedEdits, validateFeedEditTitle } from "../../feed-edit-submit";

type FeedEditDialogState = FeedEditorState<{
  feedSnapshot: FeedDto;
  titleError: FeedEditTitleError | null;
  saveErrorMessages: readonly string[];
  saveSummary: FeedEditSaveSummary | null;
}>;

type FeedEditDialogAction =
  | { type: "reset"; feed: FeedDto }
  | { type: "sync-feed-snapshot"; feed: FeedDto }
  | { type: "set-title"; value: string }
  | { type: "set-display-preset"; value: FeedEditDisplayPreset }
  | { type: "reject-title"; error: FeedEditTitleError }
  | { type: "start-save" }
  | { type: "finish-save" }
  | { type: "report-save-error"; message: string }
  | { type: "report-partial-save"; summary: FeedEditSaveSummary }
  | { type: "clear-save-errors" };

function createInitialFeedEditDialogState(feed: FeedDto): FeedEditDialogState {
  return {
    title: feed.title,
    displayPreset: resolveFeedDisplayPreset(feed),
    loading: false,
    feedSnapshot: feed,
    titleError: null,
    saveErrorMessages: [],
    saveSummary: null,
  };
}

function feedEditDialogReducer(state: FeedEditDialogState, action: FeedEditDialogAction): FeedEditDialogState {
  switch (action.type) {
    case "reset":
      return createInitialFeedEditDialogState(action.feed);
    case "sync-feed-snapshot":
      return state.feedSnapshot === action.feed ? state : { ...state, feedSnapshot: action.feed };
    case "set-title":
      return { ...state, title: action.value, titleError: null, saveErrorMessages: [], saveSummary: null };
    case "set-display-preset":
      return { ...state, displayPreset: action.value, saveErrorMessages: [], saveSummary: null };
    case "reject-title":
      return { ...state, titleError: action.error, saveErrorMessages: [], saveSummary: null };
    case "start-save":
      return { ...state, loading: true, titleError: null, saveErrorMessages: [], saveSummary: null };
    case "finish-save":
      return { ...state, loading: false };
    case "report-save-error":
      return { ...state, saveErrorMessages: [...state.saveErrorMessages, action.message] };
    case "report-partial-save":
      return { ...state, saveSummary: action.summary };
    case "clear-save-errors":
      return state.saveErrorMessages.length === 0 && state.saveSummary === null
        ? state
        : { ...state, saveErrorMessages: [], saveSummary: null };
    default:
      return state;
  }
}

export function useFeedEditDialogController({
  feed,
  open,
  onOpenChange,
  claimOperation,
  releaseOperation,
}: FeedEditDialogControllerParams): FeedEditDialogController {
  const { t } = useTranslation("reader");
  const [state, dispatch] = useReducer(feedEditDialogReducer, feed, createInitialFeedEditDialogState);
  const { title, displayPreset, loading, feedSnapshot, titleError, saveErrorMessages, saveSummary } = state;
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
  const initializedFeedIdRef = useRef<string | null>(null);
  const qc = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);
  const updateFeedDisplaySettings = useUpdateFeedDisplaySettings();
  const { data: folders } = useFolders(feedSnapshot.account_id);
  const updateFeedFolderMutation = useUpdateFeedFolder({ notifyOnError: false });

  // Only an open transition or a different feed re-initializes the form; a refetch that hands back the
  // same feed id must not discard what the user is typing, but the saved-state baseline still follows it.
  useEffect(() => {
    if (!open) {
      initializedFeedIdRef.current = null;
      return;
    }

    if (initializedFeedIdRef.current === feed.id) {
      dispatch({ type: "sync-feed-snapshot", feed });
      return;
    }

    initializedFeedIdRef.current = feed.id;
    dispatch({ type: "reset", feed });
    resetFolderSelection(feed.folder_id);
    scheduleAnimationFrame(() => {
      focusAndSelectInput(inputRef.current);
    });
  }, [open, feed, resetFolderSelection]);

  const reportSaveError = (message: string) => dispatch({ type: "report-save-error", message });

  const handleCopy = async (value: string) => {
    Result.pipe(
      await copyTextToClipboard(value),
      Result.inspect(() => showToast(t("copied_to_clipboard"))),
      Result.inspectError((error) => {
        console.error("Copy failed:", error);
        showToast({ message: localizeUserVisibleAppErrorMessage(error.message), severity: "error" });
      }),
    );
  };

  const handleSubmit = async () => {
    if (!claimOperation()) {
      return;
    }

    try {
      const nextTitleError = validateFeedEditTitle(title);
      if (nextTitleError) {
        dispatch({ type: "reject-title", error: nextTitleError });
        focusAndSelectInput(inputRef.current);
        return;
      }

      const folderSelection = {
        selectedFolderId,
        isCreatingFolder,
        newFolderName,
        availableFolderIds: buildFolderOptions(folders, t("no_folder")).flatMap((option) =>
          option.value === "" ? [] : [option.value],
        ),
      };

      dispatch({ type: "start-save" });
      try {
        const result = await submitFeedEdits({
          feed: feedSnapshot,
          title,
          displayPreset,
          folderSelection,
          queryClient: qc,
          reportError: reportSaveError,
          createFolderErrorMessage: (error) =>
            t("failed_to_create_folder", { message: localizeUserVisibleAppErrorMessage(error.message) }),
          renameErrorMessage: (error) =>
            t("failed_to_rename", { message: localizeUserVisibleAppErrorMessage(error.message) }),
          updateFeedFolder: ({ feedId, folderId }) =>
            updateFeedFolderMutation
              .mutateAsync(
                { feedId, folderId },
                {
                  onError: (error) =>
                    reportSaveError(
                      t("failed_to_update_folder", { message: localizeUserVisibleAppErrorMessage(error.message) }),
                    ),
                },
              )
              .then(() => true)
              .catch(() => false),
          updateDisplaySettings: (feedId, readerMode, webPreviewMode) =>
            updateFeedDisplaySettings(feedId, readerMode, webPreviewMode, {
              onError: (error) =>
                reportSaveError(
                  t("failed_to_update_display_settings", {
                    message: localizeUserVisibleAppErrorMessage(error.message),
                  }),
                ),
            }),
        });

        if (result.partialOutcomes) {
          dispatch({
            type: "report-partial-save",
            summary: {
              saved: result.partialOutcomes.filter((outcome) => outcome.succeeded).map((outcome) => outcome.step),
              remaining: result.partialOutcomes.filter((outcome) => !outcome.succeeded).map((outcome) => outcome.step),
            },
          });
        }

        if (result.success) {
          onOpenChange(false);
        }
      } finally {
        dispatch({ type: "finish-save" });
      }
    } finally {
      releaseOperation();
    }
  };

  return {
    title,
    loading,
    displayPreset,
    titleError,
    saveErrorMessages,
    saveSummary,
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
      handleFolderChange: (value) => {
        dispatch({ type: "clear-save-errors" });
        handleFolderChange(value);
      },
      setNewFolderName: (value) => {
        dispatch({ type: "clear-save-errors" });
        setNewFolderName(value);
      },
    },
  };
}
