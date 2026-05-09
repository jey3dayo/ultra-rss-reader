import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import type { Dispatch } from "react";
import { useCallback, useRef } from "react";
import { addLocalFeed, discoverFeeds, updateFeedFolder } from "@/api/tauri-commands";
import type {
  AddFeedDialogAction,
  AddFeedDialogControllerDerived,
  AddFeedDialogFolderSelectionParams,
  AddFeedDialogState,
} from "../../add-feed-dialog.types";
import { createFolderIfNeededResult } from "../../feed-folder-flow";
import { invalidateFeedQueries } from "../../feed-query-cache";

type UseAddFeedDialogActionsParams = {
  accountId: string;
  state: AddFeedDialogState;
  dispatch: Dispatch<AddFeedDialogAction>;
  derived: AddFeedDialogControllerDerived;
  trimmedUrl: string;
  folderSelection: AddFeedDialogFolderSelectionParams;
  queryClient: QueryClient;
  onOpenChange: (open: boolean) => void;
  showToast: (message: string) => void;
  t: TFunction<"reader">;
};

type UseAddFeedDialogActionsResult = {
  handleDiscover: () => Promise<void>;
  handleSubmit: () => Promise<void>;
};

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
  const discoveryRequestIdRef = useRef(0);
  const latestDiscoveryUrlRef = useRef(trimmedUrl);
  const submitInFlightRef = useRef(false);
  latestDiscoveryUrlRef.current = trimmedUrl;

  const handleDiscover = useCallback(async () => {
    if (!derived.hasManualUrl || !derived.isManualUrlValid) {
      dispatch({ type: "set-invalid-url-error", error: t("invalid_feed_url") });
      return;
    }

    const requestId = discoveryRequestIdRef.current + 1;
    discoveryRequestIdRef.current = requestId;
    const requestUrl = trimmedUrl;
    dispatch({ type: "start-discover", requestId });

    Result.pipe(
      await discoverFeeds(requestUrl),
      Result.inspect((feeds) => {
        if (discoveryRequestIdRef.current !== requestId || requestUrl !== latestDiscoveryUrlRef.current) {
          return;
        }

        if (feeds.length === 0) {
          dispatch({ type: "discover-empty", requestId });
        } else if (feeds.length === 1) {
          dispatch({ type: "discover-single", feeds, requestId });
        } else {
          dispatch({ type: "discover-multiple", feeds, requestId });
        }
      }),
      Result.inspectError((error) => {
        if (discoveryRequestIdRef.current !== requestId || requestUrl !== latestDiscoveryUrlRef.current) {
          return;
        }

        dispatch({
          type: "discover-error",
          error: t("discovery_failed", { message: error.message }),
          requestId,
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

    if (submitInFlightRef.current) {
      return;
    }

    submitInFlightRef.current = true;
    dispatch({ type: "set-loading", loading: true });

    try {
      const folderResult = await createFolderIfNeededResult({
        accountId,
        selectedFolderId: folderSelection.selectedFolderId,
        isCreatingFolder: folderSelection.isCreatingFolder,
        newFolderName: folderSelection.newFolderName,
      });
      if (Result.isFailure(folderResult)) {
        const error = Result.unwrapError(folderResult);
        const message = t("failed_to_create_folder", {
          message: error.message,
        });
        dispatch({ type: "set-submit-error", error: message });
        showToast(message);
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
    } finally {
      submitInFlightRef.current = false;
      dispatch({ type: "set-loading", loading: false });
    }
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
