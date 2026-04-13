import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useReducer, useRef } from "react";
import { useTranslation } from "react-i18next";
import { addLocalFeed, discoverFeeds, updateFeedFolder } from "@/api/tauri-commands";
import { useUiStore } from "@/stores/ui-store";
import type { AddFeedDialogController, AddFeedDialogControllerParams } from "./add-feed-dialog.types";
import {
  addFeedDialogReducer,
  createInitialAddFeedDialogState,
  resolveAddFeedDialogDerived,
} from "./add-feed-dialog-state";
import { createFolderIfNeeded } from "./feed-folder-flow";
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

  const handleDiscover = async () => {
    if (!derived.hasManualUrl || !derived.isManualUrlValid) {
      dispatch({ type: "set-invalid-url-error", error: t("invalid_feed_url") });
      return;
    }

    dispatch({ type: "start-discover" });

    Result.pipe(
      await discoverFeeds(trimmedUrl),
      Result.inspect((feeds) => {
        if (feeds.length === 0) {
          dispatch({ type: "discover-empty" });
        } else if (feeds.length === 1) {
          dispatch({ type: "discover-single", feeds });
        } else {
          dispatch({ type: "discover-multiple", feeds });
        }
      }),
      Result.inspectError((e) => {
        dispatch({ type: "discover-error", error: t("discovery_failed", { message: e.message }) });
      }),
    );
  };

  const getFeedUrl = () => state.selectedFeedUrl ?? state.url.trim();

  const handleSubmit = async () => {
    const feedUrl = getFeedUrl();
    if (!feedUrl) {
      return;
    }

    if (!state.selectedFeedUrl && !derived.isManualUrlValid) {
      dispatch({ type: "set-submit-error", error: t("invalid_feed_url") });
      return;
    }

    dispatch({ type: "set-loading", loading: true });

    const folderId = await createFolderIfNeeded({
      accountId,
      selectedFolderId,
      isCreatingFolder,
      newFolderName,
      onError: (error) => {
        const message = t("failed_to_create_folder", { message: error.message });
        dispatch({ type: "set-submit-error", error: message });
        showToast(message);
      },
    });
    if (folderId === undefined) {
      dispatch({ type: "set-loading", loading: false });
      return;
    }

    let feedId: string | null = null;
    let hasError = false;

    Result.pipe(
      await addLocalFeed(accountId, feedUrl),
      Result.inspect((feed) => {
        feedId = feed.id;
      }),
      Result.inspectError((e) => {
        hasError = true;
        dispatch({ type: "set-submit-error", error: t("failed_to_add_feed", { message: e.message }) });
      }),
    );

    if (hasError) {
      return;
    }

    if (folderId && feedId) {
      Result.pipe(
        await updateFeedFolder(feedId, folderId),
        Result.inspectError((e) => {
          console.error("Failed to assign folder:", e);
          showToast(t("feed_added_folder_failed", { message: e.message }));
        }),
      );
    }

    qc.invalidateQueries({ queryKey: ["feeds"] });
    qc.invalidateQueries({ queryKey: ["accountUnreadCount"] });
    qc.invalidateQueries({ queryKey: ["folders"] });
    onOpenChange(false);
    dispatch({ type: "set-loading", loading: false });
  };

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
