import { useTranslation } from "react-i18next";
import { useAccountArticles, useFeedIntegrityReport } from "@/hooks/use-articles";
import { useDeleteFeed } from "@/hooks/use-delete-feed";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { useResolvedDevIntent } from "@/hooks/use-resolved-dev-intent";
import { resolveArticleDateLocale } from "@/lib/article-view";
import type { FeedCleanupReasonKey } from "@/lib/feed-cleanup";
import { useUiStore } from "@/stores/ui-store";
import { FeedCleanupDeleteDialog } from "./feed-cleanup-delete-dialog";
import { FeedCleanupFeedEditor } from "./feed-cleanup-feed-editor";
import { FeedCleanupPageView } from "./feed-cleanup-page-view";
import { useFeedCleanupPageState } from "./use-feed-cleanup-page-state";

export function FeedCleanupPage() {
  const { t, i18n } = useTranslation("cleanup");
  const { t: tr } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const feedCleanupOpen = useUiStore((state) => state.feedCleanupOpen);
  const closeFeedCleanup = useUiStore((state) => state.closeFeedCleanup);
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const deleteFeedMutation = useDeleteFeed();
  const { data: feeds = [] } = useFeeds(selectedAccountId);
  const { data: folders = [] } = useFolders(selectedAccountId);
  const { data: accountArticles = [] } = useAccountArticles(selectedAccountId);
  const { data: integrityReport } = useFeedIntegrityReport();
  const { intent: devIntent } = useResolvedDevIntent();
  const dateLocale = resolveArticleDateLocale(i18n.language);

  const cleanupState = useFeedCleanupPageState({
    feedCleanupOpen,
    devIntent,
    feeds,
    folders,
    accountArticles,
    integrityReport,
  });

  const filterOptions = [
    { key: "stale_90d", label: t("stale_90d") },
    { key: "no_unread", label: t("no_unread") },
    { key: "no_stars", label: t("no_stars") },
  ] as const;
  const reasonLabels: Record<FeedCleanupReasonKey, string> = {
    stale_90d: t("reason_stale_90d"),
    no_unread: t("reason_no_unread"),
    no_stars: t("reason_no_stars"),
  };
  const summaryCards = [
    {
      label: t("summary_candidates"),
      value: String(cleanupState.visibleCandidates.length),
      caption: t("summary_candidates_caption", { count: cleanupState.visibleCandidates.length }),
    },
    {
      label: t("summary_review_now"),
      value: String(cleanupState.reviewNowCount),
      caption: t("summary_review_now_caption", { count: cleanupState.reviewNowCount }),
    },
    {
      label: t("summary_deferred"),
      value: String(cleanupState.deferredCount),
      caption: t("summary_deferred_caption", { count: cleanupState.deferredCount }),
    },
    {
      label: t("summary_integrity"),
      value: String(integrityReport?.orphaned_article_count ?? 0),
      caption: t("summary_integrity_caption", { count: integrityReport?.orphaned_article_count ?? 0 }),
    },
  ] as const;

  if (!feedCleanupOpen) {
    return null;
  }

  return (
    <>
      <FeedCleanupPageView
        title={t("title")}
        subtitle={t("subtitle")}
        closeLabel={tc("close")}
        dateLocale={dateLocale}
        overviewLabel={t("overview")}
        filtersLabel={t("filters")}
        queueLabel={t("queue")}
        reviewLabel={t("review")}
        summaryCards={summaryCards}
        integrityIssue={
          (integrityReport?.orphaned_article_count ?? 0) > 0
            ? {
                title: t("integrity_title"),
                body: t("integrity_orphaned_articles", {
                  count: integrityReport?.orphaned_article_count ?? 0,
                }),
                actionLabel: cleanupState.integrityMode ? t("show_cleanup_queue") : t("show_broken_references"),
              }
            : null
        }
        integrityMode={cleanupState.integrityMode}
        integrityQueueLabel={t("integrity_queue")}
        integrityEmptyLabel={t("integrity_empty")}
        integrityIssues={cleanupState.integrityIssues}
        selectedIntegrityIssue={cleanupState.selectedIntegrityIssue}
        integrityDetailLabels={{
          missing_feed_id: t("integrity_missing_feed_id"),
          article_count: t("integrity_article_count"),
          latest_article: t("integrity_latest_article"),
          latest_published_at: t("integrity_latest_published_at"),
          needs_repair: t("integrity_needs_repair"),
          needs_repair_badge: t("integrity_needs_repair_badge"),
          summary: t("integrity_issue_summary", { count: cleanupState.selectedIntegrityIssue?.article_count ?? 0 }),
          unknown_article: t("integrity_unknown_article"),
          queue_item_title: t("integrity_queue_item_title"),
          queue_item_articles_label: t("integrity_queue_item_articles_label"),
          filter_note: t("integrity_filter_note"),
        }}
        filterOptions={filterOptions}
        filterCounts={cleanupState.filterCounts}
        activeFilterKeys={cleanupState.activeFilters}
        queue={cleanupState.visibleCandidates}
        selectedCandidate={cleanupState.selectedCandidate}
        selectedSummary={cleanupState.selectedSummary}
        showDeferred={cleanupState.showDeferred}
        showDeferredLabel={cleanupState.showDeferred ? t("hide_deferred") : t("show_deferred")}
        emptyLabel={t("empty")}
        keepLabel={t("keep")}
        laterLabel={t("later")}
        deleteLabel={t("delete")}
        editLabel={tr("edit_feed")}
        folderLabel={t("folder")}
        latestArticleLabel={t("latest_article")}
        unreadCountLabel={t("unread_count")}
        starredCountLabel={t("starred_count")}
        reasonsLabel={t("reasons")}
        noSelectionLabel={t("no_selection")}
        deferredBadgeLabel={t("deferred_badge")}
        reasonLabels={reasonLabels}
        priorityLabels={{
          review_now: t("priority_review_now"),
          consider: t("priority_consider"),
          keep: t("priority_keep"),
        }}
        summaryHeadlineLabels={{
          review_now: t("summary_headline_review_now"),
          consider: t("summary_headline_consider"),
          keep: t("summary_headline_keep"),
        }}
        summaryLabels={{
          stale_and_inactive: t("candidate_summary_stale_and_inactive"),
          stale_with_no_stars: t("candidate_summary_stale_with_no_stars"),
          inactive_without_signals: t("candidate_summary_inactive_without_signals"),
          stale_but_supported: t("candidate_summary_stale_but_supported"),
          healthy_feed: t("candidate_summary_healthy_feed"),
        }}
        onClose={() => closeFeedCleanup()}
        onToggleIntegrityMode={cleanupState.toggleIntegrityMode}
        onToggleFilter={cleanupState.toggleFilter}
        onToggleShowDeferred={cleanupState.toggleShowDeferred}
        onSelectCandidate={cleanupState.selectCandidate}
        onSelectIntegrityIssue={cleanupState.selectIntegrityIssue}
        editing={cleanupState.isEditingSelectedFeed}
        editor={
          cleanupState.isEditingSelectedFeed && cleanupState.selectedFeed ? (
            <FeedCleanupFeedEditor
              feed={cleanupState.selectedFeed}
              folders={folders}
              maintenanceTitle={t("editor_maintenance_title")}
              maintenanceDescription={t("editor_maintenance_description")}
              refetchLabel={t("editor_refetch")}
              unsubscribeLabel={tr("unsubscribe")}
              onCancel={cleanupState.cancelEditingSelectedFeed}
              onDelete={cleanupState.requestDeleteForSelectedFeed}
              onSaved={cleanupState.cancelEditingSelectedFeed}
            />
          ) : null
        }
        onKeep={cleanupState.markSelectedCandidateKept}
        onEdit={cleanupState.startEditingSelectedFeed}
        onLater={cleanupState.markSelectedCandidateDeferred}
        onDelete={cleanupState.requestDeleteForSelectedCandidate}
      />

      <FeedCleanupDeleteDialog
        candidate={cleanupState.deleteTarget ?? null}
        open={cleanupState.deleteTarget != null}
        title={t("delete_title")}
        dateLocale={dateLocale}
        cancelLabel={tc("cancel")}
        deleteLabel={t("delete")}
        latestArticleLabel={t("latest_article")}
        unreadCountLabel={t("unread_count")}
        starredCountLabel={t("starred_count")}
        reasonsLabel={t("reasons")}
        reasonLabels={reasonLabels}
        pending={deleteFeedMutation.isPending}
        onOpenChange={(open) => {
          if (!open && !deleteFeedMutation.isPending) {
            cleanupState.clearDeleteTarget();
          }
        }}
        onConfirm={() => {
          const target = cleanupState.deleteTarget;
          if (!target) {
            return;
          }

          void deleteFeedMutation
            .mutateAsync({
              feedId: target.feedId,
              title: target.title,
              onSuccess: () => {
                cleanupState.deleteSucceeded(target.feedId);
              },
            })
            .catch(() => undefined);
        }}
      />
    </>
  );
}
