import type { ComponentProps, RefObject } from "react";
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type {
  ArticleDto,
  FeedArticleSummaryDto,
  FeedDto,
  FolderDto,
  LocalFeedSyncStatusDto,
} from "@/api/tauri-commands";
import type { FeedRetryOutcomeKind } from "@/hooks/use-local-feed-sync-statuses";
import {
  buildFolderNameByIdMap,
  buildSubscriptionReviewCandidates,
  resolveSubscriptionReviewReasonFactTranslationKey,
  resolveSubscriptionReviewSummaryTranslationKey,
} from "@/lib/subscriptions/subscription-review-candidates";
import {
  resolveSubscriptionUpdatePace,
  SUBSCRIPTION_OVERLOADED_RECENT_ARTICLE_THRESHOLD,
  SUBSCRIPTION_OVERLOADED_UNREAD_THRESHOLD,
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
  SubscriptionSummaryCard,
} from "@/lib/subscriptions/subscriptions-index.types";
import type { SubscriptionsWorkspaceReturnState } from "@/schemas/subscriptions-workspace";
import { useUiStore } from "@/stores/ui-store";
import type { SubscriptionsIndexPageView } from "../subscriptions-index-page-view";
import { useSubscriptionsIndexState } from "../use-subscriptions-index-state";
import {
  attachLocalFeedFetchErrors,
  buildLocalFetchErrorSummary,
  resolveSubscriptionsEmptyLabel,
} from "./subscriptions-index-fetch-error-summary";
import {
  applySummaryCardDataState,
  isQueryUnavailable,
  type QueryLoadState,
  resolveListLoadState,
} from "./subscriptions-index-load-state";

type SubscriptionsIndexPageViewProps = ComponentProps<typeof SubscriptionsIndexPageView>;

type UseSubscriptionsIndexViewPropsParams = {
  feeds: FeedDto[];
  folders: FolderDto[];
  accountArticles: ArticleDto[];
  feedArticleSummaries: FeedArticleSummaryDto[];
  reviewClock: Date;
  viewportHeight: number;
  viewportWidth: number;
  workspaceScrollRef: RefObject<HTMLDivElement | null>;
  scopedIndexReturnState: SubscriptionsWorkspaceReturnState | null;
  selectedAccountId: string | null;
  isLocalAccount: boolean;
  feedSyncStatuses: LocalFeedSyncStatusDto[] | undefined;
  feedSyncStatusesPending: boolean;
  feedSyncStatusesError: boolean;
  feedLoad: QueryLoadState;
  summaryLoad: QueryLoadState;
  rowsPending: boolean;
  onRetryFeed: (feedId: string) => void;
  retryOutcomeFor: (feedId: string) => FeedRetryOutcomeKind | null;
  onEditFeed: (feedId: string) => void;
  isRetryingFeed: (feedId: string) => boolean;
  onCopyDiagnosticId: (diagnosticId: string) => void;
  setDeleteTargetFeed: (feed: FeedDto | null) => void;
  setEditTargetFeed: (feed: FeedDto | null) => void;
  onRequestBulkUnsubscribe: () => void;
  bulkToggleRef: RefObject<HTMLButtonElement | null>;
};

export function useSubscriptionsIndexViewProps({
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
  isLocalAccount,
  feedSyncStatuses,
  feedSyncStatusesPending,
  feedSyncStatusesError,
  feedLoad,
  summaryLoad,
  rowsPending,
  onRetryFeed,
  retryOutcomeFor,
  onEditFeed,
  isRetryingFeed,
  onCopyDiagnosticId,
  setDeleteTargetFeed,
  setEditTargetFeed,
  onRequestBulkUnsubscribe,
  bulkToggleRef,
}: UseSubscriptionsIndexViewPropsParams) {
  const { t, i18n } = useTranslation("subscriptions");
  const { t: tr } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const showToast = useUiStore((state) => state.showToast);

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
  const rows = useMemo(
    () =>
      attachLocalFeedFetchErrors(
        buildSubscriptionListRows({ feeds, candidateMap, feedArticleSummaryMap, folderNameById }),
        feeds,
        feedSyncStatuses,
        isLocalAccount,
      ),
    [candidateMap, feedArticleSummaryMap, feedSyncStatuses, feeds, folderNameById, isLocalAccount],
  );

  const state = useSubscriptionsIndexState(rows, {
    initialSummaryFilter: scopedIndexReturnState?.activeSummaryFilter,
    initialSelectedFeedId: scopedIndexReturnState?.selectedFeedId,
    initialExpandedGroups: scopedIndexReturnState?.expandedGroups,
    initialKeptFeedIds: scopedIndexReturnState?.keptFeedIds,
    initialSearchQuery: scopedIndexReturnState?.searchQuery,
    initialListScrollState: scopedIndexReturnState?.listScrollTop,
    viewportHeight,
    viewportWidth,
    selectionReady: !rowsPending,
  });
  const scrollRegionRef = useRef<HTMLDivElement | null>(null);
  const preservePendingScroll = rowsPending && scopedIndexReturnState !== null;
  const captureState = (): SubscriptionsWorkspaceReturnState => ({
    accountId: selectedAccountId,
    activeSummaryFilter: state.activeSummaryFilter,
    selectedFeedId: state.selectedFeedId,
    expandedGroups: state.expandedGroups,
    listScrollTop: {
      ...state.listScrollState,
      ...(preservePendingScroll ? {} : { viewportWidth }),
      scrollTop: Math.max(
        0,
        preservePendingScroll
          ? state.listScrollState.scrollTop
          : ((viewportWidth < 1024 ? workspaceScrollRef.current : scrollRegionRef.current)?.scrollTop ??
              state.listScrollState.scrollTop),
      ),
    },
    keptFeedIds: [...state.keptFeedIds],
    searchQuery: state.searchQuery,
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
  const builtSummaryCards = buildSubscriptionSummaryCards({
    summary,
    activeSummaryFilter: state.activeSummaryFilter,
    labels: {
      total: t("summary_total"),
      totalCaption: (count) => t("summary_total_caption", { count }),
      stale: t("summary_stale"),
      staleCaption: (count) => t("summary_stale_caption", { count }),
      frequent: t("summary_frequent"),
      frequentCaption: (count) =>
        t("summary_frequent_caption", {
          count,
          days: SUBSCRIPTION_UPDATE_FREQUENCY_WINDOW_DAYS,
          threshold: SUBSCRIPTION_OVERLOADED_RECENT_ARTICLE_THRESHOLD,
          unread: SUBSCRIPTION_OVERLOADED_UNREAD_THRESHOLD,
        }),
    },
  });
  const summaryCards = applySummaryCardDataState({
    cards: builtSummaryCards,
    accountSelected: selectedAccountId !== null,
    feeds: feedLoad,
    summaries: summaryLoad,
    labels: { loading: t("summary_status_loading"), unavailable: t("summary_status_unavailable") },
  }) satisfies SubscriptionSummaryCard[];
  const fetchErrorSummary = buildLocalFetchErrorSummary({
    isLocalAccount,
    feeds,
    statuses: feedSyncStatuses,
    statusesPending: feedSyncStatusesPending,
    statusesError: feedSyncStatusesError,
    feedListPending: feedLoad.pending,
    feedListError: feedLoad.error,
    activeSummaryFilter: state.activeSummaryFilter,
    labels: {
      label: t("summary_fetch_errors"),
      loading: t("summary_status_loading"),
      unavailable: t("summary_status_unavailable"),
      unknown: t("summary_fetch_errors_unknown"),
      none: t("summary_fetch_errors_none"),
      caption: (count) => t("summary_fetch_errors_caption", { count }),
    },
  });
  if (fetchErrorSummary.card) summaryCards.unshift(fetchErrorSummary.card);

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
      delete: tc("delete"),
    },
    onKeep: (selectedRow) => {
      state.markSelectedFeedKept();
      showToast(t("decision_kept", { title: selectedRow.feed.title }));
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

  const viewProps = {
    summaryCards,
    summaryLabels: {
      activeBadge: t("summary_active_badge"),
      staticBadge: t("summary_static_badge"),
      showFilterAriaLabel: (label) => t("summary_action_show_filter_aria", { label }),
      filterAll: t("summary_action_filter_all"),
      filter: t("summary_action_filter"),
    },
    inventoryHeading,
    detailHeading: t("detail_heading"),
    groups: groupedRows,
    selectedFeedId: state.selectedFeedId,
    selectedRow: state.selectedRow,
    selectedMetrics,
    selectedDetailCandidate,
    selectedFetchError: state.selectedRow?.fetchError ?? null,
    fetchErrorLabels: {
      heading: t("detail_fetch_error_heading"),
      lastAttempt: t("detail_fetch_error_last_failed"),
      copyDiagnosticId: t("detail_fetch_error_copy_diagnostic_id"),
      retry: t("detail_fetch_error_retry"),
      retrying: t("detail_fetch_error_retrying"),
      retryOutcome: (kind: FeedRetryOutcomeKind) => {
        switch (kind) {
          case "succeeded":
            return t("fetch_error_retry_succeeded");
          case "busy":
            return t("fetch_error_retry_busy");
          case "incomplete":
            return t("fetch_error_retry_incomplete");
          case "failed":
            return t("detail_fetch_error_retry_failed");
          case "refresh-failed":
            return t("fetch_error_refresh_failed");
        }
      },
      editFeedUrl: t("detail_fetch_error_edit_feed_url"),
      reason: (kind: NonNullable<LocalFeedSyncStatusDto["error_kind"]>) => t(`fetch_error_reason_${kind}`),
    },
    selectedRetryOutcome: state.selectedRow ? retryOutcomeFor(state.selectedRow.feed.id) : null,
    onRetryFeed,
    onEditFeed: () => {
      if (state.selectedRow) onEditFeed(state.selectedRow.feed.id);
    },
    isRetryingFeed,
    onCopyDiagnosticId,
    listLoadState: resolveListLoadState({
      accountSelected: selectedAccountId !== null,
      rowsPending,
      feeds: feedLoad,
      labels: { loading: t("list_loading"), failure: t("list_load_failed"), retry: t("load_retry") },
    }),
    summaryLoadFailure: summaryLoad.error
      ? {
          message: t("summary_load_failed"),
          retryLabel: t("load_retry"),
          retrying: summaryLoad.fetching,
          onRetry: summaryLoad.retry,
        }
      : null,
    emptyLabel: resolveSubscriptionsEmptyLabel(
      state.activeSummaryFilter,
      fetchErrorSummary.failedFeedCount,
      isQueryUnavailable(summaryLoad),
      {
        default: t("empty"),
        fetchErrorsUnknown: t("summary_fetch_errors_unknown"),
        fetchErrorsEmpty: t("summary_fetch_errors_empty"),
        summariesUnavailable: t("empty_summary_unavailable"),
      },
    ),
    searchQuery: state.searchQuery,
    searchLabel: t("search_label"),
    searchPlaceholder: t("search_placeholder"),
    searchClearLabel: t("search_clear"),
    detailEmptyLabel: t("detail_empty"),
    statusLabels: {
      normal: t("status_normal"),
      attention_30d: t("status_attention_30d"),
      review: t("status_review"),
      stale_90d: t("status_stale_90d"),
      quiet_no_unread: t("status_quiet_no_unread"),
    },
    reasonTooltipLabels: {
      no_articles: t("tooltip_reason_no_articles"),
      normal: t("detail_reason_normal"),
      attention_30d: t("tooltip_reason_attention_30d"),
      review: t("tooltip_reason_review"),
      stale_90d: t("tooltip_reason_stale_90d"),
      quiet_no_unread: t("tooltip_reason_quiet_no_unread"),
      fetch_error: t("status_fetch_error"),
    },
    fetchErrorLabel: t("status_fetch_error"),
    formatUnreadCountLabel: (count) => t("meta_unread_count", { count }),
    formatLatestArticleLabel: (value) =>
      value
        ? t("meta_latest_article", { date: formatSubscriptionDate(value, i18n.language) })
        : t("meta_latest_article_none"),
    dateLocale: i18n.language,
    folderLabel: t("folder"),
    listScrollResetKey: state.listScrollResetKey,
    listScrollTop: state.listScrollTop,
    scrollRegionRef,
    workspaceScrollRef,
    viewportWidth,
    scrollReady: !rowsPending || (!feedLoad.pending && !feedLoad.error && feeds.length === 0),
    bulkSelection: {
      mode: state.bulkSelectionMode,
      checkedFeedIds: state.checkedFeedIds,
      keptFeedIds: state.keptFeedIds,
      checkedCount: state.checkedCount,
      hiddenCheckedCount: state.hiddenCheckedCount,
      allVisibleCheckState: state.allVisibleCheckState,
      skippedKeptCount: state.skippedKeptCount,
      toggleButtonRef: bulkToggleRef,
      labels: {
        start: t("bulk_select_start"),
        end: t("bulk_select_end"),
        selectAllVisible: (count) => t("bulk_select_all_visible", { count }),
        selectAllVisibleAria: t("bulk_select_all_visible_aria"),
        skippedKept: (count) => t("bulk_skipped_kept", { count }),
        rowSelectAria: (title) => t("bulk_row_select_aria", { title }),
        keptChip: t("bulk_kept_chip"),
        selectedCount: (count) => t("bulk_selected_count", { count }),
        selectedCountHidden: (count, hidden) => t("bulk_selected_count_hidden", { count, hidden }),
        unsubscribeAction: t("bulk_unsubscribe_action"),
      },
      onStart: state.startBulkSelection,
      onEnd: state.endBulkSelection,
      onToggleFeed: state.toggleFeedChecked,
      onToggleAllVisible: state.toggleAllVisibleChecked,
      onRequestUnsubscribe: onRequestBulkUnsubscribe,
    },
    latestArticleLabel: t("latest_article"),
    latestArticleEmptyLabel: t("meta_latest_article_none"),
    updateFrequencyLabel: t("update_frequency"),
    formatUpdateFrequencyValue: (recentArticleCount) => {
      const pace = resolveSubscriptionUpdatePace(recentArticleCount);
      if (pace.unit === "none") {
        return t("update_frequency_value_none", { days: SUBSCRIPTION_UPDATE_FREQUENCY_WINDOW_DAYS });
      }
      return t(`update_frequency_value_per_${pace.unit}`, {
        count: pace.count,
        total: recentArticleCount,
        days: SUBSCRIPTION_UPDATE_FREQUENCY_WINDOW_DAYS,
      });
    },
    overloadedBadgeLabel: t("update_frequency_overloaded_badge"),
    unreadCountLabel: t("unread_count"),
    starredCountLabel: t("starred_count"),
    reasonHeading: t("detail_reason_heading"),
    reasonHint: t("detail_reason_hint"),
    recentArticlesHeading: t("detail_recent_articles"),
    feedUrlLabel: t("detail_feed_url"),
    contentUrlLabel: t("detail_content_url"),
    displayModeLabel: tr("display_mode"),
    displayModeValue: selectedDisplayModeLabel,
    decisionActions,
    managementActions,
    isGroupExpanded: state.isGroupExpanded,
    onSelectSummaryFilter: state.setActiveSummaryFilter,
    onSelectFeed: state.setSelectedFeedId,
    onListScrollTopChange: state.setListScrollTop,
    onSearchQueryChange: state.setSearchQuery,
    onToggleGroup: state.toggleGroup,
  } satisfies SubscriptionsIndexPageViewProps;
  const bulk: {
    selectionMode: boolean;
    targets: typeof state.bulkTargets;
    applyResult: typeof state.applyBulkUnsubscribeResult;
    endSelection: () => void;
  } = {
    selectionMode: state.bulkSelectionMode,
    targets: state.bulkTargets,
    applyResult: state.applyBulkUnsubscribeResult,
    endSelection: state.endBulkSelection,
  };
  return { viewProps, captureState, navigateToSummaryFilter: state.navigateToSummaryFilter, bulk };
}
