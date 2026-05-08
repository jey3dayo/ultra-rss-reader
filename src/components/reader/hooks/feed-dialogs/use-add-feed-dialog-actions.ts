import { Result } from "@praha/byethrow";
import { useCallback } from "react";
import { addLocalFeed, discoverFeeds, updateFeedFolder } from "@/api/tauri-commands";
import type { UseAddFeedDialogActionsParams, UseAddFeedDialogActionsResult } from "../../add-feed-dialog.types";
import { createFolderIfNeededResult } from "../../feed-folder-flow";
import { invalidateFeedQueries } from "../../feed-query-cache";

export function useAddFeedDialogActions({
  accountId,
  state,
  dispatch,
  derived,
  trimmedUrl,
  folderSelection,
  queryClient,
  onOpenChange,
  showToast,
  t,
}: UseAddFeedDialogActionsParams): UseAddFeedDialogActionsResult {
  const handleDiscover = useCallback(async () => {
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
      Result.inspectError((error) => {
        dispatch({
          type: "discover-error",
          error: t("discovery_failed", { message: error.message }),
        });
      }),
    );
  }, [derived.hasManualUrl, derived.isManualUrlValid, dispatch, t, trimmedUrl]);

  const handleSubmit = useCallback(async () => {
    const feedUrl = state.selectedFeedUrl ?? state.url.trim();
    if (!feedUrl) {
      return;
    }

    if (!state.selectedFeedUrl && !derived.isManualUrlValid) {
      dispatch({ type: "set-submit-error", error: t("invalid_feed_url") });
      return;
    }

    dispatch({ type: "set-loading", loading: true });

    const folderResult = await createFolderIfNeededResult({
      accountId,
      selectedFolderId: folderSelection.selectedFolderId,
      isCreatingFolder: folderSelection.isCreatingFolder,
      newFolderName: folderSelection.newFolderName,
    });
    if (Result.isFailure(folderResult)) {
      const error = Result.unwrapError(folderResult);
      const message = t("failed_to_create_folder", { message: error.message });
      dispatch({ type: "set-submit-error", error: message });
      showToast(message);
      dispatch({ type: "set-loading", loading: false });
      return;
    }

    const folderId = Result.unwrap(folderResult);
    let feedId: string | null = null;
    let hasError = false;

    Result.pipe(
      await addLocalFeed(accountId, feedUrl),
      Result.inspect((feed) => {
        feedId = feed.id;
      }),
      Result.inspectError((error) => {
        hasError = true;
        dispatch({
          type: "set-submit-error",
          error: t("failed_to_add_feed", { message: error.message }),
        });
      }),
    );

    if (hasError) {
      return;
    }

    if (folderId && feedId) {
      Result.pipe(
        await updateFeedFolder(feedId, folderId),
        Result.inspectError((error) => {
          console.error("Failed to assign folder:", error);
          showToast(t("feed_added_folder_failed", { message: error.message }));
        }),
      );
    }

    invalidateFeedQueries(queryClient, { includeAccountUnreadCount: true });
    onOpenChange(false);
    dispatch({ type: "set-loading", loading: false });
  }, [
    accountId,
    derived.isManualUrlValid,
    dispatch,
    folderSelection.isCreatingFolder,
    folderSelection.newFolderName,
    folderSelection.selectedFolderId,
    onOpenChange,
    queryClient,
    showToast,
    state.selectedFeedUrl,
    state.url,
    t,
  ]);

  return {
    handleDiscover,
    handleSubmit,
  };
}
