import type { ComponentProps } from "react";
import { useEffect, useEffectEvent, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type {
  ArticleDto,
  FeedArticleSummaryDto,
  FeedDto,
  FolderDto,
  LocalFeedSyncStatusDto,
} from "@/api/tauri-commands";
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
  SubscriptionSummaryFilterKey,
} from "@/lib/subscriptions/subscriptions-index.types";
import type { SubscriptionsWorkspaceReturnState } from "@/schemas/subscriptions-workspace";
import { useUiStore } from "@/stores/ui-store";
import type { SubscriptionsIndexNavigationRequest } from "@/stores/ui-store.types";
import type { SubscriptionsIndexPageView } from "../subscriptions-index-page-view";
import { useSubscriptionsIndexState } from "../use-subscriptions-index-state";

type SubscriptionsIndexPageViewProps = ComponentProps<typeof SubscriptionsIndexPageView>;

type UseSubscriptionsIndexViewPropsParams = {
  feeds: FeedDto[];
  folders: FolderDto[];
  accountArticles: ArticleDto[];
  feedArticleSummaries: FeedArticleSummaryDto[];
  reviewClock: Date;
  viewportHeight: number;
  scopedIndexReturnState: SubscriptionsWorkspaceReturnState | null;
  scopedNavigationRequest: SubscriptionsIndexNavigationRequest | null;
  selectedAccountId: string | null;
  isLocalAccount: boolean;
  feedSyncStatuses: LocalFeedSyncStatusDto[] | undefined;
  feedSyncStatusesPending: boolean;
  feedSyncStatusesError: boolean;
  feedListPending: boolean;
  feedListError: boolean;
  onRetryFeed: (feedId: string) => void;
  onEditFeed: (feedId: string) => void;
  isRetryingFeed: (feedId: string) => boolean;
  onCopyDiagnosticId: (diagnosticId: string) => void;
  closeSubscriptionsWorkspace: () => void;
  setDeleteTargetFeed: (feed: FeedDto | null) => void;
  setEditTargetFeed: (feed: FeedDto | null) => void;
};

function attachLocalFeedFetchErrors(
  rows: SubscriptionListRow[],
  feeds: FeedDto[],
  statuses: LocalFeedSyncStatusDto[] | undefined,
  isLocalAccount: boolean,
): SubscriptionListRow[] {
  if (!isLocalAccount || !statuses) return rows;
  const feedIds = new Set(feeds.map((feed) => feed.id));
  const statusesByFeedId = new Map(
    statuses
      .filter((status) => feedIds.has(status.feed_id) && status.error_kind !== null)
      .map((status) => [status.feed_id, status]),
  );
  return rows.map((row) => {
    const fetchError = statusesByFeedId.get(row.feed.id);
    return fetchError ? { ...row, reasonTooltipKey: "fetch_error", fetchError } : row;
  });
}

type FetchErrorSummaryLabels = {
  label: string;
  loading: string;
  unavailable: string;
  unknown: string;
  none: string;
  caption: (count: number) => string;
};

function buildLocalFetchErrorSummary(params: {
  isLocalAccount: boolean;
  feeds: FeedDto[];
  statuses: LocalFeedSyncStatusDto[] | undefined;
  statusesPending: boolean;
  statusesError: boolean;
  feedListPending: boolean;
  feedListError: boolean;
  activeSummaryFilter: SubscriptionSummaryFilterKey;
  labels: FetchErrorSummaryLabels;
}): { card: SubscriptionSummaryCard | null; failedFeedCount: number | null } {
  const {
    isLocalAccount,
    feeds,
    statuses,
    statusesPending,
    statusesError,
    feedListPending,
    feedListError,
    activeSummaryFilter,
    labels,
  } = params;
  if (!isLocalAccount) return { card: null, failedFeedCount: null };

  const feedIds = new Set(feeds.map((feed) => feed.id));
  const statusesResolved =
    Boolean(statuses) && !statusesPending && !statusesError && !feedListPending && !feedListError;
  const failedFeedCount = statusesResolved
    ? new Set(
        statuses
          ?.filter((status) => feedIds.has(status.feed_id) && status.error_kind !== null)
          .map((status) => status.feed_id),
      ).size
    : null;
  const value =
    failedFeedCount === null
      ? statusesPending || feedListPending
        ? labels.loading
        : labels.unavailable
      : String(failedFeedCount);
  const caption =
    failedFeedCount === null
      ? statusesPending || feedListPending
        ? ""
        : labels.unknown
      : failedFeedCount === 0
        ? labels.none
        : labels.caption(failedFeedCount);

  return {
    failedFeedCount,
    card: {
      filterKey: "fetch_errors",
      label: labels.label,
      value,
      caption,
      tone: failedFeedCount !== null && failedFeedCount > 0 ? "danger" : "neutral",
      isActive: activeSummaryFilter === "fetch_errors",
      isActionable: statusesResolved && failedFeedCount !== null && failedFeedCount > 0,
    },
  };
}

function resolveSubscriptionsEmptyLabel(
  activeSummaryFilter: SubscriptionSummaryFilterKey,
  failedFeedCount: number | null,
  labels: { default: string; fetchErrorsUnknown: string; fetchErrorsEmpty: string },
): string {
  if (activeSummaryFilter !== "fetch_errors") return labels.default;
  if (failedFeedCount === null) return labels.fetchErrorsUnknown;
  if (failedFeedCount === 0) return labels.fetchErrorsEmpty;
  return labels.default;
}

export function useSubscriptionsIndexViewProps({
  feeds,
  folders,
  accountArticles,
  feedArticleSummaries,
  reviewClock,
  viewportHeight,
  scopedIndexReturnState,
  scopedNavigationRequest,
  selectedAccountId,
  isLocalAccount,
  feedSyncStatuses,
  feedSyncStatusesPending,
  feedSyncStatusesError,
  feedListPending,
  feedListError,
  onRetryFeed,
  onEditFeed,
  isRetryingFeed,
  onCopyDiagnosticId,
  closeSubscriptionsWorkspace,
  setDeleteTargetFeed,
  setEditTargetFeed,
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
    accountId: selectedAccountId,
    initialSummaryFilter: scopedNavigationRequest?.summaryFilter ?? scopedIndexReturnState?.activeSummaryFilter,
    initialSelectedFeedId: scopedNavigationRequest ? null : scopedIndexReturnState?.selectedFeedId,
    initialExpandedGroups: scopedIndexReturnState?.expandedGroups,
    initialKeptFeedIds: scopedIndexReturnState?.keptFeedIds,
    initialDeferredFeedIds: scopedIndexReturnState?.deferredFeedIds,
    initialListScrollState: scopedNavigationRequest ? undefined : scopedIndexReturnState?.listScrollTop,
    viewportHeight,
  });
  const consumedNavigationRequest = useRef(scopedNavigationRequest);
  const consumeNavigationRequest = useEffectEvent(() => {
    const currentStore = useUiStore.getState();
    const request =
      currentStore.subscriptionsWorkspace?.kind === "index"
        ? currentStore.subscriptionsWorkspace.navigationRequest
        : undefined;
    if (
      !request ||
      request === consumedNavigationRequest.current ||
      request.accountId !== selectedAccountId ||
      currentStore.selectedAccountId !== selectedAccountId
    ) {
      return;
    }
    consumedNavigationRequest.current = request;
    state.navigateToSummaryFilter(request.summaryFilter);
  });

  useEffect(() => {
    const unsubscribe = useUiStore.subscribe(() => consumeNavigationRequest());
    consumeNavigationRequest();
    return unsubscribe;
  }, []);
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
  const fetchErrorSummary = buildLocalFetchErrorSummary({
    isLocalAccount,
    feeds,
    statuses: feedSyncStatuses,
    statusesPending: feedSyncStatusesPending,
    statusesError: feedSyncStatusesError,
    feedListPending,
    feedListError,
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

  return {
    title: t("title"),
    subtitle: t("subtitle"),
    summaryCards,
    summaryLabels: {
      activeBadge: t("summary_active_badge"),
      staticBadge: t("summary_static_badge"),
      showFilterAriaLabel: (label) => t("summary_action_show_filter_aria", { label }),
      filterAll: t("summary_action_filter_all"),
      filter: t("summary_action_filter"),
      criteria: t("summary_criteria_chip"),
    },
    reviewCriteriaLabel: t("summary_review_criteria"),
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
      editFeedUrl: t("detail_fetch_error_edit_feed_url"),
      reason: (kind: NonNullable<LocalFeedSyncStatusDto["error_kind"]>) => t(`fetch_error_reason_${kind}`),
    },
    onRetryFeed,
    onEditFeed: () => {
      if (state.selectedRow) onEditFeed(state.selectedRow.feed.id);
    },
    isRetryingFeed,
    onCopyDiagnosticId,
    emptyLabel: resolveSubscriptionsEmptyLabel(state.activeSummaryFilter, fetchErrorSummary.failedFeedCount, {
      default: t("empty"),
      fetchErrorsUnknown: t("summary_fetch_errors_unknown"),
      fetchErrorsEmpty: t("summary_fetch_errors_empty"),
    }),
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
    latestArticleLabel: t("latest_article"),
    latestArticleEmptyLabel: t("meta_latest_article_none"),
    updateFrequencyLabel: t("update_frequency"),
    formatUpdateFrequencyValue: (recentArticleCount) => {
      const tier = resolveSubscriptionUpdateFrequencyTier(recentArticleCount);
      if (tier === "none") {
        return t("update_frequency_value_none", { days: SUBSCRIPTION_UPDATE_FREQUENCY_WINDOW_DAYS });
      }
      return t("update_frequency_value", {
        tier: t(`update_frequency_tier_${tier}`),
        days: SUBSCRIPTION_UPDATE_FREQUENCY_WINDOW_DAYS,
        count: recentArticleCount,
      });
    },
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
    backLabel: tc("back"),
    closeLabel: tc("close"),
    isGroupExpanded: state.isGroupExpanded,
    onSelectSummaryFilter: state.setActiveSummaryFilter,
    onSelectFeed: state.setSelectedFeedId,
    onListScrollTopChange: state.setListScrollTop,
    onSearchQueryChange: state.setSearchQuery,
    onToggleGroup: state.toggleGroup,
    onBack: () => closeSubscriptionsWorkspace(),
    onClose: () => closeSubscriptionsWorkspace(),
  } satisfies SubscriptionsIndexPageViewProps;
}
