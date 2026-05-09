import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import type { Dispatch } from "react";
import { useCallback, useRef } from "react";
import type { DiscoveredFeedDto } from "@/api/tauri-commands";
import { addLocalFeed, discoverFeeds, updateFeedFolder } from "@/api/tauri-commands";
import { useAsyncCommandLifecycle } from "@/components/reader/hooks/browser/use-browser-url-effect";
import type {
  AddFeedDialogAction,
  AddFeedDialogControllerDerived,
  AddFeedDialogFolderSelectionParams,
  AddFeedDialogState,
} from "../../add-feed-dialog.types";
import { createFolderIfNeededResult } from "../../feed-folder-flow";
import {
  invalidateArticleQueries,
  invalidateFeedQueries,
  runFeedMutationWithOptimisticRollback,
} from "../../feed-query-cache";

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

export function resolveAddFeedDiscoveryAction(
  feeds: DiscoveredFeedDto[],
  requestId: number,
): Extract<AddFeedDialogAction, { type: "discover-empty" | "discover-single" | "discover-multiple" }> {
  if (feeds.length === 0) {
    return { type: "discover-empty", requestId };
  }

  if (feeds.length === 1) {
    return { type: "discover-single", feeds, requestId };
  }

  return { type: "discover-multiple", feeds, requestId };
}

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
  const discoveryLifecycle = useAsyncCommandLifecycle();
  const latestDiscoveryUrlRef = useRef(trimmedUrl);
  const submitLifecycle = useAsyncCommandLifecycle();
  latestDiscoveryUrlRef.current = trimmedUrl;

  const handleDiscover = useCallback(async () => {
    if (!derived.hasManualUrl || !derived.isManualUrlValid) {
      dispatch({ type: "set-invalid-url-error", error: t("invalid_feed_url") });
      return;
    }

    const discoveryRun = discoveryLifecycle.start();
    const requestId = discoveryRun.requestId;
    const requestUrl = trimmedUrl;
    dispatch({ type: "start-discover", requestId });

    const isLatestDiscovery = () => discoveryRun.isLatest() && requestUrl === latestDiscoveryUrlRef.current;

    const handleDiscoveryError = (message: string) => {
      if (!isLatestDiscovery()) {
        return;
      }

      dispatch({
        type: "discover-error",
        error: t("discovery_failed", { message }),
        requestId,
      });
    };

    let discoveryResult: Awaited<ReturnType<typeof discoverFeeds>>;
    try {
      discoveryResult = await discoverFeeds(requestUrl);
    } catch (error) {
      handleDiscoveryError(error instanceof Error ? error.message : String(error));
      discoveryRun.finish();
      return;
    }

    Result.pipe(
      discoveryResult,
      Result.inspect((feeds) => {
        if (!isLatestDiscovery()) {
          return;
        }

        dispatch(resolveAddFeedDiscoveryAction(feeds, requestId));
      }),
      Result.inspectError((error) => {
        handleDiscoveryError(error.message);
      }),
    );
    discoveryRun.finish();
  }, [derived.hasManualUrl, derived.isManualUrlValid, dispatch, discoveryLifecycle, t, trimmedUrl]);

  const handleSubmit = useCallback(async () => {
    const feedUrl = state.selectedFeedUrl ?? state.url.trim();
    if (!feedUrl) {
      return;
    }

    if (!state.selectedFeedUrl && !derived.isManualUrlValid) {
      dispatch({ type: "set-submit-error", error: t("invalid_feed_url") });
      return;
    }

    if (submitLifecycle.isInFlight()) {
      return;
    }

    const submitRun = submitLifecycle.start();
    await runFeedMutationWithOptimisticRollback({
      rollback: () => {
        submitRun.finish();
        dispatch({ type: "set-loading", loading: false });
      },
      shouldRollback: () => true,
      run: async () => {
        dispatch({ type: "set-loading", loading: true });

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
        invalidateArticleQueries(queryClient, {
          includeAccountUnreadCount: false,
          includeFeeds: false,
        });
        onOpenChange(false);
        submitRun.finish();
      },
    });
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
    submitLifecycle,
    state.selectedFeedUrl,
    state.url,
    t,
  ]);

  return {
    handleDiscover,
    handleSubmit,
  };
}
