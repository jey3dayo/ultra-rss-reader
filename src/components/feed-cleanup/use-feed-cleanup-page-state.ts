import { useEffect, useMemo, useReducer } from "react";
import type { FeedCleanupCandidate } from "@/lib/feed-cleanup";
import { buildFeedCleanupCandidates, summarizeCleanupCandidate } from "@/lib/feed-cleanup";
import type {
  FeedCleanupFilterKey,
  FeedCleanupPageAction,
  FeedCleanupPageInput,
  FeedCleanupPageState,
} from "./feed-cleanup.types";

function createInitialState(): FeedCleanupPageState {
  return {
    activeFilters: new Set(),
    keptFeedIds: new Set(),
    deferredFeedIds: new Set(),
    showDeferred: false,
    selectedFeedId: null,
    deleteTargetId: null,
    editingFeedId: null,
    queueMode: "cleanup",
    selectedIntegrityFeedId: null,
  };
}

function reducer(state: FeedCleanupPageState, action: FeedCleanupPageAction): FeedCleanupPageState {
  switch (action.type) {
    case "toggle-filter": {
      const next = new Set(state.activeFilters);
      if (next.has(action.key)) {
        next.delete(action.key);
      } else {
        next.add(action.key);
      }
      return { ...state, activeFilters: next };
    }
    case "toggle-show-deferred":
      return { ...state, showDeferred: !state.showDeferred };
    case "set-selected-feed-id":
      if (state.selectedFeedId === action.feedId) {
        return state;
      }
      return { ...state, selectedFeedId: action.feedId };
    case "set-selected-integrity-feed-id":
      if (state.selectedIntegrityFeedId === action.feedId) {
        return state;
      }
      return { ...state, selectedIntegrityFeedId: action.feedId };
    case "toggle-queue-mode":
      return { ...state, queueMode: state.queueMode === "integrity" ? "cleanup" : "integrity" };
    case "set-queue-mode":
      return { ...state, queueMode: action.mode };
    case "set-editing-feed-id":
      if (state.editingFeedId === action.feedId) {
        return state;
      }
      return { ...state, editingFeedId: action.feedId };
    case "set-delete-target-id":
      if (state.deleteTargetId === action.feedId) {
        return state;
      }
      return { ...state, deleteTargetId: action.feedId };
    case "mark-kept": {
      const next = new Set(state.keptFeedIds);
      next.add(action.feedId);
      return { ...state, keptFeedIds: next };
    }
    case "mark-many-kept": {
      const next = new Set(state.keptFeedIds);
      for (const feedId of action.feedIds) {
        next.add(feedId);
      }
      return { ...state, keptFeedIds: next };
    }
    case "mark-deferred": {
      const next = new Set(state.deferredFeedIds);
      next.add(action.feedId);
      return { ...state, deferredFeedIds: next };
    }
    case "mark-many-deferred": {
      const next = new Set(state.deferredFeedIds);
      for (const feedId of action.feedIds) {
        next.add(feedId);
      }
      return { ...state, deferredFeedIds: next };
    }
    case "delete-succeeded": {
      const keptFeedIds = new Set(state.keptFeedIds);
      keptFeedIds.add(action.feedId);

      const deferredFeedIds = new Set(state.deferredFeedIds);
      deferredFeedIds.delete(action.feedId);

      return {
        ...state,
        keptFeedIds,
        deferredFeedIds,
        deleteTargetId: null,
        selectedFeedId: state.selectedFeedId === action.feedId ? null : state.selectedFeedId,
      };
    }
    default:
      return state;
  }
}

function candidateMatchesFilters(candidate: FeedCleanupCandidate, activeFilters: ReadonlySet<FeedCleanupFilterKey>) {
  if (activeFilters.size === 0) {
    return true;
  }

  return [...activeFilters].every((filter) => candidate.reasonKeys.includes(filter));
}

export function useFeedCleanupPageState({
  feedCleanupOpen,
  devIntent,
  feeds,
  folders,
  accountArticles,
  integrityReport,
}: FeedCleanupPageInput) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  const hiddenFeedIds = useMemo(() => {
    const hidden = new Set(state.keptFeedIds);
    if (!state.showDeferred) {
      for (const feedId of state.deferredFeedIds) {
        hidden.add(feedId);
      }
    }
    return hidden;
  }, [state.deferredFeedIds, state.keptFeedIds, state.showDeferred]);

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
        deferred: state.deferredFeedIds.has(candidate.feedId),
      })),
    [accountArticles, feeds, folders, hiddenFeedIds, state.deferredFeedIds],
  );

  const visibleCandidates = useMemo(
    () => allCandidates.filter((candidate) => candidateMatchesFilters(candidate, state.activeFilters)),
    [allCandidates, state.activeFilters],
  );

  const filterCounts = useMemo(
    () =>
      ({
        stale_90d: allCandidates.filter((candidate) => candidate.reasonKeys.includes("stale_90d")).length,
        no_unread: allCandidates.filter((candidate) => candidate.reasonKeys.includes("no_unread")).length,
        no_stars: allCandidates.filter((candidate) => candidate.reasonKeys.includes("no_stars")).length,
      }) satisfies Record<FeedCleanupFilterKey, number>,
    [allCandidates],
  );

  const selectedCandidate = visibleCandidates.find((candidate) => candidate.feedId === state.selectedFeedId) ?? null;
  const selectedFeed = feeds.find((feed) => feed.id === state.selectedFeedId) ?? null;
  const integrityIssues = integrityReport?.orphaned_feeds ?? [];
  const selectedIntegrityIssue =
    integrityIssues.find((issue) => issue.missing_feed_id === state.selectedIntegrityFeedId) ??
    integrityIssues[0] ??
    null;
  const deleteTarget =
    state.deleteTargetId == null
      ? null
      : (allCandidates.find((candidate) => candidate.feedId === state.deleteTargetId) ?? null);
  const selectedSummary = selectedCandidate ? summarizeCleanupCandidate(selectedCandidate) : null;
  const reviewNowCount = visibleCandidates.filter(
    (candidate) => summarizeCleanupCandidate(candidate).tone === "high",
  ).length;
  const deferredCount = state.deferredFeedIds.size;
  const isEditingSelectedFeed = state.selectedFeedId !== null && state.editingFeedId === state.selectedFeedId;

  useEffect(() => {
    if (!feedCleanupOpen) {
      return;
    }

    const nextSelectedFeedId = visibleCandidates[0]?.feedId ?? null;
    if (state.selectedFeedId === nextSelectedFeedId) {
      return;
    }

    dispatch({ type: "set-selected-feed-id", feedId: nextSelectedFeedId });
  }, [feedCleanupOpen, state.selectedFeedId, visibleCandidates]);

  useEffect(() => {
    if (state.queueMode !== "integrity") {
      return;
    }

    if (integrityIssues.some((issue) => issue.missing_feed_id === state.selectedIntegrityFeedId)) {
      return;
    }

    const nextSelectedIntegrityFeedId = integrityIssues[0]?.missing_feed_id ?? null;
    if (state.selectedIntegrityFeedId === nextSelectedIntegrityFeedId) {
      return;
    }

    dispatch({
      type: "set-selected-integrity-feed-id",
      feedId: nextSelectedIntegrityFeedId,
    });
  }, [integrityIssues, state.queueMode, state.selectedIntegrityFeedId]);

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

    dispatch({ type: "set-editing-feed-id", feedId: null });
    dispatch({ type: "set-queue-mode", mode: "integrity" });
  }, [devIntent, feedCleanupOpen, integrityIssues.length]);

  useEffect(() => {
    if (!state.selectedFeedId || state.editingFeedId === state.selectedFeedId) {
      return;
    }

    dispatch({ type: "set-editing-feed-id", feedId: null });
  }, [state.editingFeedId, state.selectedFeedId]);

  return {
    activeFilters: state.activeFilters,
    filterCounts,
    showDeferred: state.showDeferred,
    visibleCandidates,
    selectedCandidate,
    selectedSummary,
    integrityMode: state.queueMode === "integrity",
    integrityIssues,
    selectedIntegrityIssue,
    selectedFeed,
    deleteTarget,
    isEditingSelectedFeed,
    reviewNowCount,
    deferredCount,
    toggleFilter: (key: FeedCleanupFilterKey) => dispatch({ type: "toggle-filter", key }),
    toggleShowDeferred: () => dispatch({ type: "toggle-show-deferred" }),
    toggleIntegrityMode: () => dispatch({ type: "toggle-queue-mode" }),
    selectCandidate: (feedId: string) => dispatch({ type: "set-selected-feed-id", feedId }),
    selectIntegrityIssue: (feedId: string) => dispatch({ type: "set-selected-integrity-feed-id", feedId }),
    startEditingSelectedFeed: () => {
      if (state.selectedFeedId) {
        dispatch({ type: "set-editing-feed-id", feedId: state.selectedFeedId });
      }
    },
    cancelEditingSelectedFeed: () => dispatch({ type: "set-editing-feed-id", feedId: null }),
    requestDeleteForSelectedCandidate: () => {
      if (selectedCandidate) {
        dispatch({ type: "set-delete-target-id", feedId: selectedCandidate.feedId });
      }
    },
    requestDeleteForSelectedFeed: () => {
      if (selectedFeed) {
        dispatch({ type: "set-delete-target-id", feedId: selectedFeed.id });
      }
    },
    clearDeleteTarget: () => dispatch({ type: "set-delete-target-id", feedId: null }),
    markSelectedCandidateKept: () => {
      if (selectedCandidate) {
        dispatch({ type: "mark-kept", feedId: selectedCandidate.feedId });
      }
    },
    markVisibleCandidatesKept: () => {
      if (visibleCandidates.length > 0) {
        dispatch({ type: "mark-many-kept", feedIds: visibleCandidates.map((candidate) => candidate.feedId) });
      }
    },
    markSelectedCandidateDeferred: () => {
      if (selectedCandidate) {
        dispatch({ type: "mark-deferred", feedId: selectedCandidate.feedId });
      }
    },
    markVisibleCandidatesDeferred: () => {
      if (visibleCandidates.length > 0) {
        dispatch({
          type: "mark-many-deferred",
          feedIds: visibleCandidates.map((candidate) => candidate.feedId),
        });
      }
    },
    deleteSucceeded: (feedId: string) => dispatch({ type: "delete-succeeded", feedId }),
  };
}
