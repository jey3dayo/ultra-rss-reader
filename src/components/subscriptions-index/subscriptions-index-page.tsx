import { useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { UnsubscribeDialog } from "@/components/reader/unsubscribe-feed-dialog";
import { useAccountArticles } from "@/hooks/use-articles";
import { useDeleteFeed } from "@/hooks/use-delete-feed";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { resolveFeedDisplayPreset } from "@/lib/article-display";
import { getCurrentDate } from "@/lib/datetime";
import {
  buildSubscriptionReviewCandidates,
  buildSubscriptionReviewReasonFacts,
  summarizeSubscriptionReviewCandidate,
} from "@/lib/subscription-review-candidates";
import {
  buildSubscriptionDetailMetrics,
  buildSubscriptionListGroups,
  buildSubscriptionReviewCandidateMap,
  buildSubscriptionsIndexSummary,
  formatSubscriptionDate,
  isSubscriptionRowFlagged,
  resolveSubscriptionRowStatus,
} from "@/lib/subscriptions-index";
import { bindWindowEvents, createKeyboardEventListener } from "@/lib/window-events";
import { useUiStore } from "@/stores/ui-store";
import type {
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
  const deleteFeedMutation = useDeleteFeed();
  const [deleteTargetFeed, setDeleteTargetFeed] = useState<SubscriptionListRow["feed"] | null>(null);
  const [listScrollTop, setListScrollTop] = useState(
    subscriptionsWorkspace?.kind === "index" ? (subscriptionsWorkspace.returnState?.listScrollTop ?? 0) : 0,
  );

  const candidates = useMemo(
    () =>
      buildSubscriptionReviewCandidates({
        feeds,
        folders,
        articles: accountArticles,
        now: getCurrentDate(),
        hiddenFeedIds: new Set(),
      }),
    [accountArticles, feeds, folders],
  );

  const candidateMap = useMemo(() => buildSubscriptionReviewCandidateMap(candidates), [candidates]);
  const folderNameById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder.name])), [folders]);
  const rows = useMemo<SubscriptionListRow[]>(
    () =>
      feeds.map((feed) => ({
        feed,
        folderId: feed.folder_id,
        folderName: feed.folder_id ? (folderNameById.get(feed.folder_id) ?? null) : null,
        latestArticleAt: candidateMap.get(feed.id)?.latestArticleAt ?? null,
        status: resolveSubscriptionRowStatus({ candidate: candidateMap.get(feed.id) }),
      })),
    [candidateMap, feeds, folderNameById],
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

    const summary = summarizeSubscriptionReviewCandidate(selectedCandidate);
    const reasonFacts = buildSubscriptionReviewReasonFacts(selectedCandidate);
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
                  ? t("fact_stale_days", { count: fact.value })
                  : fact.key === "unread_count"
                    ? t("fact_unread_count", { count: fact.value })
                    : t("fact_starred_count", { count: fact.value }),
              )
              .join(" / ")
          : summaryText,
      reasonLabels: selectedCandidate.reasonKeys.map((reasonKey) => t(`reason_${reasonKey}`)),
    };
  }, [selectedCandidate, state.selectedRow, t]);

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

  const summary = buildSubscriptionsIndexSummary({ feeds, candidates });
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
  ] satisfies SubscriptionSummaryCard[];

  const inventoryHeading =
    state.activeSummaryFilter === "all"
      ? t("inventory_heading")
      : (summaryCards.find((card) => card.filterKey === state.activeSummaryFilter)?.label ?? t("inventory_heading"));

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
