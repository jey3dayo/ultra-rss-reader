import { type Ref, useCallback, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { FeedEditDialog } from "@/components/reader/feed-edit-dialog";
import { UnsubscribeDialog } from "@/components/reader/unsubscribe-feed-dialog";
import { AppSelectPopup, Select, SelectItem, SelectTrigger, SelectValue, WorkspaceHeader } from "@/design-system";
import { useAccounts } from "@/hooks/use-accounts";
import { useAccountArticles } from "@/hooks/use-articles";
import { useFeedArticleSummaries } from "@/hooks/use-feed-article-summaries";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { useLocalFeedSyncStatuses } from "@/hooks/use-local-feed-sync-statuses";
import { copyValueToClipboard } from "@/lib/runtime/clipboard";
import type { SubscriptionSummaryFilterKey } from "@/lib/subscriptions/subscriptions-index.types";
import type { SubscriptionsWorkspaceReturnState } from "@/schemas/subscriptions-workspace";
import { useUiStore } from "@/stores/ui-store";
import { BulkUnsubscribeDialog } from "./bulk-unsubscribe-dialog";
import type { QueryLoadState } from "./hooks/subscriptions-index-load-state";
import { useSubscriptionsFeedDialogs } from "./hooks/use-subscriptions-feed-dialogs";
import { useSubscriptionsIndexEscape } from "./hooks/use-subscriptions-index-escape";
import { useSubscriptionsIndexViewProps } from "./hooks/use-subscriptions-index-view-props";
import { useSubscriptionsReviewClock } from "./hooks/use-subscriptions-review-clock";
import { SubscriptionsIndexPageView } from "./subscriptions-index-page-view";

function getViewportHeight(): number {
  return typeof window === "undefined" ? 0 : window.innerHeight;
}

function subscribeToViewport(onStoreChange: () => void): () => void {
  window.addEventListener("resize", onStoreChange);
  return () => {
    window.removeEventListener("resize", onStoreChange);
  };
}

function getViewportWidth(): number {
  return typeof window === "undefined" ? 0 : window.innerWidth;
}

function toQueryLoadState(query: {
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  data: unknown;
  refetch: () => Promise<unknown>;
}): QueryLoadState {
  return {
    pending: query.isPending,
    error: query.isError,
    hasData: query.data !== undefined,
    fetching: query.isFetching,
    retry: () => {
      void query.refetch();
    },
  };
}

type IndexHandle = {
  captureState: () => SubscriptionsWorkspaceReturnState;
  navigate: (filter: SubscriptionSummaryFilterKey) => void;
  hasOpenDialog: boolean;
};

export function SubscriptionsIndexPage() {
  const { t } = useTranslation("subscriptions");
  const { t: tc } = useTranslation("common");
  const { data: accounts = [], isSuccess, isError, isFetching } = useAccounts();
  const workspace = useUiStore((state) => state.subscriptionsWorkspace);
  const readerAccountId = useUiStore((state) => state.selectedAccountId);
  const [selectOpen, setSelectOpen] = useState(false);
  const contentRef = useRef<IndexHandle>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const workspaceScrollRef = useRef<HTMLDivElement>(null);
  const viewportWidth = useSyncExternalStore(subscribeToViewport, getViewportWidth);
  const accountId = workspace?.accountId ?? null;
  const request = workspace?.navigationRequest;
  const currentAccount = accounts.find((account) => account.id === accountId);
  const canSelectAccount = Boolean(currentAccount) && accounts.length > 1;

  useEffect(() => {
    if (!canSelectAccount) setSelectOpen(false);
  }, [canSelectAccount]);

  const close = () => useUiStore.getState().closeSubscriptionsWorkspace(contentRef.current?.captureState());
  const switchAccount = useCallback((id: string | null, preserveRequest = false) => {
    const current = contentRef.current;
    if (current) useUiStore.getState().switchSubscriptionsAccount(id, current.captureState(), preserveRequest);
  }, []);

  useEffect(() => {
    if (!request || !contentRef.current || useUiStore.getState().subscriptionsWorkspace?.navigationRequest !== request)
      return;
    const current = contentRef.current;
    if (current.hasOpenDialog) {
      useUiStore.getState().consumeSubscriptionsNavigationRequest(request);
      useUiStore.getState().showToast({
        message: t("fetch_error_navigation_blocked_dialog"),
        severity: "warning",
        persistent: true,
        ...(request.retryAction ? { actions: [request.retryAction] } : {}),
      });
      return;
    }
    if (request.accountId !== accountId) {
      switchAccount(request.accountId, true);
      return;
    }
    current.navigate(request.summaryFilter);
    useUiStore.getState().consumeSubscriptionsNavigationRequest(request);
  }, [request, accountId, t, switchAccount]);

  useEffect(() => {
    if (
      !isSuccess ||
      isError ||
      isFetching ||
      request ||
      !workspace ||
      accounts.some((account) => account.id === accountId)
    )
      return;
    const fallback = accounts.find((account) => account.id === readerAccountId)?.id ?? accounts[0]?.id ?? null;
    if (fallback !== accountId) switchAccount(fallback);
  }, [accounts, accountId, isSuccess, isError, isFetching, readerAccountId, request, workspace, switchAccount]);

  return (
    <div
      ref={workspaceScrollRef}
      data-testid="subscriptions-workspace-scroll-region"
      className="flex h-dvh max-h-dvh min-h-0 flex-1 flex-col overflow-y-auto bg-background lg:overflow-hidden"
    >
      <WorkspaceHeader
        title={t("title")}
        closeLabel={tc("close")}
        onClose={close}
        actions={
          currentAccount ? (
            accounts.length > 1 ? (
              <Select
                value={accountId}
                open={selectOpen}
                onOpenChange={setSelectOpen}
                onValueChange={(value) => {
                  if (value && value !== accountId) {
                    switchAccount(value);
                    triggerRef.current?.focus();
                  }
                }}
              >
                <SelectTrigger
                  ref={triggerRef}
                  aria-label={t("account_select_label")}
                  className="min-w-0 max-w-[min(40vw,16rem)] *:data-[slot=select-value]:min-w-0"
                >
                  <SelectValue>
                    {() => <span className="block min-w-0 truncate">{currentAccount.name}</span>}
                  </SelectValue>
                </SelectTrigger>
                <AppSelectPopup>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </AppSelectPopup>
              </Select>
            ) : (
              <span className="max-w-[min(40vw,16rem)] truncate text-sm">{currentAccount.name}</span>
            )
          ) : null
        }
      />
      <SubscriptionsIndexPageForAccount
        key={accountId ?? "no-account"}
        ref={contentRef}
        accountId={accountId}
        selectOpen={selectOpen && canSelectAccount}
        workspaceScrollRef={workspaceScrollRef}
        viewportWidth={viewportWidth}
        onClose={close}
      />
    </div>
  );
}

function SubscriptionsIndexPageForAccount({
  ref,
  accountId: selectedAccountId,
  selectOpen,
  workspaceScrollRef,
  viewportWidth,
  onClose,
}: {
  ref: Ref<IndexHandle>;
  accountId: string | null;
  selectOpen: boolean;
  workspaceScrollRef: React.RefObject<HTMLDivElement | null>;
  viewportWidth: number;
  onClose: () => void;
}) {
  const { t } = useTranslation("subscriptions");
  const showToast = useUiStore((state) => state.showToast);
  const subscriptionsWorkspace = useUiStore((state) => state.subscriptionsWorkspace);
  const feedQuery = useFeeds(selectedAccountId);
  const feeds = feedQuery.data ?? [];
  const { data: folders = [] } = useFolders(selectedAccountId);
  const { data: accountArticles = [] } = useAccountArticles(selectedAccountId);
  const summaryQuery = useFeedArticleSummaries(selectedAccountId);
  const feedArticleSummaries = summaryQuery.data ?? [];
  const localFeedSync = useLocalFeedSyncStatuses(selectedAccountId);
  const {
    deleteTargetFeed,
    editTargetFeed,
    setDeleteTargetFeed,
    setEditTargetFeed,
    isDeleteTargetKnown,
    confirmDelete,
    unsubscribeDialogPending,
    unsubscribeFailureMessage,
  } = useSubscriptionsFeedDialogs({ selectedAccountId, feeds });
  const indexReturnState = subscriptionsWorkspace?.kind === "index" ? subscriptionsWorkspace.returnState : null;
  const scopedIndexReturnState =
    indexReturnState && indexReturnState.accountId === selectedAccountId ? indexReturnState : null;
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkDialogSession, setBulkDialogSession] = useState(0);
  const bulkToggleRef = useRef<HTMLButtonElement>(null);
  const focusBulkToggleAfterCloseRef = useRef(false);
  const reviewClock = useSubscriptionsReviewClock();
  const viewportHeight = useSyncExternalStore(subscribeToViewport, getViewportHeight);

  const viewProps = useSubscriptionsIndexViewProps({
    feeds,
    folders,
    accountArticles,
    feedArticleSummaries,
    reviewClock,
    viewportHeight,
    viewportWidth,
    workspaceScrollRef,
    scopedIndexReturnState,
    selectedAccountId,
    isLocalAccount: localFeedSync.isLocalAccount,
    feedSyncStatuses: localFeedSync.statusQuery.data,
    feedSyncStatusesPending: localFeedSync.statusQuery.isPending,
    feedSyncStatusesError: localFeedSync.statusQuery.isError,
    feedLoad: toQueryLoadState(feedQuery),
    summaryLoad: toQueryLoadState(summaryQuery),
    rowsPending:
      feedQuery.isPending ||
      summaryQuery.isPending ||
      localFeedSync.accountsPending ||
      (localFeedSync.isLocalAccount && localFeedSync.statusQuery.isPending),
    onRetryFeed: localFeedSync.retryFeed,
    retryOutcomeFor: localFeedSync.retryOutcomeFor,
    onEditFeed: (feedId) => {
      const feed = feeds.find((item) => item.id === feedId);
      if (feed) setEditTargetFeed(feed);
    },
    isRetryingFeed: localFeedSync.isRetryingFeed,
    onCopyDiagnosticId: (diagnosticId) => {
      void copyValueToClipboard(diagnosticId, {
        onSuccess: () => showToast(t("detail_fetch_error_diagnostic_copied")),
        onError: () =>
          showToast({ message: t("detail_fetch_error_diagnostic_copy_failed"), severity: "error", persistent: true }),
      });
    },
    setDeleteTargetFeed,
    setEditTargetFeed,
    onRequestBulkUnsubscribe: () => {
      setBulkDialogSession((session) => session + 1);
      setBulkDialogOpen(true);
    },
    bulkToggleRef,
  });
  const hasOpenDialog = editTargetFeed !== null || deleteTargetFeed !== null || bulkDialogOpen;

  useEffect(() => {
    if (!bulkDialogOpen && focusBulkToggleAfterCloseRef.current) {
      focusBulkToggleAfterCloseRef.current = false;
      bulkToggleRef.current?.focus();
    }
  }, [bulkDialogOpen]);

  useImperativeHandle(ref, () => ({
    captureState: viewProps.captureState,
    navigate: viewProps.navigateToSummaryFilter,
    hasOpenDialog,
  }));
  useSubscriptionsIndexEscape(
    hasOpenDialog,
    onClose,
    selectOpen,
    { active: viewProps.bulk.selectionMode, end: viewProps.bulk.endSelection },
    viewProps.search,
  );

  return (
    <>
      <SubscriptionsIndexPageView {...viewProps.viewProps} />

      {editTargetFeed ? (
        <FeedEditDialog
          feed={editTargetFeed}
          accountScope="subscriptions"
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setEditTargetFeed(null);
            }
          }}
        />
      ) : null}

      <BulkUnsubscribeDialog
        key={bulkDialogSession}
        open={bulkDialogOpen}
        accountId={selectedAccountId}
        targets={viewProps.bulk.targets}
        onSettled={viewProps.bulk.applyResult}
        onClose={({ allSucceeded }) => {
          focusBulkToggleAfterCloseRef.current = allSucceeded;
          setBulkDialogOpen(false);
        }}
      />

      {deleteTargetFeed ? (
        <UnsubscribeDialog
          feed={deleteTargetFeed}
          open={true}
          pending={unsubscribeDialogPending}
          confirmDisabled={!isDeleteTargetKnown}
          confirmDisabledReason={t("delete_target_unavailable")}
          errorMessage={unsubscribeFailureMessage}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTargetFeed(null);
            }
          }}
          onConfirm={() => {
            void confirmDelete(viewProps.purgeUnsubscribedFeed);
          }}
        />
      ) : null}
    </>
  );
}
