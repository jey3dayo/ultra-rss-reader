import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAccountArticles, useFeedIntegrityReport } from "@/hooks/use-articles";
import { useDeleteFeed } from "@/hooks/use-delete-feed";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { readDevIntent } from "@/lib/dev-intent";
import {
  buildFeedCleanupCandidates,
  type FeedCleanupCandidate,
  type FeedCleanupReasonKey,
  summarizeCleanupCandidate,
} from "@/lib/feed-cleanup";
import { useUiStore } from "@/stores/ui-store";
import { FeedCleanupDeleteDialog } from "./feed-cleanup-delete-dialog";
import { FeedCleanupFeedEditor } from "./feed-cleanup-feed-editor";
import { FeedCleanupPageView } from "./feed-cleanup-page-view";

type FilterKey = "stale_90d" | "no_unread" | "no_stars";
type QueueMode = "cleanup" | "integrity";

function candidateMatchesFilters(candidate: FeedCleanupCandidate, activeFilters: ReadonlySet<FilterKey>) {
  if (activeFilters.size === 0) {
    return true;
  }

  return [...activeFilters].every((filter) => candidate.reasonKeys.includes(filter));
}

export function FeedCleanupPage() {
  const { t } = useTranslation("cleanup");
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
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());
  const [keptFeedIds, setKeptFeedIds] = useState<Set<string>>(new Set());
  const [deferredFeedIds, setDeferredFeedIds] = useState<Set<string>>(new Set());
  const [showDeferred, setShowDeferred] = useState(false);
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null);
  const [queueMode, setQueueMode] = useState<QueueMode>("cleanup");
  const [selectedIntegrityFeedId, setSelectedIntegrityFeedId] = useState<string | null>(null);
  const devIntent = readDevIntent();

  const hiddenFeedIds = useMemo(() => {
    const hidden = new Set(keptFeedIds);
    if (!showDeferred) {
      for (const feedId of deferredFeedIds) {
        hidden.add(feedId);
      }
    }
    return hidden;
  }, [deferredFeedIds, keptFeedIds, showDeferred]);

  const allCandidates = useMemo(
    () =>
      buildFeedCleanupCandidates({
        feeds,
        folders,
        articles: accountArticles,
        now: new Date(),
        hiddenFeedIds,
      }).map((candidate) => ({
        ...candidate,
        deferred: deferredFeedIds.has(candidate.feedId),
      })),
    [accountArticles, deferredFeedIds, feeds, folders, hiddenFeedIds],
  );

  const visibleCandidates = useMemo(
    () => allCandidates.filter((candidate) => candidateMatchesFilters(candidate, activeFilters)),
    [activeFilters, allCandidates],
  );

  useEffect(() => {
    if (!feedCleanupOpen) {
      return;
    }

    if (visibleCandidates.some((candidate) => candidate.feedId === selectedFeedId)) {
      return;
    }

    setSelectedFeedId(visibleCandidates[0]?.feedId ?? null);
  }, [feedCleanupOpen, selectedFeedId, visibleCandidates]);

  const selectedCandidate = visibleCandidates.find((candidate) => candidate.feedId === selectedFeedId) ?? null;
  const selectedFeed = feeds.find((feed) => feed.id === selectedFeedId) ?? null;
  const integrityIssues = integrityReport?.orphaned_feeds ?? [];
  const selectedIntegrityIssue =
    integrityIssues.find((issue) => issue.missing_feed_id === selectedIntegrityFeedId) ?? integrityIssues[0] ?? null;
  const deleteTarget =
    deleteTargetId == null ? null : (allCandidates.find((candidate) => candidate.feedId === deleteTargetId) ?? null);

  useEffect(() => {
    if (queueMode !== "integrity") {
      return;
    }

    if (integrityIssues.some((issue) => issue.missing_feed_id === selectedIntegrityFeedId)) {
      return;
    }

    setSelectedIntegrityFeedId(integrityIssues[0]?.missing_feed_id ?? null);
  }, [integrityIssues, queueMode, selectedIntegrityFeedId]);

  useEffect(() => {
    if (!feedCleanupOpen) {
      return;
    }

    if (devIntent !== "open-feed-cleanup-broken-references") {
      return;
    }

    if (integrityIssues.length === 0) {
      return;
    }

    setQueueMode("integrity");
    setEditingFeedId(null);
  }, [devIntent, feedCleanupOpen, integrityIssues.length]);

  useEffect(() => {
    if (!selectedFeedId || editingFeedId === selectedFeedId) {
      return;
    }

    setEditingFeedId(null);
  }, [editingFeedId, selectedFeedId]);

  const filterOptions: Array<{ key: FilterKey; label: string }> = [
    { key: "stale_90d", label: t("stale_90d") },
    { key: "no_unread", label: t("no_unread") },
    { key: "no_stars", label: t("no_stars") },
  ];
  const filterCounts: Record<FilterKey, number> = {
    stale_90d: allCandidates.filter((candidate) => candidate.reasonKeys.includes("stale_90d")).length,
    no_unread: allCandidates.filter((candidate) => candidate.reasonKeys.includes("no_unread")).length,
    no_stars: allCandidates.filter((candidate) => candidate.reasonKeys.includes("no_stars")).length,
  };

  const reasonLabels: Record<FeedCleanupReasonKey, string> = {
    stale_90d: t("reason_stale_90d"),
    no_unread: t("reason_no_unread"),
    no_stars: t("reason_no_stars"),
  };
  const selectedSummary = selectedCandidate ? summarizeCleanupCandidate(selectedCandidate) : null;
  const summaryCards = [
    {
      label: t("summary_candidates"),
      value: String(visibleCandidates.length),
      caption: t("summary_candidates_caption", { count: visibleCandidates.length }),
    },
    {
      label: t("summary_review_now"),
      value: String(
        visibleCandidates.filter((candidate) => summarizeCleanupCandidate(candidate).tone === "high").length,
      ),
      caption: t("summary_review_now_caption", {
        count: visibleCandidates.filter((candidate) => summarizeCleanupCandidate(candidate).tone === "high").length,
      }),
    },
    {
      label: t("summary_deferred"),
      value: String(deferredFeedIds.size),
      caption: t("summary_deferred_caption", { count: deferredFeedIds.size }),
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
                actionLabel: queueMode === "integrity" ? t("show_cleanup_queue") : t("show_broken_references"),
              }
            : null
        }
        integrityMode={queueMode === "integrity"}
        integrityQueueLabel={t("integrity_queue")}
        integrityEmptyLabel={t("integrity_empty")}
        integrityIssues={integrityIssues}
        selectedIntegrityIssue={selectedIntegrityIssue}
        integrityDetailLabels={{
          missing_feed_id: t("integrity_missing_feed_id"),
          article_count: t("integrity_article_count"),
          latest_article: t("integrity_latest_article"),
          latest_published_at: t("integrity_latest_published_at"),
          needs_repair: t("integrity_needs_repair"),
          needs_repair_badge: t("integrity_needs_repair_badge"),
          summary: t("integrity_issue_summary", { count: selectedIntegrityIssue?.article_count ?? 0 }),
          unknown_article: t("integrity_unknown_article"),
          queue_item_title: t("integrity_queue_item_title"),
          queue_item_articles_label: t("integrity_queue_item_articles_label"),
          filter_note: t("integrity_filter_note"),
        }}
        filterOptions={filterOptions}
        filterCounts={filterCounts}
        activeFilterKeys={activeFilters}
        queue={visibleCandidates}
        selectedCandidate={selectedCandidate}
        selectedSummary={selectedSummary}
        showDeferred={showDeferred}
        showDeferredLabel={showDeferred ? t("hide_deferred") : t("show_deferred")}
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
        onToggleIntegrityMode={() => {
          setQueueMode((current) => (current === "integrity" ? "cleanup" : "integrity"));
          setEditingFeedId(null);
        }}
        onToggleFilter={(key) => {
          setActiveFilters((current) => {
            const next = new Set(current);
            if (next.has(key)) {
              next.delete(key);
            } else {
              next.add(key);
            }
            return next;
          });
        }}
        onToggleShowDeferred={() => setShowDeferred((current) => !current)}
        onSelectCandidate={setSelectedFeedId}
        onSelectIntegrityIssue={(missingFeedId) => setSelectedIntegrityFeedId(missingFeedId)}
        editing={selectedFeed != null && editingFeedId === selectedFeed.id}
        editor={
          selectedFeed != null && editingFeedId === selectedFeed.id ? (
            <FeedCleanupFeedEditor
              feed={selectedFeed}
              folders={folders}
              maintenanceTitle={t("editor_maintenance_title")}
              maintenanceDescription={t("editor_maintenance_description")}
              refetchLabel={t("editor_refetch")}
              unsubscribeLabel={tr("unsubscribe")}
              onCancel={() => setEditingFeedId(null)}
              onDelete={() => setDeleteTargetId(selectedFeed.id)}
              onSaved={() => setEditingFeedId(null)}
            />
          ) : null
        }
        onKeep={() => {
          if (!selectedCandidate) {
            return;
          }
          setKeptFeedIds((current) => new Set(current).add(selectedCandidate.feedId));
        }}
        onEdit={() => {
          if (!selectedFeedId) {
            return;
          }
          setEditingFeedId(selectedFeedId);
        }}
        onLater={() => {
          if (!selectedCandidate) {
            return;
          }
          setDeferredFeedIds((current) => new Set(current).add(selectedCandidate.feedId));
        }}
        onDelete={() => {
          if (!selectedCandidate) {
            return;
          }
          setDeleteTargetId(selectedCandidate.feedId);
        }}
      />

      <FeedCleanupDeleteDialog
        candidate={deleteTarget ?? null}
        open={deleteTargetId != null}
        title={t("delete_title")}
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
            setDeleteTargetId(null);
          }
        }}
        onConfirm={() => {
          if (!deleteTarget) {
            return;
          }

          void deleteFeedMutation
            .mutateAsync({
              feedId: deleteTarget.feedId,
              title: deleteTarget.title,
              onSuccess: () => {
                setKeptFeedIds((current) => new Set(current).add(deleteTarget.feedId));
                setDeferredFeedIds((current) => {
                  const next = new Set(current);
                  next.delete(deleteTarget.feedId);
                  return next;
                });
                setDeleteTargetId(null);
                if (selectedFeedId === deleteTarget.feedId) {
                  setSelectedFeedId(null);
                }
              },
            })
            .catch(() => undefined);
        }}
      />
    </>
  );
}
