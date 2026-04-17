import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { UnsubscribeDialog } from "@/components/reader/unsubscribe-feed-dialog";
import { useAccountArticles, useFeedIntegrityReport } from "@/hooks/use-articles";
import { useDeleteFeed } from "@/hooks/use-delete-feed";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { resolveFeedDisplayPreset } from "@/lib/article-display";
import { buildCleanupReasonFacts, buildFeedCleanupCandidates, summarizeCleanupCandidate } from "@/lib/feed-cleanup";
import {
  buildCleanupCandidateMap,
  buildSubscriptionDetailMetrics,
  buildSubscriptionListGroups,
  buildSubscriptionsIndexSummary,
  isSubscriptionRowFlagged,
  resolveSubscriptionRowStatus,
} from "@/lib/subscriptions-index";
import type { FeedCleanupContextReason } from "@/stores/ui-store";
import { useUiStore } from "@/stores/ui-store";
import type {
  SubscriptionDetailCandidate,
  SubscriptionListRow,
  SubscriptionSummaryCard,
  SubscriptionSummaryFilterKey,
} from "./subscriptions-index.types";
import { SubscriptionsIndexPageView } from "./subscriptions-index-page-view";
import { useSubscriptionsIndexState } from "./use-subscriptions-index-state";

function resolveBatchCleanupReason(filterKey: SubscriptionSummaryFilterKey): FeedCleanupContextReason {
  if (filterKey === "broken") {
    return "broken_references";
  }
  if (filterKey === "stale") {
    return "stale_90d";
  }
  return "review";
}

export function SubscriptionsIndexPage() {
  const { t } = useTranslation("subscriptions");
  const { t: tr } = useTranslation("reader");
  const { t: tCleanup } = useTranslation("cleanup");
  const { t: tc } = useTranslation("common");
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const openFeedCleanup = useUiStore((state) => state.openFeedCleanup);
  const closeSubscriptionsWorkspace = useUiStore((state) => state.closeSubscriptionsWorkspace);
  const showToast = useUiStore((state) => state.showToast);
  const subscriptionsWorkspace = useUiStore((state) => state.subscriptionsWorkspace);
  const { data: feeds = [] } = useFeeds(selectedAccountId);
  const { data: folders = [] } = useFolders(selectedAccountId);
  const { data: accountArticles = [] } = useAccountArticles(selectedAccountId);
  const { data: integrityReport } = useFeedIntegrityReport();
  const deleteFeedMutation = useDeleteFeed();
  const [deleteTargetFeed, setDeleteTargetFeed] = useState<SubscriptionListRow["feed"] | null>(null);
  const [listScrollTop, setListScrollTop] = useState(
    subscriptionsWorkspace?.kind === "index" ? (subscriptionsWorkspace.returnState?.listScrollTop ?? 0) : 0,
  );

  const candidates = useMemo(
    () =>
      buildFeedCleanupCandidates({
        feeds,
        folders,
        articles: accountArticles,
        now: new Date(),
        hiddenFeedIds: new Set(),
      }),
    [accountArticles, feeds, folders],
  );

  const candidateMap = useMemo(() => buildCleanupCandidateMap(candidates), [candidates]);
  const folderNameById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder.name])), [folders]);
  const rows = useMemo<SubscriptionListRow[]>(
    () =>
      feeds.map((feed) => ({
        feed,
        folderId: feed.folder_id,
        folderName: feed.folder_id ? (folderNameById.get(feed.folder_id) ?? null) : null,
        latestArticleAt: candidateMap.get(feed.id)?.latestArticleAt ?? null,
        status: resolveSubscriptionRowStatus({
          candidate: candidateMap.get(feed.id),
          integrityReport,
        }),
      })),
    [candidateMap, feeds, folderNameById, integrityReport],
  );

  const state = useSubscriptionsIndexState(rows, {
    initialSummaryFilter:
      subscriptionsWorkspace?.kind === "index" ? subscriptionsWorkspace.returnState?.activeSummaryFilter : undefined,
    initialSelectedFeedId:
      subscriptionsWorkspace?.kind === "index" ? subscriptionsWorkspace.returnState?.selectedFeedId : undefined,
    initialExpandedGroups:
      subscriptionsWorkspace?.kind === "index" ? subscriptionsWorkspace.returnState?.expandedGroups : undefined,
    initialKeptFeedIds:
      subscriptionsWorkspace?.kind === "index" ? subscriptionsWorkspace.returnState?.keptFeedIds : undefined,
    initialDeferredFeedIds:
      subscriptionsWorkspace?.kind === "index" ? subscriptionsWorkspace.returnState?.deferredFeedIds : undefined,
  });
  const selectedMetrics = state.selectedRow
    ? buildSubscriptionDetailMetrics({
        feed: state.selectedRow.feed,
        articles: accountArticles,
      })
    : null;
  const selectedCandidate = state.selectedRow ? (candidateMap.get(state.selectedRow.feed.id) ?? null) : null;
  const selectedDetailCandidate = useMemo<SubscriptionDetailCandidate | null>(() => {
    if (!state.selectedRow) {
      return null;
    }

    if (!selectedCandidate) {
      return {
        candidate: null,
        tone: "neutral",
        statusLabel: t("status_normal"),
        summary: t("detail_reason_normal"),
        reasonBoxBody: t("detail_reason_normal"),
        reasonLabels: [],
      };
    }

    const summary = summarizeCleanupCandidate(selectedCandidate);
    const reasonFacts = buildCleanupReasonFacts(selectedCandidate);
    const summaryText = t(
      summary.summaryKey === "stale_and_inactive"
        ? "detail_reason_stale_and_inactive"
        : summary.summaryKey === "stale_with_no_stars"
          ? "detail_reason_stale_with_no_stars"
          : summary.summaryKey === "inactive_without_signals"
            ? "detail_reason_inactive_without_signals"
            : summary.summaryKey === "stale_but_supported"
              ? "detail_reason_stale_but_supported"
              : "detail_reason_normal",
    );

    return {
      candidate: selectedCandidate,
      tone: summary.tone,
      statusLabel: t(`status_${state.selectedRow.status.labelKey}`),
      summary: summaryText,
      reasonBoxBody:
        reasonFacts.length > 0
          ? reasonFacts
              .map((fact) =>
                fact.key === "stale_days"
                  ? tCleanup("fact_stale_days", { count: fact.value })
                  : fact.key === "unread_count"
                    ? tCleanup("fact_unread_count", { count: fact.value })
                    : tCleanup("fact_starred_count", { count: fact.value }),
              )
              .join(" / ")
          : summaryText,
      reasonLabels: selectedCandidate.reasonKeys.map((reasonKey) => tCleanup(`reason_${reasonKey}`)),
    };
  }, [selectedCandidate, state.selectedRow, t, tCleanup]);

  const selectedDisplayModeLabel = state.selectedRow
    ? (() => {
        const preset = resolveFeedDisplayPreset(state.selectedRow.feed);
        if (preset === "default") {
          return tr("display_mode_default");
        }
        if (preset === "standard") {
          return tr("display_mode_standard");
        }
        return tr("display_mode_preview");
      })()
    : tr("display_mode_default");

  const groupedRows = useMemo(
    () => buildSubscriptionListGroups(state.visibleRows, t("meta_folder_none")),
    [state.visibleRows, t],
  );

  const summary = buildSubscriptionsIndexSummary({ feeds, candidates, integrityReport });
  const summaryCards = [
    {
      filterKey: "all",
      label: t("summary_total"),
      value: String(summary.totalCount),
      caption: t("summary_total_caption", { count: summary.totalCount }),
      tone: "neutral",
      isActive: state.activeSummaryFilter === "all",
    },
    {
      filterKey: "review",
      label: t("summary_review"),
      value: String(summary.reviewCount),
      caption: t("summary_review_caption", { count: summary.reviewCount }),
      tone: "review",
      isActive: state.activeSummaryFilter === "review",
    },
    {
      filterKey: "stale",
      label: t("summary_stale"),
      value: String(summary.staleCount),
      caption: t("summary_stale_caption", { count: summary.staleCount }),
      tone: "stale",
      isActive: state.activeSummaryFilter === "stale",
    },
    {
      filterKey: "broken",
      label: t("summary_broken"),
      value: String(summary.brokenReferenceCount),
      caption: t("summary_broken_caption", { count: summary.brokenReferenceCount }),
      tone: "danger",
      isActive: state.activeSummaryFilter === "broken",
    },
  ] satisfies SubscriptionSummaryCard[];

  const decisionActions =
    state.selectedRow && isSubscriptionRowFlagged(state.selectedRow.status)
      ? {
          keepLabel: t("decision_keep"),
          deferLabel: t("decision_defer"),
          deleteLabel: tc("delete"),
          onKeep: () => {
            state.markSelectedFeedKept();
            if (state.selectedRow) {
              showToast(t("decision_kept", { title: state.selectedRow.feed.title }));
            }
          },
          onDefer: () => {
            state.markSelectedFeedDeferred();
            if (state.selectedRow) {
              showToast(t("decision_deferred", { title: state.selectedRow.feed.title }));
            }
          },
          onDelete: () => {
            if (state.selectedRow) {
              setDeleteTargetFeed(state.selectedRow.feed);
            }
          },
        }
      : null;

  const returnState = {
    activeSummaryFilter: state.activeSummaryFilter,
    selectedFeedId: state.selectedFeedId,
    expandedGroups: state.expandedGroups,
    listScrollTop,
    keptFeedIds: [...state.keptFeedIds],
    deferredFeedIds: [...state.deferredFeedIds],
  };

  const batchReviewLabel =
    (state.activeSummaryFilter === "review" ||
      state.activeSummaryFilter === "stale" ||
      state.activeSummaryFilter === "broken") &&
    (state.visibleRows.length > 0 || state.activeSummaryFilter === "broken")
      ? t("batch_review_action")
      : undefined;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeSubscriptionsWorkspace]);

  return (
    <>
      <SubscriptionsIndexPageView
        title={t("title")}
        subtitle={t("subtitle")}
        summaryCards={summaryCards}
        inventoryHeading={t("inventory_heading")}
        detailHeading={t("detail_heading")}
        groups={groupedRows}
        selectedFeedId={state.selectedFeedId}
        selectedRow={state.selectedRow}
        selectedMetrics={selectedMetrics}
        selectedDetailCandidate={selectedDetailCandidate}
        emptyLabel={state.activeSummaryFilter === "broken" ? t("empty_broken_filter") : t("empty")}
        detailEmptyLabel={state.activeSummaryFilter === "broken" ? t("detail_empty_broken") : t("detail_empty")}
        statusLabels={{
          normal: t("status_normal"),
          review: t("status_review"),
          stale_90d: t("status_stale_90d"),
          no_unread: t("status_no_unread"),
          no_stars: t("status_no_stars"),
        }}
        formatUnreadCountLabel={(count) => t("meta_unread_count", { count })}
        formatLatestArticleLabel={(value) =>
          value
            ? t("meta_latest_article", { date: new Date(value).toLocaleDateString() })
            : t("meta_latest_article_none")
        }
        folderLabel={tCleanup("folder")}
        listScrollTop={listScrollTop}
        latestArticleLabel={tCleanup("latest_article")}
        unreadCountLabel={tCleanup("unread_count")}
        starredCountLabel={tCleanup("starred_count")}
        reasonHeading={t("detail_reason_heading")}
        reasonHint={t("detail_reason_hint")}
        recentArticlesHeading={t("detail_recent_articles")}
        displayModeLabel={tr("display_mode")}
        displayModeValue={selectedDisplayModeLabel}
        batchReviewLabel={batchReviewLabel}
        batchReviewDescription={
          batchReviewLabel
            ? t("batch_review_description", {
                count: state.activeSummaryFilter === "broken" ? summary.brokenReferenceCount : state.visibleRows.length,
              })
            : undefined
        }
        decisionActions={decisionActions}
        backLabel={tc("back")}
        closeLabel={tc("close")}
        isGroupExpanded={state.isGroupExpanded}
        onSelectSummaryFilter={state.setActiveSummaryFilter}
        onSelectFeed={state.setSelectedFeedId}
        onListScrollTopChange={setListScrollTop}
        onToggleGroup={state.toggleGroup}
        onOpenCleanup={() => {
          openFeedCleanup({
            reason: resolveBatchCleanupReason(state.activeSummaryFilter),
            feedIds: state.visibleRows.map((row) => row.feed.id),
            returnTo: "index",
            returnState,
          });
        }}
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
