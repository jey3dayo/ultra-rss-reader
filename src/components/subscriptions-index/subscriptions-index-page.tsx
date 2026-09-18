import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { FeedEditDialog } from "@/components/reader/feed-edit-dialog";
import { UnsubscribeDialog } from "@/components/reader/unsubscribe-feed-dialog";
import { useAccountArticles } from "@/hooks/use-articles";
import { useFeedArticleSummaries } from "@/hooks/use-feed-article-summaries";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { useUiStore } from "@/stores/ui-store";
import { useSubscriptionsFeedDialogs } from "./hooks/use-subscriptions-feed-dialogs";
import { useSubscriptionsIndexEscape } from "./hooks/use-subscriptions-index-escape";
import { useSubscriptionsIndexViewProps } from "./hooks/use-subscriptions-index-view-props";
import { useSubscriptionsReviewClock } from "./hooks/use-subscriptions-review-clock";
import { SubscriptionsIndexPageView } from "./subscriptions-index-page-view";

function getViewportHeight(): number {
  return typeof window === "undefined" ? 0 : window.innerHeight;
}

function subscribeToViewportHeight(onStoreChange: () => void): () => void {
  window.addEventListener("resize", onStoreChange);
  return () => {
    window.removeEventListener("resize", onStoreChange);
  };
}

export function SubscriptionsIndexPage() {
  const { t } = useTranslation("subscriptions");
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const closeSubscriptionsWorkspace = useUiStore((state) => state.closeSubscriptionsWorkspace);
  const subscriptionsWorkspace = useUiStore((state) => state.subscriptionsWorkspace);
  const { data: feeds = [] } = useFeeds(selectedAccountId);
  const { data: folders = [] } = useFolders(selectedAccountId);
  const { data: accountArticles = [] } = useAccountArticles(selectedAccountId);
  const { data: feedArticleSummaries = [] } = useFeedArticleSummaries(selectedAccountId);
  const {
    deleteTargetFeed,
    editTargetFeed,
    setDeleteTargetFeed,
    setEditTargetFeed,
    isDeleteTargetKnown,
    confirmDelete,
    unsubscribeDialogPending,
  } = useSubscriptionsFeedDialogs({ selectedAccountId, feeds });
  const indexReturnState = subscriptionsWorkspace?.kind === "index" ? subscriptionsWorkspace.returnState : null;
  const scopedIndexReturnState =
    indexReturnState && indexReturnState.accountId === selectedAccountId ? indexReturnState : null;
  const reviewClock = useSubscriptionsReviewClock();
  const viewportHeight = useSyncExternalStore(subscribeToViewportHeight, getViewportHeight);

  const viewProps = useSubscriptionsIndexViewProps({
    feeds,
    folders,
    accountArticles,
    feedArticleSummaries,
    reviewClock,
    viewportHeight,
    scopedIndexReturnState,
    selectedAccountId,
    closeSubscriptionsWorkspace,
    setDeleteTargetFeed,
    setEditTargetFeed,
  });

  useSubscriptionsIndexEscape(editTargetFeed !== null || deleteTargetFeed !== null, closeSubscriptionsWorkspace);

  return (
    <>
      <SubscriptionsIndexPageView {...viewProps} />

      {editTargetFeed ? (
        <FeedEditDialog
          feed={editTargetFeed}
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setEditTargetFeed(null);
            }
          }}
        />
      ) : null}

      {deleteTargetFeed ? (
        <UnsubscribeDialog
          feed={deleteTargetFeed}
          open={true}
          pending={unsubscribeDialogPending}
          confirmDisabled={!isDeleteTargetKnown}
          confirmDisabledReason={t("delete_target_unavailable")}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTargetFeed(null);
            }
          }}
          onConfirm={() => {
            void confirmDelete();
          }}
        />
      ) : null}
    </>
  );
}
