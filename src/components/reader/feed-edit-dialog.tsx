import { useId, useRef, useState } from "react";
import { useFeedEditDialogController } from "@/components/reader/hooks/feed-dialogs/use-feed-edit-dialog-controller";
import { useFeedEditDialogViewProps } from "@/components/reader/hooks/feed-dialogs/use-feed-edit-dialog-view-props";
import { useDeleteFeed } from "@/hooks/use-delete-feed";
import type { FeedEditDialogProps } from "./feed-edit-dialog.types";
import { FeedEditDialogView } from "./feed-edit-dialog-view";
import { UnsubscribeDialog } from "./unsubscribe-feed-dialog";

export function FeedEditDialog({ feed, open, onOpenChange }: FeedEditDialogProps) {
  const folderLabelId = useId();
  const [unsubscribeOpen, setUnsubscribeOpen] = useState(false);
  const [unsubscribePending, setUnsubscribePending] = useState(false);
  const unsubscribePendingRef = useRef(false);
  const deleteFeedMutation = useDeleteFeed();
  const controller = useFeedEditDialogController({
    feed,
    open,
    onOpenChange,
  });
  const viewProps = useFeedEditDialogViewProps({
    open,
    feedSiteUrl: feed.site_url,
    feedUrl: feed.url,
    onOpenChange,
    folderLabelId,
    controller,
  });

  const handleConfirmUnsubscribe = async () => {
    if (unsubscribePendingRef.current) {
      return;
    }

    unsubscribePendingRef.current = true;
    setUnsubscribePending(true);
    try {
      await deleteFeedMutation.mutateAsync({
        feedId: feed.id,
        accountId: feed.account_id,
        title: feed.title,
        onSuccess: () => {
          setUnsubscribeOpen(false);
          onOpenChange(false);
        },
      });
    } catch {
      return;
    } finally {
      unsubscribePendingRef.current = false;
      setUnsubscribePending(false);
    }
  };

  return (
    <>
      <FeedEditDialogView {...viewProps} onRequestUnsubscribe={() => setUnsubscribeOpen(true)} />
      <UnsubscribeDialog
        feed={feed}
        open={unsubscribeOpen}
        pending={unsubscribePending || deleteFeedMutation.isPending}
        onOpenChange={setUnsubscribeOpen}
        onConfirm={handleConfirmUnsubscribe}
      />
    </>
  );
}
