import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAccountArticles, useFeedIntegrityReport } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { resolveFeedDisplayPreset } from "@/lib/article-display";
import { buildFeedCleanupCandidates } from "@/lib/feed-cleanup";
import {
  buildCleanupCandidateMap,
  buildSubscriptionDetailMetrics,
  buildSubscriptionsIndexSummary,
  resolveSubscriptionRowStatus,
} from "@/lib/subscriptions-index";
import type { FeedCleanupContextReason } from "@/stores/ui-store";
import { useUiStore } from "@/stores/ui-store";
import type { SubscriptionListRow } from "./subscriptions-index.types";
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
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const openFeedCleanup = useUiStore((state) => state.openFeedCleanup);
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

  const summary = buildSubscriptionsIndexSummary({ feeds, candidates, integrityReport });
  const summaryCards = [
    { label: t("summary_total"), value: String(summary.totalCount) },
    {
      label: t("summary_review"),
      value: String(summary.reviewCount),
      actionLabel: t("open_cleanup_review"),
      onAction: () => openFeedCleanup({ reason: "review", returnTo: "index" }),
    },
    {
      label: t("summary_stale"),
      value: String(summary.staleCount),
      actionLabel: t("open_cleanup_stale"),
      onAction: () => openFeedCleanup({ reason: "stale_90d", returnTo: "index" }),
    },
    {
      label: t("summary_broken"),
      value: String(summary.brokenReferenceCount),
      actionLabel: t("open_cleanup_broken_references"),
      onAction: () => openFeedCleanup({ reason: "broken_references", returnTo: "index" }),
    },
  ];

  return (
    <SubscriptionsIndexPageView
      title={t("title")}
      subtitle={t("subtitle")}
      summaryCards={summaryCards}
      inventoryHeading={t("inventory_heading")}
      detailHeading={t("detail_heading")}
      rows={state.visibleRows}
      selectedFeedId={state.selectedFeedId}
      selectedRow={state.selectedRow}
      selectedMetrics={selectedMetrics}
      emptyLabel={t("empty")}
      detailEmptyLabel={t("detail_empty")}
      statusLabels={{
        normal: t("status_normal"),
        review: t("status_review"),
        stale_90d: t("status_stale_90d"),
        no_unread: t("status_no_unread"),
        no_stars: t("status_no_stars"),
      }}
      formatFolderLabel={(folderName) => (folderName ? t("meta_folder", { value: folderName }) : t("meta_folder_none"))}
      formatUnreadCountLabel={(count) => t("meta_unread_count", { count })}
      formatLatestArticleLabel={(value) =>
        value ? t("meta_latest_article", { date: new Date(value).toLocaleDateString() }) : t("meta_latest_article_none")
      }
      folderLabel={tCleanup("folder")}
      latestArticleLabel={tCleanup("latest_article")}
      unreadCountLabel={tCleanup("unread_count")}
      starredCountLabel={tCleanup("starred_count")}
      websiteUrlLabel={tr("website_url")}
      feedUrlLabel={tr("feed_url")}
      displayModeLabel={tr("display_mode")}
      displayModeValue={selectedDisplayModeLabel}
      openCleanupLabel={t("open_cleanup_for_feed")}
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
    />
  );
}
