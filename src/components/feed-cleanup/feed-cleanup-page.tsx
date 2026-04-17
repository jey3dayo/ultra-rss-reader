import { useTranslation } from "react-i18next";
import { useAccountArticles, useFeedIntegrityReport } from "@/hooks/use-articles";
import { useDeleteFeed } from "@/hooks/use-delete-feed";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { useResolvedDevIntent } from "@/hooks/use-resolved-dev-intent";
import { resolveArticleDateLocale } from "@/lib/article-view";
import type { FeedCleanupReasonKey } from "@/lib/feed-cleanup";
import { buildSubscriptionDetailMetrics } from "@/lib/subscriptions-index";
import { useUiStore } from "@/stores/ui-store";
import { FeedCleanupDeleteDialog } from "./feed-cleanup-delete-dialog";
import { FeedCleanupFeedEditor } from "./feed-cleanup-feed-editor";
import { FeedCleanupPageView } from "./feed-cleanup-page-view";
import { useFeedCleanupPageState } from "./use-feed-cleanup-page-state";

export function FeedCleanupPage() {
  const { t, i18n } = useTranslation("cleanup");
  const { t: tr } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const subscriptionsWorkspace = useUiStore((state) => state.subscriptionsWorkspace);
  const openSubscriptionsIndex = useUiStore((state) => state.openSubscriptionsIndex);
  const closeFeedCleanup = useUiStore((state) => state.closeFeedCleanup);
  const showToast = useUiStore((state) => state.showToast);
  const clearToast = useUiStore((state) => state.clearToast);
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const deleteFeedMutation = useDeleteFeed();
  const { data: feeds = [] } = useFeeds(selectedAccountId);
  const { data: folders = [] } = useFolders(selectedAccountId);
  const { data: accountArticles = [] } = useAccountArticles(selectedAccountId);
  const { data: integrityReport } = useFeedIntegrityReport();
  const { intent: devIntent } = useResolvedDevIntent();
  const dateLocale = resolveArticleDateLocale(i18n.language);

  const cleanupState = useFeedCleanupPageState({
    subscriptionsWorkspace,
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
  const selectedMetrics = cleanupState.selectedFeed
    ? buildSubscriptionDetailMetrics({
        feed: cleanupState.selectedFeed,
        articles: accountArticles,
      })
    : null;
  const summaryCards = [
    {
      label: t("summary_pending"),
      value: String(cleanupState.pendingCount),
      caption: t("summary_pending_caption"),
    },
    {
      label: t("summary_decided"),
      value: String(cleanupState.decidedCount),
      caption: t("summary_decided_caption"),
    },
  ] as const;
  const bulkActionDisabled =
    cleanupState.visibleCandidates.length === 0 ||
    cleanupState.isEditingSelectedFeed ||
    cleanupState.deleteTargets.length > 0;

  const showDecisionToast = (decision: "keep" | "defer") => {
    const targetIds = cleanupState.decisionTargetIds;
    if (targetIds.length === 0) {
      return;
    }

    const title = feeds.find((feed) => feed.id === targetIds[0])?.title ?? t("queue");
    const message =
      targetIds.length === 1
        ? t(decision === "keep" ? "decision_kept" : "decision_deferred", { title })
        : t(decision === "keep" ? "decision_kept_other" : "decision_deferred_other", { count: targetIds.length });

    showToast({
      message,
      persistent: true,
      actions: [
        {
          label: t("undo"),
          onClick: () => {
            cleanupState.undoLastDecision();
            clearToast();
          },
        },
      ],
    });
  };

  if (subscriptionsWorkspace?.kind !== "cleanup") {
    return null;
  }

  return (
    <>
      <FeedCleanupPageView
        title={t("title")}
        subtitle={t("subtitle")}
        closeLabel={tc("close")}
        backToIndexLabel={
          subscriptionsWorkspace?.kind === "cleanup" && subscriptionsWorkspace.cleanupContext?.returnTo === "index"
            ? t("back_to_index")
            : undefined
        }
        dateLocale={dateLocale}
        overviewLabel={t("overview")}
        filtersLabel={t("filters")}
        bulkActionsLabel={t("bulk_actions")}
        bulkVisibleCountLabel={t("bulk_visible_count", { count: cleanupState.visibleCandidates.length })}
        allCandidateCount={cleanupState.allCandidateCount}
        bulkKeepVisibleLabel={t("bulk_keep_visible")}
        bulkDeferVisibleLabel={t("bulk_defer_visible")}
        queueLabel={t("queue")}
        bulkSelectionScopeLabel={t("bulk_selection_scope")}
        bulkKeepActionLabel={t("bulk_keep_selected")}
        bulkDeferActionLabel={t("bulk_defer_selected")}
        bulkDeleteActionLabel={t("bulk_delete_selected")}
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
        visibleCandidateCount={bulkActionDisabled ? 0 : cleanupState.visibleCandidates.length}
        queue={cleanupState.visibleCandidates}
        selectedCandidate={cleanupState.selectedCandidate}
        selectedFeed={cleanupState.selectedFeed}
        selectedMetrics={selectedMetrics}
        selectedSummary={cleanupState.selectedSummary}
        showDeferred={cleanupState.showDeferred}
        showDeferredLabel={cleanupState.showDeferred ? t("hide_deferred") : t("show_deferred")}
        emptyLabel={t("empty")}
        keepLabel={t("keep")}
        laterLabel={t("defer")}
        currentStatusLabel={t("current_status")}
        reviewStatusLabel={t("review_status")}
        selectedCountLabel={t("selected_count", { count: cleanupState.selectedFeedIds.size })}
        selectCandidateLabel={t("select_candidate")}
        selectedStateLabel={t("selected_state")}
        focusedStateLabel={t("focused_state")}
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
        priorityToneLabels={{
          high: t("priority_level_high"),
          medium: t("priority_level_medium"),
          low: t("priority_level_low"),
        }}
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
        onBackToIndex={() => openSubscriptionsIndex()}
        onClose={() => closeFeedCleanup()}
        onToggleIntegrityMode={cleanupState.toggleIntegrityMode}
        onToggleFilter={cleanupState.toggleFilter}
        onToggleShowDeferred={cleanupState.toggleShowDeferred}
        onKeepVisible={cleanupState.markVisibleCandidatesKept}
        onDeferVisible={cleanupState.markVisibleCandidatesDeferred}
        onSelectCandidate={cleanupState.selectCandidate}
        onToggleCandidateSelection={cleanupState.toggleCandidateSelection}
        onSelectIntegrityIssue={cleanupState.selectIntegrityIssue}
        onMoveFocusNext={cleanupState.moveFocusNext}
        onMoveFocusPrevious={cleanupState.moveFocusPrevious}
        onKeepDecision={() => {
          cleanupState.markSelectedCandidateKept();
          showDecisionToast("keep");
        }}
        onDeferDecision={() => {
          cleanupState.markSelectedCandidateDeferred();
          showDecisionToast("defer");
        }}
        onDeleteDecision={cleanupState.requestDeleteForDecisionTargets}
        onKeepCandidate={(feedId) => {
          cleanupState.markCandidateKept(feedId);
          showDecisionToast("keep");
        }}
        onDeferCandidate={(feedId) => {
          cleanupState.markCandidateDeferred(feedId);
          showDecisionToast("defer");
        }}
        onDeleteCandidate={cleanupState.requestDeleteForCandidate}
        onSyncReviewToFocus={cleanupState.syncReviewToFocusedCandidate}
        editing={cleanupState.isEditingSelectedFeed}
        editor={
          cleanupState.isEditingSelectedFeed && cleanupState.selectedFeed ? (
            <FeedCleanupFeedEditor
              key={cleanupState.selectedFeed.id}
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
        onEdit={cleanupState.startEditingSelectedFeed}
        selectedFeedIds={cleanupState.selectedFeedIds}
        focusedFeedId={cleanupState.focusedFeedId}
        currentStatusValue={cleanupState.selectedCandidate?.deferred ? t("defer") : t("review_status")}
        keyboardHints={{
          moveLabel: t("keyboard_move"),
          moveKeys: t("keyboard_move_keys"),
          selectLabel: t("keyboard_select"),
          selectKeys: t("keyboard_select_keys"),
          reviewLabel: t("keyboard_review"),
          reviewKeys: t("keyboard_review_keys"),
          keepKeys: t("keyboard_keep_keys"),
          deferKeys: t("keyboard_defer_keys"),
          deleteKeys: t("keyboard_delete_keys"),
        }}
        suspendKeyboardShortcuts={cleanupState.deleteTargets.length > 0}
        shortcutsLabel={t("shortcuts_open")}
        shortcutsTitle={t("shortcuts_title")}
        shortcutsNavigationLabel={t("shortcuts_navigation")}
        shortcutsActionsLabel={t("shortcuts_actions")}
        shortcutsHelpLabel={t("shortcuts_help")}
        shortcutItems={[
          {
            key: t("keyboard_move_keys").split(" / ")[0] ?? "J",
            label: t("shortcuts_next_feed"),
            category: "navigation",
          },
          {
            key: t("keyboard_move_keys").split(" / ")[1] ?? "K",
            label: t("shortcuts_previous_feed"),
            category: "navigation",
          },
          { key: t("keyboard_select_keys"), label: t("keyboard_select"), category: "navigation" },
          { key: t("keyboard_review_keys"), label: t("keep"), category: "actions" },
          { key: t("keyboard_defer_keys"), label: t("defer"), category: "actions" },
          { key: t("keyboard_delete_keys"), label: t("delete"), category: "actions" },
          { key: "?", label: t("shortcuts_help"), category: "actions" },
        ]}
      />

      <FeedCleanupDeleteDialog
        candidates={cleanupState.deleteTargets}
        open={cleanupState.deleteTargets.length > 0}
        title={t("delete_title")}
        bulkTitle={t("delete_bulk_title")}
        bulkSummary={t("delete_bulk_summary", { count: cleanupState.deleteTargets.length })}
        warningLabel={cleanupState.deleteTargets.length > 1 ? t("delete_warning_bulk") : t("delete_warning_single")}
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
        onConfirm={async () => {
          const targets = cleanupState.deleteTargets;
          if (targets.length === 0) {
            return;
          }

          const deletedFeedIds: string[] = [];

          for (const target of targets) {
            try {
              await deleteFeedMutation.mutateAsync({
                feedId: target.feedId,
                title: target.title,
                onSuccess: () => {
                  deletedFeedIds.push(target.feedId);
                },
              });
            } catch {
              break;
            }
          }

          if (deletedFeedIds.length > 0) {
            cleanupState.deleteSucceeded(deletedFeedIds);
          }
        }}
      />
    </>
  );
}
