import { useEffect, useId, useRef, useState } from "react";
import { useFeedEditDialogController } from "@/components/reader/hooks/feed-dialogs/use-feed-edit-dialog-controller";
import { useFeedEditDialogViewProps } from "@/components/reader/hooks/feed-dialogs/use-feed-edit-dialog-view-props";
import { useDeleteFeed } from "@/hooks/use-delete-feed";
import { useUiStore } from "@/stores/ui-store";
import type { FeedEditDialogProps } from "./feed-edit-dialog.types";
import { FeedEditDialogView } from "./feed-edit-dialog-view";
import { UnsubscribeDialog } from "./unsubscribe-feed-dialog";

export function FeedEditDialog({ feed, open, onOpenChange }: FeedEditDialogProps) {
  const folderLabelId = useId();
  const [unsubscribeOpen, setUnsubscribeOpen] = useState(false);
  const deleteFeedMutation = useDeleteFeed();
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const isStale = feed.account_id !== selectedAccountId;

  // Shared claim covering both save (handleSubmit, in the controller) and unsubscribe
  // (handleConfirmUnsubscribe, below), so the two mutually exclusive operations can
  // never run at once, and a stale-account close never interrupts one in flight.
  const operationActiveRef = useRef(false);
  const [operationActive, setOperationActive] = useState(false);

  const claimOperation = (): boolean => {
    if (operationActiveRef.current) {
      return false;
    }
    // Read the store at execution time rather than relying on the `selectedAccountId`
    // captured above: a stale closure (e.g. a handler created before an account switch)
    // must still be stopped from starting a new operation against the old account.
    if (feed.account_id !== useUiStore.getState().selectedAccountId) {
      return false;
    }
    operationActiveRef.current = true;
    setOperationActive(true);
    return true;
  };

  const releaseOperation = () => {
    operationActiveRef.current = false;
    setOperationActive(false);
  };

  const controller = useFeedEditDialogController({
    feed,
    open,
    onOpenChange,
    claimOperation,
    releaseOperation,
  });
  const viewProps = useFeedEditDialogViewProps({
    open,
    feedSiteUrl: feed.site_url,
    feedUrl: feed.url,
    onOpenChange,
    folderLabelId,
    controller,
  });

  // Close a stale dialog (its feed's account is no longer selected) once no operation
  // is running against it. `operationActive` is in the dependency array so this
  // re-evaluates and closes as soon as an in-flight save or unsubscribe settles.
  useEffect(() => {
    if (open && isStale && !operationActive) {
      // react-doctor-disable-next-line react-doctor/no-prop-callback-in-effect -- accepted risk (owner-close request), .claude/rules/quality-policy.md "Prop Callback In Effect Findings"
      onOpenChange(false);
    }
  }, [open, isStale, operationActive, onOpenChange]);

  const handleConfirmUnsubscribe = async () => {
    if (!claimOperation()) {
      return;
    }

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
      releaseOperation();
    }
  };

  return (
    <>
      <FeedEditDialogView
        {...viewProps}
        onRequestUnsubscribe={() => {
          if (isStale) {
            return;
          }
          setUnsubscribeOpen(true);
        }}
      />
      <UnsubscribeDialog
        feed={feed}
        open={unsubscribeOpen}
        pending={operationActive || deleteFeedMutation.isPending}
        onOpenChange={setUnsubscribeOpen}
        onConfirm={handleConfirmUnsubscribe}
      />
    </>
  );
}
