import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FeedEditDialog } from "@/components/reader/feed-edit-dialog";
import { UnsubscribeDialog } from "@/components/reader/unsubscribe-feed-dialog";
import { useFeedArticleSummaries } from "@/components/subscriptions-index/hooks/use-feed-article-summaries";
import { useAccountArticles } from "@/hooks/use-articles";
import { useDeleteFeed } from "@/hooks/use-delete-feed";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { getCurrentDate } from "@/lib/datetime";
import {
  buildFolderNameByIdMap,
  buildSubscriptionReviewCandidates,
  resolveSubscriptionReviewReasonFactTranslationKey,
  resolveSubscriptionReviewSummaryTranslationKey,
} from "@/lib/subscriptions/subscription-review-candidates";
import {
  resolveSubscriptionUpdateFrequencyTier,
  SUBSCRIPTION_UPDATE_FREQUENCY_HIGH_THRESHOLD,
  SUBSCRIPTION_UPDATE_FREQUENCY_WINDOW_DAYS,
} from "@/lib/subscriptions/subscription-update-frequency";
import {
  buildFeedArticleSummaryMap,
  buildSubscriptionDecisionActions,
  buildSubscriptionDetailCandidate,
  buildSubscriptionListGroups,
  buildSubscriptionListRows,
  buildSubscriptionReviewCandidateMap,
  buildSubscriptionSummaryCards,
  buildSubscriptionsIndexSummary,
  formatSubscriptionDate,
  isSubscriptionRowFlagged,
  resolveSelectedSubscriptionCandidate,
  resolveSelectedSubscriptionDetailMetrics,
  resolveSelectedSubscriptionDisplayModeLabel,
  resolveSubscriptionsInventoryHeading,
  type SubscriptionDecisionActions,
} from "@/lib/subscriptions/subscriptions-index";
import type {
  SubscriptionDetailCandidate,
  SubscriptionListRow,
  SubscriptionSummaryCard,
} from "@/lib/subscriptions/subscriptions-index.types";
import { bindWindowEvents, createKeyboardEventListener } from "@/lib/window/window-events";
import { useUiStore } from "@/stores/ui-store";
import { SubscriptionsIndexPageView } from "./subscriptions-index-page-view";
import { useSubscriptionsIndexState } from "./use-subscriptions-index-state";

const REVIEW_CLOCK_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

function getViewportHeight(): number {
  return typeof window === "undefined" ? 0 : window.innerHeight;
}

function hasOpenNestedEscapeLayer(): boolean {
  return document.querySelector('[role="dialog"], [data-radix-popper-content-wrapper]') !== null;
}

export function SubscriptionsIndexPage() {
  const { t, i18n } = useTranslation("subscriptions");
  const { t: tr } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const closeSubscriptionsWorkspace = useUiStore((state) => state.closeSubscriptionsWorkspace);
  const showToast = useUiStore((state) => state.showToast);
  const subscriptionsWorkspace = useUiStore((state) => state.subscriptionsWorkspace);
  const { data: feeds = [] } = useFeeds(selectedAccountId);
  const { data: folders = [] } = useFolders(selectedAccountId);
  const { data: accountArticles = [] } = useAccountArticles(selectedAccountId);
  const { data: feedArticleSummaries = [] } = useFeedArticleSummaries(selectedAccountId);
  const deleteFeedMutation = useDeleteFeed();
  const [deleteTargetFeed, setDeleteTargetFeed] = useState<SubscriptionListRow["feed"] | null>(null);
  const deletePendingRef = useRef(false);
  const [deletePending, setDeletePending] = useState(false);
  const [editTargetFeed, setEditTargetFeed] = useState<SubscriptionListRow["feed"] | null>(null);
  const indexReturnState = subscriptionsWorkspace?.kind === "index" ? subscriptionsWorkspace.returnState : null;
  const scopedIndexReturnState =
    indexReturnState && indexReturnState.accountId === selectedAccountId ? indexReturnState : null;
  const [reviewClock, setReviewClock] = useState(() => getCurrentDate());
  const [viewportHeight, setViewportHeight] = useState(() => getViewportHeight());

  const candidates = useMemo(
    () =>
      buildSubscriptionReviewCandidates({
        feeds,
        folders,
        feedArticleSummaries,
        now: reviewClock,
        hiddenFeedIds: new Set(),
      }),
    [feedArticleSummaries, feeds, folders, reviewClock],
  );

  const candidateMap = useMemo(() => buildSubscriptionReviewCandidateMap(candidates), [candidates]);
  const feedArticleSummaryMap = useMemo(() => buildFeedArticleSummaryMap(feedArticleSummaries), [feedArticleSummaries]);
  const folderNameById = useMemo(() => buildFolderNameByIdMap(folders), [folders]);
  const rows = useMemo<SubscriptionListRow[]>(
    () => buildSubscriptionListRows({ feeds, candidateMap, feedArticleSummaryMap, folderNameById }),
    [candidateMap, feedArticleSummaryMap, feeds, folderNameById],
  );

  const state = useSubscriptionsIndexState(rows, {
    accountId: selectedAccountId,
    initialSummaryFilter: scopedIndexReturnState?.activeSummaryFilter,
    initialSelectedFeedId: scopedIndexReturnState?.selectedFeedId,
    initialExpandedGroups: scopedIndexReturnState?.expandedGroups,
    initialKeptFeedIds: scopedIndexReturnState?.keptFeedIds,
    initialDeferredFeedIds: scopedIndexReturnState?.deferredFeedIds,
    initialListScrollState: scopedIndexReturnState?.listScrollTop,
    viewportHeight,
  });
  const selectedMetrics = resolveSelectedSubscriptionDetailMetrics({
    selectedRow: state.selectedRow,
    articles: accountArticles,
    feedArticleSummaryMap,
  });
  const selectedCandidate = resolveSelectedSubscriptionCandidate({ selectedRow: state.selectedRow, candidateMap });
  const selectedDetailCandidate = useMemo<SubscriptionDetailCandidate | null>(
    () =>
      buildSubscriptionDetailCandidate({
        selectedRow: state.selectedRow,
        selectedCandidate,
        labels: {
          statusLabel: (labelKey) => t(`status_${labelKey}`),
          normalReason: t("detail_reason_normal"),
          summaryText: (summaryKey) => t(resolveSubscriptionReviewSummaryTranslationKey(summaryKey)),
          reasonFact: (fact) => t(resolveSubscriptionReviewReasonFactTranslationKey(fact.key), { count: fact.value }),
          reasonLabel: (reasonKey, staleDays) => t(`reason_${reasonKey}`, { count: staleDays ?? 0 }),
        },
      }),
    [selectedCandidate, state.selectedRow, t],
  );

  const selectedDisplayModeLabel = resolveSelectedSubscriptionDisplayModeLabel({
    selectedRow: state.selectedRow,
    labels: {
      default: tr("display_mode_default"),
      standard: tr("display_mode_standard"),
      preview: tr("display_mode_preview"),
    },
  });

  const groupedRows = useMemo(
    () => buildSubscriptionListGroups(state.visibleRows, t("meta_folder_none")),
    [state.visibleRows, t],
  );

  const summary = buildSubscriptionsIndexSummary({ feeds, candidates, feedArticleSummaryMap });
  const summaryCards = buildSubscriptionSummaryCards({
    summary,
    activeSummaryFilter: state.activeSummaryFilter,
    labels: {
      total: t("summary_total"),
      totalCaption: (count) => t("summary_total_caption", { count }),
      review: t("summary_review"),
      reviewCaption: (count) => t("summary_review_caption", { count }),
      stale: t("summary_stale"),
      staleCaption: (count) => t("summary_stale_caption", { count }),
      frequent: t("summary_frequent"),
      frequentCaption: (count) =>
        t("summary_frequent_caption", {
          count,
          days: SUBSCRIPTION_UPDATE_FREQUENCY_WINDOW_DAYS,
          threshold: SUBSCRIPTION_UPDATE_FREQUENCY_HIGH_THRESHOLD,
        }),
    },
  }) satisfies SubscriptionSummaryCard[];

  const inventoryHeading = resolveSubscriptionsInventoryHeading({
    activeSummaryFilter: state.activeSummaryFilter,
    summaryCards,
    defaultHeading: t("inventory_heading"),
  });

  const decisionActions = buildSubscriptionDecisionActions({
    selectedRow: state.selectedRow,
    isFlagged: state.selectedRow ? isSubscriptionRowFlagged(state.selectedRow.status) : false,
    labels: {
      keep: t("decision_keep"),
      defer: t("decision_defer"),
      delete: tc("delete"),
    },
    onKeep: (selectedRow) => {
      state.markSelectedFeedKept();
      showToast(t("decision_kept", { title: selectedRow.feed.title }));
    },
    onDefer: (selectedRow) => {
      state.markSelectedFeedDeferred();
      showToast(t("decision_deferred", { title: selectedRow.feed.title }));
    },
    onDelete: () => {
      if (state.selectedRow) {
        setDeleteTargetFeed(state.selectedRow.feed);
      }
    },
  }) satisfies SubscriptionDecisionActions | null;

  const managementActions =
    state.selectedRow && !decisionActions
      ? {
          editLabel: tc("edit"),
          deleteLabel: tc("delete"),
          onEdit: () => {
            if (state.selectedRow) {
              setEditTargetFeed(state.selectedRow.feed);
            }
          },
          onDelete: () => {
            if (state.selectedRow) {
              setDeleteTargetFeed(state.selectedRow.feed);
            }
          },
        }
      : null;

  const deleteTargetInCurrentAccount = deleteTargetFeed?.account_id === selectedAccountId;
  const isDeleteTargetKnown =
    deleteTargetFeed === null ||
    (deleteTargetInCurrentAccount && feeds.some((feed) => feed.id === deleteTargetFeed.id));

  const handleConfirmDelete = async () => {
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
    const refreshReviewClock = () => {
      setReviewClock(getCurrentDate());
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshReviewClock();
      }
    };

    const timerId = window.setInterval(refreshReviewClock, REVIEW_CLOCK_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(getViewportHeight());
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (deleteTargetFeed !== null && !deleteTargetInCurrentAccount && !deletePendingRef.current) {
      setDeleteTargetFeed(null);
    }
  }, [deleteTargetFeed, deleteTargetInCurrentAccount]);

  useLayoutEffect(() => {
    const handleKeyDown = createKeyboardEventListener((event) => {
      const target = event.target;
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.key !== "Escape" ||
        editTargetFeed !== null ||
        deleteTargetFeed !== null ||
        hasOpenNestedEscapeLayer() ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      closeSubscriptionsWorkspace();
    });

    return bindWindowEvents([{ type: "keydown", listener: handleKeyDown }]);
  }, [closeSubscriptionsWorkspace, deleteTargetFeed, editTargetFeed]);

  return (
    <>
      <SubscriptionsIndexPageView
        title={t("title")}
        subtitle={t("subtitle")}
        summaryCards={summaryCards}
        summaryLabels={{
          activeBadge: t("summary_active_badge"),
          staticBadge: t("summary_static_badge"),
          showFilterAriaLabel: (label) => t("summary_action_show_filter_aria", { label }),
          filterAll: t("summary_action_filter_all"),
          filter: t("summary_action_filter"),
          criteria: t("summary_criteria_chip"),
        }}
        reviewCriteriaLabel={t("summary_review_criteria")}
        inventoryHeading={inventoryHeading}
        detailHeading={t("detail_heading")}
        groups={groupedRows}
        selectedFeedId={state.selectedFeedId}
        selectedRow={state.selectedRow}
        selectedMetrics={selectedMetrics}
        selectedDetailCandidate={selectedDetailCandidate}
        emptyLabel={t("empty")}
        searchQuery={state.searchQuery}
        searchLabel={t("search_label")}
        searchPlaceholder={t("search_placeholder")}
        searchClearLabel={t("search_clear")}
        detailEmptyLabel={t("detail_empty")}
        statusLabels={{
          normal: t("status_normal"),
          attention_30d: t("status_attention_30d"),
          review: t("status_review"),
          stale_90d: t("status_stale_90d"),
          quiet_no_unread: t("status_quiet_no_unread"),
        }}
        reasonTooltipLabels={{
          no_articles: t("tooltip_reason_no_articles"),
          normal: t("detail_reason_normal"),
          attention_30d: t("tooltip_reason_attention_30d"),
          review: t("tooltip_reason_review"),
          stale_90d: t("tooltip_reason_stale_90d"),
          quiet_no_unread: t("tooltip_reason_quiet_no_unread"),
        }}
        formatUnreadCountLabel={(count) => t("meta_unread_count", { count })}
        formatLatestArticleLabel={(value) =>
          value
            ? t("meta_latest_article", { date: formatSubscriptionDate(value, i18n.language) })
            : t("meta_latest_article_none")
        }
        dateLocale={i18n.language}
        folderLabel={t("folder")}
        listScrollResetKey={state.listScrollResetKey}
        listScrollTop={state.listScrollTop}
        latestArticleLabel={t("latest_article")}
        latestArticleEmptyLabel={t("meta_latest_article_none")}
        updateFrequencyLabel={t("update_frequency")}
        formatUpdateFrequencyValue={(recentArticleCount) => {
          const tier = resolveSubscriptionUpdateFrequencyTier(recentArticleCount);
          if (tier === "none") {
            return t("update_frequency_value_none", { days: SUBSCRIPTION_UPDATE_FREQUENCY_WINDOW_DAYS });
          }
          return t("update_frequency_value", {
            tier: t(`update_frequency_tier_${tier}`),
            days: SUBSCRIPTION_UPDATE_FREQUENCY_WINDOW_DAYS,
            count: recentArticleCount,
          });
        }}
        unreadCountLabel={t("unread_count")}
        starredCountLabel={t("starred_count")}
        reasonHeading={t("detail_reason_heading")}
        reasonHint={t("detail_reason_hint")}
        recentArticlesHeading={t("detail_recent_articles")}
        feedUrlLabel={t("detail_feed_url")}
        contentUrlLabel={t("detail_content_url")}
        displayModeLabel={tr("display_mode")}
        displayModeValue={selectedDisplayModeLabel}
        decisionActions={decisionActions}
        managementActions={managementActions}
        backLabel={tc("back")}
        closeLabel={tc("close")}
        isGroupExpanded={state.isGroupExpanded}
        onSelectSummaryFilter={state.setActiveSummaryFilter}
        onSelectFeed={state.setSelectedFeedId}
        onListScrollTopChange={state.setListScrollTop}
        onSearchQueryChange={state.setSearchQuery}
        onToggleGroup={state.toggleGroup}
        onBack={() => closeSubscriptionsWorkspace()}
        onClose={() => closeSubscriptionsWorkspace()}
      />

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
          pending={deletePending || deleteFeedMutation.isPending}
          confirmDisabled={!isDeleteTargetKnown}
          confirmDisabledReason={t("delete_target_unavailable")}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTargetFeed(null);
            }
          }}
          onConfirm={() => {
            void handleConfirmDelete();
          }}
        />
      ) : null}
    </>
  );
}
