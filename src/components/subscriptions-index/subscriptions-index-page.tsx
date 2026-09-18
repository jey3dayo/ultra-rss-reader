import { useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { FeedEditDialog } from "@/components/reader/feed-edit-dialog";
import { UnsubscribeDialog } from "@/components/reader/unsubscribe-feed-dialog";
import { useAccountArticles } from "@/hooks/use-articles";
import { useFeedArticleSummaries } from "@/hooks/use-feed-article-summaries";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
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
import { useUiStore } from "@/stores/ui-store";
import { useSubscriptionsFeedDialogs } from "./hooks/use-subscriptions-feed-dialogs";
import { useSubscriptionsIndexEscape } from "./hooks/use-subscriptions-index-escape";
import { useSubscriptionsReviewClock } from "./hooks/use-subscriptions-review-clock";
import { SubscriptionsIndexPageView } from "./subscriptions-index-page-view";
import { useSubscriptionsIndexState } from "./use-subscriptions-index-state";

function getViewportHeight(): number {
  return typeof window === "undefined" ? 0 : window.innerHeight;
}

function subscribeToViewportHeight(onStoreChange: () => void): () => void {
  window.addEventListener("resize", onStoreChange);
  return () => {
    window.removeEventListener("resize", onStoreChange);
  };
}

// react-doctor-disable-next-line react-doctor/no-giant-component -- accepted risk (component split tracked separately), docs/react-doctor-warning-classification-300.md:416
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

  useSubscriptionsIndexEscape(editTargetFeed !== null || deleteTargetFeed !== null, closeSubscriptionsWorkspace);

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
