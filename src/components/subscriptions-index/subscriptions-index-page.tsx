import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAccountArticles, useFeedIntegrityReport } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { resolveFeedDisplayPreset } from "@/lib/article-display";
import { buildCleanupReasonFacts, buildFeedCleanupCandidates, summarizeCleanupCandidate } from "@/lib/feed-cleanup";
import {
  buildCleanupCandidateMap,
  buildSubscriptionDetailMetrics,
  buildSubscriptionListGroups,
  buildSubscriptionsIndexSummary,
  resolveSubscriptionRowStatus,
} from "@/lib/subscriptions-index";
import type { FeedCleanupContextReason } from "@/stores/ui-store";
import { useUiStore } from "@/stores/ui-store";
import type {
  SubscriptionDetailCandidate,
  SubscriptionListRow,
  SubscriptionSummaryCard,
} from "./subscriptions-index.types";
import { SubscriptionsIndexPageView } from "./subscriptions-index-page-view";
import { useSubscriptionsIndexState } from "./use-subscriptions-index-state";

function resolveCleanupReason(row: SubscriptionListRow): FeedCleanupContextReason {
  if (row.status.labelKey === "stale_90d") {
    return "stale_90d";
  }
  if (row.status.labelKey === "no_unread") {
    return "no_unread";
  }
  if (row.status.labelKey === "no_stars") {
    return "no_stars";
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
  const { data: feeds = [] } = useFeeds(selectedAccountId);
  const { data: folders = [] } = useFolders(selectedAccountId);
  const { data: accountArticles = [] } = useAccountArticles(selectedAccountId);
  const { data: integrityReport } = useFeedIntegrityReport();

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

  const state = useSubscriptionsIndexState(rows);
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
      label: t("summary_total"),
      value: String(summary.totalCount),
      caption: t("summary_total_caption", { count: summary.totalCount }),
      tone: "neutral",
    },
    {
      label: t("summary_review"),
      value: String(summary.reviewCount),
      caption: t("summary_review_caption", { count: summary.reviewCount }),
      actionLabel: t("open_cleanup_review"),
      onAction: () => openFeedCleanup({ reason: "review", returnTo: "index" }),
      tone: "review",
    },
    {
      label: t("summary_stale"),
      value: String(summary.staleCount),
      caption: t("summary_stale_caption", { count: summary.staleCount }),
      actionLabel: t("open_cleanup_stale"),
      onAction: () => openFeedCleanup({ reason: "stale_90d", returnTo: "index" }),
      tone: "stale",
    },
    {
      label: t("summary_broken"),
      value: String(summary.brokenReferenceCount),
      caption: t("summary_broken_caption", { count: summary.brokenReferenceCount }),
      actionLabel: t("open_cleanup_broken_references"),
      onAction: () => openFeedCleanup({ reason: "broken_references", returnTo: "index" }),
      tone: "danger",
    },
  ] satisfies SubscriptionSummaryCard[];

  return (
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
        value ? t("meta_latest_article", { date: new Date(value).toLocaleDateString() }) : t("meta_latest_article_none")
      }
      folderLabel={tCleanup("folder")}
      latestArticleLabel={tCleanup("latest_article")}
      unreadCountLabel={tCleanup("unread_count")}
      starredCountLabel={tCleanup("starred_count")}
      reasonHeading={t("detail_reason_heading")}
      reasonHint={t("detail_reason_hint")}
      recentArticlesHeading={t("detail_recent_articles")}
      displayModeLabel={tr("display_mode")}
      displayModeValue={selectedDisplayModeLabel}
      openCleanupLabel={t("open_cleanup_for_feed")}
      backLabel={tc("back")}
      closeLabel={tc("close")}
      onSelectFeed={state.setSelectedFeedId}
      onOpenCleanup={() => {
        if (!state.selectedRow) {
          return;
        }

        openFeedCleanup({
          reason: resolveCleanupReason(state.selectedRow),
          feedId: state.selectedRow.feed.id,
          returnTo: "index",
        });
      }}
      onBack={() => closeSubscriptionsWorkspace()}
      onClose={() => closeSubscriptionsWorkspace()}
    />
  );
}
