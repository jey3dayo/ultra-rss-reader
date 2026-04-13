import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { TFunction } from "i18next";
import { addLocalFeed, discoverFeeds, updateFeedFolder } from "@/api/tauri-commands";
import type {
  AddFeedDialogAction,
  AddFeedDialogControllerDerived,
  AddFeedDialogState,
} from "./add-feed-dialog.types";
import { createFolderIfNeeded } from "./feed-folder-flow";

type UseAddFeedDialogActionsParams = {
  accountId: string;
  state: AddFeedDialogState;
  dispatch: React.Dispatch<AddFeedDialogAction>;
  derived: AddFeedDialogControllerDerived;
  trimmedUrl: string;
  selectedFolderId: string | null;
  isCreatingFolder: boolean;
  newFolderName: string;
  queryClient: QueryClient;
  onOpenChange: (open: boolean) => void;
  showToast: (message: string) => void;
  t: TFunction<"reader">;
};

export function useAddFeedDialogActions({
  accountId,
  state,
  dispatch,
  derived,
  trimmedUrl,
  selectedFolderId,
  isCreatingFolder,
  newFolderName,
  queryClient,
  onOpenChange,
  showToast,
  t,
}: UseAddFeedDialogActionsParams) {
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
        dispatch({ type: "discover-error", error: t("discovery_failed", { message: error.message }) });
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
      Result.inspectError((error) => {
        hasError = true;
        dispatch({ type: "set-submit-error", error: t("failed_to_add_feed", { message: error.message }) });
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

    queryClient.invalidateQueries({ queryKey: ["feeds"] });
    queryClient.invalidateQueries({ queryKey: ["accountUnreadCount"] });
    queryClient.invalidateQueries({ queryKey: ["folders"] });
    onOpenChange(false);
    dispatch({ type: "set-loading", loading: false });
  }, [
    accountId,
    derived.isManualUrlValid,
    dispatch,
    isCreatingFolder,
    newFolderName,
    onOpenChange,
    queryClient,
    selectedFolderId,
    showToast,
    state.selectedFeedUrl,
    state.url,
    t,
  ]);

  return {
    handleDiscover,
    handleSubmit,
  } as const;
}
