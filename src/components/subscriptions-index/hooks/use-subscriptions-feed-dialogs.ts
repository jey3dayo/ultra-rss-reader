import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FeedDto } from "@/api/tauri-commands";
import { useDeleteFeed } from "@/hooks/use-delete-feed";
import { getErrorMessage } from "@/lib/ui/errors";
import { localizeUserVisibleAppErrorMessage } from "@/lib/ui/localize-app-error-message";
import { useUiStore } from "@/stores/ui-store";

type UseSubscriptionsFeedDialogsArgs = {
  selectedAccountId: string | null;
  feeds: FeedDto[];
};

type UseSubscriptionsFeedDialogsResult = {
  deleteTargetFeed: FeedDto | null;
  editTargetFeed: FeedDto | null;
  setDeleteTargetFeed: (feed: FeedDto | null) => void;
  setEditTargetFeed: (feed: FeedDto | null) => void;
  isDeleteTargetKnown: boolean;
  confirmDelete: (onUnsubscribed: (feedId: string) => void) => Promise<void>;
  unsubscribeDialogPending: boolean;
  unsubscribeFailureMessage: string | null;
};

export function useSubscriptionsFeedDialogs({
  selectedAccountId,
  feeds,
}: UseSubscriptionsFeedDialogsArgs): UseSubscriptionsFeedDialogsResult {
  const { t } = useTranslation("reader");
  const deleteFeedMutation = useDeleteFeed();
  const [deleteTargetFeed, setDeleteTarget] = useState<FeedDto | null>(null);
  const [unsubscribeFailureMessage, setUnsubscribeFailureMessage] = useState<string | null>(null);
  const deletePendingRef = useRef(false);
  const [deletePending, setDeletePending] = useState(false);
  const [editTargetFeed, setEditTargetFeed] = useState<FeedDto | null>(null);

  const setDeleteTargetFeed = useCallback((feed: FeedDto | null) => {
    setDeleteTarget(feed);
    setUnsubscribeFailureMessage(null);
  }, []);

  const deleteTargetInCurrentAccount = deleteTargetFeed?.account_id === selectedAccountId;
  const isDeleteTargetKnown =
    deleteTargetFeed === null ||
    (deleteTargetInCurrentAccount && feeds.some((feed) => feed.id === deleteTargetFeed.id));

  const confirmDelete = async (onUnsubscribed: (feedId: string) => void) => {
    if (
      !deleteTargetFeed ||
      deletePendingRef.current ||
      !isDeleteTargetKnown ||
      useUiStore.getState().subscriptionsWorkspace?.accountId !== deleteTargetFeed.account_id
    ) {
      return;
    }

    deletePendingRef.current = true;
    setDeletePending(true);
    setUnsubscribeFailureMessage(null);
    try {
      await deleteFeedMutation.mutateAsync({
        feedId: deleteTargetFeed.id,
        accountId: deleteTargetFeed.account_id,
        title: deleteTargetFeed.title,
        suppressFailureToast: true,
        onSuccess: () => {
          setDeleteTargetFeed(null);
          onUnsubscribed(deleteTargetFeed.id);
        },
      });
    } catch (error) {
      setUnsubscribeFailureMessage(
        t("failed_to_unsubscribe", { message: localizeUserVisibleAppErrorMessage(getErrorMessage(error)) }),
      );
    } finally {
      deletePendingRef.current = false;
      setDeletePending(false);
    }
  };

  useEffect(() => {
    if (deleteTargetFeed !== null && !deleteTargetInCurrentAccount && !deletePending) {
      setDeleteTarget(null);
    }
  }, [deleteTargetFeed, deleteTargetInCurrentAccount, deletePending]);

  return {
    deleteTargetFeed,
    editTargetFeed,
    setDeleteTargetFeed,
    setEditTargetFeed,
    isDeleteTargetKnown,
    confirmDelete,
    unsubscribeDialogPending: deletePending || deleteFeedMutation.isPending,
    unsubscribeFailureMessage,
  };
}
