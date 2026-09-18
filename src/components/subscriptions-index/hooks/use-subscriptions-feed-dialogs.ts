import { useEffect, useRef, useState } from "react";
import type { FeedDto } from "@/api/tauri-commands";
import { useDeleteFeed } from "@/hooks/use-delete-feed";

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
  confirmDelete: () => Promise<void>;
  unsubscribeDialogPending: boolean;
};

export function useSubscriptionsFeedDialogs({
  selectedAccountId,
  feeds,
}: UseSubscriptionsFeedDialogsArgs): UseSubscriptionsFeedDialogsResult {
  const deleteFeedMutation = useDeleteFeed();
  const [deleteTargetFeed, setDeleteTargetFeed] = useState<FeedDto | null>(null);
  const deletePendingRef = useRef(false);
  const [deletePending, setDeletePending] = useState(false);
  const [editTargetFeed, setEditTargetFeed] = useState<FeedDto | null>(null);

  const deleteTargetInCurrentAccount = deleteTargetFeed?.account_id === selectedAccountId;
  const isDeleteTargetKnown =
    deleteTargetFeed === null ||
    (deleteTargetInCurrentAccount && feeds.some((feed) => feed.id === deleteTargetFeed.id));

  const confirmDelete = async () => {
    if (!deleteTargetFeed || deletePendingRef.current || !isDeleteTargetKnown) {
      return;
    }

    deletePendingRef.current = true;
    setDeletePending(true);
    try {
      await deleteFeedMutation.mutateAsync({
        feedId: deleteTargetFeed.id,
        accountId: deleteTargetFeed.account_id,
        title: deleteTargetFeed.title,
        onSuccess: () => {
          setDeleteTargetFeed(null);
        },
      });
    } catch {
      return;
    } finally {
      deletePendingRef.current = false;
      setDeletePending(false);
    }
  };

  useEffect(() => {
    if (deleteTargetFeed !== null && !deleteTargetInCurrentAccount && !deletePending) {
      setDeleteTargetFeed(null);
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
  };
}
