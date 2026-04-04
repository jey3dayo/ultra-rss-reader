import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAccountArticles } from "@/hooks/use-articles";
import { useDeleteFeed } from "@/hooks/use-delete-feed";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { buildFeedCleanupCandidates, type FeedCleanupCandidate, type FeedCleanupReasonKey } from "@/lib/feed-cleanup";
import { useUiStore } from "@/stores/ui-store";
import { FeedCleanupDeleteDialog } from "./feed-cleanup-delete-dialog";
import { FeedCleanupPageView } from "./feed-cleanup-page-view";

type FilterKey = "stale_90d" | "no_unread" | "no_stars";

function candidateMatchesFilters(candidate: FeedCleanupCandidate, activeFilters: ReadonlySet<FilterKey>) {
  if (activeFilters.size === 0) {
    return true;
  }

  return [...activeFilters].every((filter) => candidate.reasonKeys.includes(filter));
}

export function FeedCleanupPage() {
  const { t } = useTranslation("cleanup");
  const { t: tc } = useTranslation("common");
  const feedCleanupOpen = useUiStore((state) => state.feedCleanupOpen);
  const closeFeedCleanup = useUiStore((state) => state.closeFeedCleanup);
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const deleteFeedMutation = useDeleteFeed();
  const { data: feeds = [] } = useFeeds(selectedAccountId);
  const { data: folders = [] } = useFolders(selectedAccountId);
  const { data: accountArticles = [] } = useAccountArticles(selectedAccountId);
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());
  const [keptFeedIds, setKeptFeedIds] = useState<Set<string>>(new Set());
  const [deferredFeedIds, setDeferredFeedIds] = useState<Set<string>>(new Set());
  const [showDeferred, setShowDeferred] = useState(false);
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

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
  const deleteTarget =
    deleteTargetId == null ? null : (allCandidates.find((candidate) => candidate.feedId === deleteTargetId) ?? null);

  const filterOptions: Array<{ key: FilterKey; label: string }> = [
    { key: "stale_90d", label: t("stale_90d") },
    { key: "no_unread", label: t("no_unread") },
    { key: "no_stars", label: t("no_stars") },
  ];

  const reasonLabels: Record<FeedCleanupReasonKey, string> = {
    stale_90d: t("reason_stale_90d"),
    no_unread: t("reason_no_unread"),
    no_stars: t("reason_no_stars"),
  };

  return (
    <>
      <FeedCleanupPageView
        open={feedCleanupOpen}
        title={t("title")}
        subtitle={t("subtitle")}
        filtersLabel={t("filters")}
        queueLabel={t("queue")}
        reviewLabel={t("review")}
        filterOptions={filterOptions}
        activeFilterKeys={activeFilters}
        queue={visibleCandidates}
        selectedCandidate={selectedCandidate}
        showDeferred={showDeferred}
        showDeferredLabel={showDeferred ? t("hide_deferred") : t("show_deferred")}
        emptyLabel={t("empty")}
        keepLabel={t("keep")}
        laterLabel={t("later")}
        deleteLabel={t("delete")}
        folderLabel={t("folder")}
        latestArticleLabel={t("latest_article")}
        unreadCountLabel={t("unread_count")}
        starredCountLabel={t("starred_count")}
        reasonsLabel={t("reasons")}
        noSelectionLabel={t("no_selection")}
        deferredBadgeLabel={t("deferred_badge")}
        reasonLabels={reasonLabels}
        onOpenChange={(open) => {
          if (!open) {
            closeFeedCleanup();
          }
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
        onKeep={() => {
          if (!selectedCandidate) {
            return;
          }
          setKeptFeedIds((current) => new Set(current).add(selectedCandidate.feedId));
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
