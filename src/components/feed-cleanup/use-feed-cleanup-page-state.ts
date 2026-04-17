import { useEffect, useMemo, useReducer } from "react";
import type { FeedCleanupCandidate } from "@/lib/feed-cleanup";
import { buildFeedCleanupCandidates, summarizeCleanupCandidate } from "@/lib/feed-cleanup";
import type {
  FeedCleanupDecisionStatus,
  FeedCleanupFilterKey,
  FeedCleanupLastDecisionAction,
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
    focusedFeedId: null,
    selectedFeedIds: new Set(),
    deleteTargetIds: [],
    editingFeedId: null,
    queueMode: "cleanup",
    selectedIntegrityFeedId: null,
    lastDecisionAction: null,
  };
}

function applyDecisionState(
  state: FeedCleanupPageState,
  decision: Exclude<FeedCleanupDecisionStatus, "review">,
  feedIds: string[],
): FeedCleanupPageState {
  const keptFeedIds = new Set(state.keptFeedIds);
  const deferredFeedIds = new Set(state.deferredFeedIds);

  const lastDecisionAction: FeedCleanupLastDecisionAction = {
    decision,
    feedIds,
    previousKeptFeedIds: feedIds.filter((feedId) => state.keptFeedIds.has(feedId)),
    previousDeferredFeedIds: feedIds.filter((feedId) => state.deferredFeedIds.has(feedId)),
  };

  for (const feedId of feedIds) {
    if (decision === "keep") {
      keptFeedIds.add(feedId);
      deferredFeedIds.delete(feedId);
      continue;
    }

    deferredFeedIds.add(feedId);
    keptFeedIds.delete(feedId);
  }

  return {
    ...state,
    keptFeedIds,
    deferredFeedIds,
    selectedFeedIds: new Set(),
    deleteTargetIds: [],
    lastDecisionAction,
  };
}

function undoDecisionState(state: FeedCleanupPageState): FeedCleanupPageState {
  if (!state.lastDecisionAction) {
    return state;
  }

  const keptFeedIds = new Set(state.keptFeedIds);
  const deferredFeedIds = new Set(state.deferredFeedIds);

  for (const feedId of state.lastDecisionAction.feedIds) {
    if (state.lastDecisionAction.previousKeptFeedIds.includes(feedId)) {
      keptFeedIds.add(feedId);
    } else {
      keptFeedIds.delete(feedId);
    }

    if (state.lastDecisionAction.previousDeferredFeedIds.includes(feedId)) {
      deferredFeedIds.add(feedId);
    } else {
      deferredFeedIds.delete(feedId);
    }
  }

  return {
    ...state,
    keptFeedIds,
    deferredFeedIds,
    lastDecisionAction: null,
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
    case "set-active-filters":
      return { ...state, activeFilters: new Set(action.keys) };
    case "toggle-show-deferred":
      return { ...state, showDeferred: !state.showDeferred };
    case "set-selected-feed-id":
      if (state.selectedFeedId === action.feedId) {
        return state;
      }
      return { ...state, selectedFeedId: action.feedId };
    case "set-focused-feed-id":
      if (state.focusedFeedId === action.feedId) {
        return state;
      }
      return { ...state, focusedFeedId: action.feedId };
    case "toggle-selected-feed-id": {
      const next = new Set(state.selectedFeedIds);
      if (next.has(action.feedId)) {
        next.delete(action.feedId);
      } else {
        next.add(action.feedId);
      }
      return { ...state, selectedFeedIds: next };
    }
    case "clear-selected-feed-ids":
      return state.selectedFeedIds.size === 0 ? state : { ...state, selectedFeedIds: new Set() };
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
    case "set-delete-target-ids":
      return { ...state, deleteTargetIds: action.feedIds };
    case "apply-decision":
      return action.feedIds.length === 0 ? state : applyDecisionState(state, action.decision, action.feedIds);
    case "undo-last-decision":
      return undoDecisionState(state);
    case "delete-succeeded": {
      const keptFeedIds = new Set(state.keptFeedIds);
      const deferredFeedIds = new Set(state.deferredFeedIds);
      const selectedFeedIds = new Set(state.selectedFeedIds);

      for (const feedId of action.feedIds) {
        keptFeedIds.add(feedId);
        deferredFeedIds.delete(feedId);
        selectedFeedIds.delete(feedId);
      }

      return {
        ...state,
        keptFeedIds,
        deferredFeedIds,
        selectedFeedIds,
        deleteTargetIds: [],
        selectedFeedId: action.feedIds.includes(state.selectedFeedId ?? "") ? null : state.selectedFeedId,
        focusedFeedId: action.feedIds.includes(state.focusedFeedId ?? "") ? null : state.focusedFeedId,
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

function resolveDecisionTargetIds(
  state: Pick<FeedCleanupPageState, "focusedFeedId" | "selectedFeedId" | "selectedFeedIds">,
) {
  if (state.selectedFeedIds.size > 0) {
    return [...state.selectedFeedIds];
  }

  if (state.focusedFeedId) {
    return [state.focusedFeedId];
  }

  if (state.selectedFeedId) {
    return [state.selectedFeedId];
  }

  return [];
}

export function useFeedCleanupPageState({
  subscriptionsWorkspace,
  devIntent,
  feeds,
  folders,
  accountArticles,
  integrityReport,
}: FeedCleanupPageInput) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const cleanupWorkspaceOpen = subscriptionsWorkspace?.kind === "cleanup";

  const hiddenFeedIds = useMemo(() => {
    const hidden = new Set(state.keptFeedIds);
    if (!state.showDeferred) {
      for (const feedId of state.deferredFeedIds) {
        hidden.add(feedId);
      }
    }
    return hidden;
  }, [state.deferredFeedIds, state.keptFeedIds, state.showDeferred]);

  const rawCandidates = useMemo(
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
  const focusedCandidate = visibleCandidates.find((candidate) => candidate.feedId === state.focusedFeedId) ?? null;
  const deleteTargets = state.deleteTargetIds.flatMap((feedId) => {
    const candidate = allCandidates.find((entry) => entry.feedId === feedId);
    return candidate ? [candidate] : [];
  });
  const integrityIssues = integrityReport?.orphaned_feeds ?? [];
  const selectedIntegrityIssue =
    integrityIssues.find((issue) => issue.missing_feed_id === state.selectedIntegrityFeedId) ??
    integrityIssues[0] ??
    null;
  const selectedSummary = selectedCandidate ? summarizeCleanupCandidate(selectedCandidate) : null;
  const reviewNowCount = visibleCandidates.filter(
    (candidate) => summarizeCleanupCandidate(candidate).tone === "high",
  ).length;
  const deferredCount = state.deferredFeedIds.size;
  const pendingCount = rawCandidates.filter(
    (candidate) => !state.keptFeedIds.has(candidate.feedId) && !state.deferredFeedIds.has(candidate.feedId),
  ).length;
  const decidedCount = state.keptFeedIds.size + state.deferredFeedIds.size;
  const isEditingSelectedFeed = state.selectedFeedId !== null && state.editingFeedId === state.selectedFeedId;
  const decisionTargetIds = resolveDecisionTargetIds(state);

  useEffect(() => {
    if (!cleanupWorkspaceOpen) {
      return;
    }

    const firstVisibleFeedId = visibleCandidates[0]?.feedId ?? null;

    if (!visibleCandidates.some((candidate) => candidate.feedId === state.focusedFeedId)) {
      dispatch({ type: "set-focused-feed-id", feedId: firstVisibleFeedId });
    }

    if (!visibleCandidates.some((candidate) => candidate.feedId === state.selectedFeedId)) {
      dispatch({ type: "set-selected-feed-id", feedId: firstVisibleFeedId });
    }
  }, [cleanupWorkspaceOpen, state.focusedFeedId, state.selectedFeedId, visibleCandidates]);

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
    if (!cleanupWorkspaceOpen) {
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
  }, [cleanupWorkspaceOpen, devIntent, integrityIssues.length]);

  useEffect(() => {
    if (!cleanupWorkspaceOpen || subscriptionsWorkspace?.kind !== "cleanup") {
      return;
    }

    const context = subscriptionsWorkspace.cleanupContext;
    if (!context) {
      dispatch({ type: "set-active-filters", keys: [] });
      dispatch({ type: "set-queue-mode", mode: "cleanup" });
      return;
    }

    if (context.reason === "broken_references") {
      dispatch({ type: "set-active-filters", keys: [] });
      dispatch({ type: "set-queue-mode", mode: "integrity" });
      return;
    }

    if (context.reason === "stale_90d" || context.reason === "no_unread" || context.reason === "no_stars") {
      dispatch({ type: "set-active-filters", keys: [context.reason] });
    } else {
      dispatch({ type: "set-active-filters", keys: [] });
    }

    dispatch({ type: "set-queue-mode", mode: "cleanup" });
  }, [cleanupWorkspaceOpen, subscriptionsWorkspace]);

  useEffect(() => {
    if (!cleanupWorkspaceOpen || subscriptionsWorkspace?.kind !== "cleanup") {
      return;
    }

    const targetFeedId = subscriptionsWorkspace.cleanupContext?.feedId ?? null;
    if (!targetFeedId || !visibleCandidates.some((candidate) => candidate.feedId === targetFeedId)) {
      return;
    }

    dispatch({ type: "set-selected-feed-id", feedId: targetFeedId });
    dispatch({ type: "set-focused-feed-id", feedId: targetFeedId });
  }, [cleanupWorkspaceOpen, subscriptionsWorkspace, visibleCandidates]);

  useEffect(() => {
    if (!state.selectedFeedId || state.editingFeedId === state.selectedFeedId) {
      return;
    }

    dispatch({ type: "set-editing-feed-id", feedId: null });
  }, [state.editingFeedId, state.selectedFeedId]);

  const moveFocus = (direction: 1 | -1) => {
    if (visibleCandidates.length === 0) {
      return;
    }

    const currentIndex = visibleCandidates.findIndex((candidate) => candidate.feedId === state.focusedFeedId);
    const baseIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = Math.min(Math.max(baseIndex + direction, 0), visibleCandidates.length - 1);
    const nextFeedId = visibleCandidates[nextIndex]?.feedId ?? null;

    dispatch({ type: "set-focused-feed-id", feedId: nextFeedId });
  };

  return {
    activeFilters: state.activeFilters,
    filterCounts,
    allCandidateCount: allCandidates.length,
    showDeferred: state.showDeferred,
    visibleCandidates,
    selectedCandidate,
    focusedCandidate,
    focusedFeedId: state.focusedFeedId,
    selectedFeedIds: state.selectedFeedIds,
    selectedSummary,
    integrityMode: state.queueMode === "integrity",
    integrityIssues,
    selectedIntegrityIssue,
    selectedFeed,
    deleteTargets,
    lastDecisionAction: state.lastDecisionAction,
    isEditingSelectedFeed,
    reviewNowCount,
    pendingCount,
    decidedCount,
    deferredCount,
    decisionTargetIds,
    toggleFilter: (key: FeedCleanupFilterKey) => dispatch({ type: "toggle-filter", key }),
    toggleShowDeferred: () => dispatch({ type: "toggle-show-deferred" }),
    toggleIntegrityMode: () => dispatch({ type: "toggle-queue-mode" }),
    selectCandidate: (feedId: string) => {
      dispatch({ type: "set-focused-feed-id", feedId });
      dispatch({ type: "set-selected-feed-id", feedId });
    },
    selectIntegrityIssue: (feedId: string) => dispatch({ type: "set-selected-integrity-feed-id", feedId }),
    moveFocusNext: () => moveFocus(1),
    moveFocusPrevious: () => moveFocus(-1),
    syncReviewToFocusedCandidate: () => {
      if (state.focusedFeedId) {
        dispatch({ type: "set-selected-feed-id", feedId: state.focusedFeedId });
      }
    },
    toggleCandidateSelection: (feedId: string) => {
      dispatch({ type: "set-focused-feed-id", feedId });
      dispatch({ type: "toggle-selected-feed-id", feedId });
    },
    clearCandidateSelection: () => dispatch({ type: "clear-selected-feed-ids" }),
    startEditingSelectedFeed: () => {
      if (state.selectedFeedId) {
        dispatch({ type: "set-editing-feed-id", feedId: state.selectedFeedId });
      }
    },
    cancelEditingSelectedFeed: () => dispatch({ type: "set-editing-feed-id", feedId: null }),
    requestDeleteForSelectedCandidate: () => {
      const nextFeedIds =
        state.selectedFeedIds.size > 0
          ? [...state.selectedFeedIds]
          : state.selectedFeedId
            ? [state.selectedFeedId]
            : [];
      dispatch({ type: "set-delete-target-ids", feedIds: nextFeedIds });
    },
    requestDeleteForDecisionTargets: () => {
      dispatch({ type: "set-delete-target-ids", feedIds: decisionTargetIds });
    },
    requestDeleteForCandidate: (feedId: string) => {
      dispatch({ type: "set-focused-feed-id", feedId });
      dispatch({ type: "set-selected-feed-id", feedId });
      dispatch({ type: "set-delete-target-ids", feedIds: [feedId] });
    },
    requestDeleteForSelectedFeed: () => {
      if (selectedFeed) {
        dispatch({ type: "set-delete-target-ids", feedIds: [selectedFeed.id] });
      }
    },
    clearDeleteTarget: () => dispatch({ type: "set-delete-target-ids", feedIds: [] }),
    markSelectedCandidateKept: () => {
      dispatch({ type: "apply-decision", decision: "keep", feedIds: decisionTargetIds });
    },
    markCandidateKept: (feedId: string) => {
      dispatch({ type: "set-focused-feed-id", feedId });
      dispatch({ type: "set-selected-feed-id", feedId });
      dispatch({ type: "apply-decision", decision: "keep", feedIds: [feedId] });
    },
    markVisibleCandidatesKept: () => {
      if (visibleCandidates.length > 0) {
        dispatch({
          type: "apply-decision",
          decision: "keep",
          feedIds: visibleCandidates.map((candidate) => candidate.feedId),
        });
      }
    },
    markSelectedCandidateDeferred: () => {
      dispatch({ type: "apply-decision", decision: "defer", feedIds: decisionTargetIds });
    },
    markCandidateDeferred: (feedId: string) => {
      dispatch({ type: "set-focused-feed-id", feedId });
      dispatch({ type: "set-selected-feed-id", feedId });
      dispatch({ type: "apply-decision", decision: "defer", feedIds: [feedId] });
    },
    markVisibleCandidatesDeferred: () => {
      if (visibleCandidates.length > 0) {
        dispatch({
          type: "apply-decision",
          decision: "defer",
          feedIds: visibleCandidates.map((candidate) => candidate.feedId),
        });
      }
    },
    undoLastDecision: () => dispatch({ type: "undo-last-decision" }),
    deleteSucceeded: (feedIds: string[]) => dispatch({ type: "delete-succeeded", feedIds }),
  };
}
