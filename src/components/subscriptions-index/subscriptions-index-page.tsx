import { useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { UnsubscribeDialog } from "@/components/reader/unsubscribe-feed-dialog";
import { useAccountArticles } from "@/hooks/use-articles";
import { useDeleteFeed } from "@/hooks/use-delete-feed";
import { useFeedArticleSummaries } from "@/hooks/use-feed-article-summaries";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { getCurrentDate } from "@/lib/datetime";
import {
  buildFolderNameByIdMap,
  buildSubscriptionReviewCandidates,
  resolveSubscriptionReviewReasonFactTranslationKey,
  resolveSubscriptionReviewSummaryTranslationKey,
} from "@/lib/subscription-review-candidates";
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
} from "@/lib/subscriptions-index";
import { bindWindowEvents, createKeyboardEventListener } from "@/lib/window-events";
import { useUiStore } from "@/stores/ui-store";
import type {
  SubscriptionDecisionActions,
  SubscriptionDetailCandidate,
  SubscriptionListRow,
  SubscriptionSummaryCard,
} from "./subscriptions-index.types";
import { SubscriptionsIndexPageView } from "./subscriptions-index-page-view";
import { useSubscriptionsIndexState } from "./use-subscriptions-index-state";

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
  const indexReturnState = subscriptionsWorkspace?.kind === "index" ? subscriptionsWorkspace.returnState : null;
  const [listScrollTop, setListScrollTop] = useState(indexReturnState?.listScrollTop ?? 0);

  const candidates = useMemo(
    () =>
      buildSubscriptionReviewCandidates({
        feeds,
        folders,
        feedArticleSummaries,
        now: getCurrentDate(),
        hiddenFeedIds: new Set(),
      }),
    [feedArticleSummaries, feeds, folders],
  );

  const candidateMap = useMemo(() => buildSubscriptionReviewCandidateMap(candidates), [candidates]);
  const feedArticleSummaryMap = useMemo(() => buildFeedArticleSummaryMap(feedArticleSummaries), [feedArticleSummaries]);
  const folderNameById = useMemo(() => buildFolderNameByIdMap(folders), [folders]);
  const rows = useMemo<SubscriptionListRow[]>(
    () => buildSubscriptionListRows({ feeds, candidateMap, feedArticleSummaryMap, folderNameById }),
    [candidateMap, feedArticleSummaryMap, feeds, folderNameById],
  );

  const state = useSubscriptionsIndexState(rows, {
    initialSummaryFilter: indexReturnState?.activeSummaryFilter,
    initialSelectedFeedId: indexReturnState?.selectedFeedId,
    initialExpandedGroups: indexReturnState?.expandedGroups,
    initialKeptFeedIds: indexReturnState?.keptFeedIds,
    initialDeferredFeedIds: indexReturnState?.deferredFeedIds,
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
          reasonLabel: (reasonKey) => t(`reason_${reasonKey}`),
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

  const summary = buildSubscriptionsIndexSummary({ feeds, candidates });
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

  useLayoutEffect(() => {
    const handleKeyDown = createKeyboardEventListener((event) => {
      const target = event.target;
      if (
        event.defaultPrevented ||
        event.key !== "Escape" ||
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
  }, [closeSubscriptionsWorkspace]);

  return (
    <>
      <SubscriptionsIndexPageView
        title={t("title")}
        subtitle={t("subtitle")}
        summaryCards={summaryCards}
        inventoryHeading={inventoryHeading}
        detailHeading={t("detail_heading")}
        groups={groupedRows}
        selectedFeedId={state.selectedFeedId}
        selectedRow={state.selectedRow}
        selectedMetrics={selectedMetrics}
        selectedDetailCandidate={selectedDetailCandidate}
        emptyLabel={t("empty")}
        detailEmptyLabel={t("detail_empty")}
        statusLabels={{
          normal: t("status_normal"),
          review: t("status_review"),
          stale_90d: t("status_stale_90d"),
          no_unread: t("status_no_unread"),
          no_stars: t("status_no_stars"),
        }}
        reasonTooltipLabels={{
          no_articles: t("tooltip_reason_no_articles"),
          normal: t("detail_reason_normal"),
          review: t("tooltip_reason_review"),
          stale_90d: t("tooltip_reason_stale_90d"),
          no_unread: t("tooltip_reason_no_unread"),
          no_stars: t("tooltip_reason_no_stars"),
        }}
        formatUnreadCountLabel={(count) => t("meta_unread_count", { count })}
        formatLatestArticleLabel={(value) =>
          value
            ? t("meta_latest_article", { date: formatSubscriptionDate(value, i18n.language) })
            : t("meta_latest_article_none")
        }
        dateLocale={i18n.language}
        folderLabel={t("folder")}
        listScrollTop={listScrollTop}
        latestArticleLabel={t("latest_article")}
        unreadCountLabel={t("unread_count")}
        starredCountLabel={t("starred_count")}
        reasonHeading={t("detail_reason_heading")}
        reasonHint={t("detail_reason_hint")}
        recentArticlesHeading={t("detail_recent_articles")}
        displayModeLabel={tr("display_mode")}
        displayModeValue={selectedDisplayModeLabel}
        decisionActions={decisionActions}
        backLabel={tc("back")}
        closeLabel={tc("close")}
        isGroupExpanded={state.isGroupExpanded}
        onSelectSummaryFilter={state.setActiveSummaryFilter}
        onSelectFeed={state.setSelectedFeedId}
        onListScrollTopChange={setListScrollTop}
        onToggleGroup={state.toggleGroup}
        onBack={() => closeSubscriptionsWorkspace()}
        onClose={() => closeSubscriptionsWorkspace()}
      />

      {deleteTargetFeed ? (
        <UnsubscribeDialog
          feed={deleteTargetFeed}
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTargetFeed(null);
            }
          }}
          onConfirm={() => {
            void deleteFeedMutation.mutateAsync({
              feedId: deleteTargetFeed.id,
              title: deleteTargetFeed.title,
              onSuccess: () => {
                setDeleteTargetFeed(null);
              },
            });
          }}
        />
      ) : null}
    </>
  );
}
