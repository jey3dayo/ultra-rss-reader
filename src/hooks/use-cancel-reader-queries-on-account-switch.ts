import type { Query, QueryKey } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { normalizeQueryAccountId, queryKeys } from "@/lib/query/query-invalidation";

export const ACCOUNT_SWITCH_RENDER_BUDGET_MS = 120;
export const ACCOUNT_SWITCH_MEMORY_BUDGET_BYTES = 8 * 1024 * 1024;

export const ACCOUNT_SWITCH_QUERY_ROOTS = [
  queryKeys.feeds.root,
  queryKeys.folders.root,
  queryKeys.accountArticles.root,
  queryKeys.starredArticles.root,
  queryKeys.recentArticles.root,
  queryKeys.accountUnreadCount.root,
  queryKeys.accountStarredCount.root,
  queryKeys.articlesByTag.root,
  queryKeys.tagArticleCounts.root,
  queryKeys.search.root,
] as const;

export type AccountSwitchBudgetSample = {
  previousAccountId: string | null;
  selectedAccountId: string | null;
  renderDurationMs: number;
  memoryDeltaBytes: number | null;
};

type PerformanceMemory = {
  usedJSHeapSize?: number;
};

type AccountSwitchPerformance = Pick<Performance, "now"> & {
  memory?: PerformanceMemory;
};

function readUsedJsHeapSize(performanceApi: AccountSwitchPerformance): number | null {
  const usedJsHeapSize = performanceApi.memory?.usedJSHeapSize;
  return typeof usedJsHeapSize === "number" && Number.isFinite(usedJsHeapSize) ? usedJsHeapSize : null;
}

export function createAccountSwitchBudgetSample(params: {
  previousAccountId: string | null;
  selectedAccountId: string | null;
  startedAtMs: number;
  finishedAtMs: number;
  startedHeapBytes: number | null;
  finishedHeapBytes: number | null;
}): AccountSwitchBudgetSample {
  const { previousAccountId, selectedAccountId, startedAtMs, finishedAtMs, startedHeapBytes, finishedHeapBytes } =
    params;

  return {
    previousAccountId,
    selectedAccountId,
    renderDurationMs: Math.max(0, finishedAtMs - startedAtMs),
    memoryDeltaBytes:
      startedHeapBytes === null || finishedHeapBytes === null
        ? null
        : Math.max(0, finishedHeapBytes - startedHeapBytes),
  };
}

export function accountSwitchBudgetSampleExceedsBudget(sample: AccountSwitchBudgetSample): boolean {
  return (
    sample.renderDurationMs > ACCOUNT_SWITCH_RENDER_BUDGET_MS ||
    (sample.memoryDeltaBytes !== null && sample.memoryDeltaBytes > ACCOUNT_SWITCH_MEMORY_BUDGET_BYTES)
  );
}

function reportAccountSwitchBudgetSample(sample: AccountSwitchBudgetSample): void {
  if (!import.meta.env.DEV) {
    return;
  }

  if (!accountSwitchBudgetSampleExceedsBudget(sample)) {
    return;
  }

  console.warn("Large account switch exceeded the smoke budget.", sample);
}

function scheduleAccountSwitchBudgetSmoke(
  previousAccountId: string | null,
  selectedAccountId: string | null,
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const performanceApi = window.performance as AccountSwitchPerformance | undefined;
  if (performanceApi === undefined || typeof performanceApi.now !== "function") {
    return () => undefined;
  }

  const startedAtMs = performanceApi.now();
  const startedHeapBytes = readUsedJsHeapSize(performanceApi);

  const captureSample = () => {
    const finishedAtMs = performanceApi.now();
    const finishedHeapBytes = readUsedJsHeapSize(performanceApi);
    reportAccountSwitchBudgetSample(
      createAccountSwitchBudgetSample({
        previousAccountId,
        selectedAccountId,
        startedAtMs,
        finishedAtMs,
        startedHeapBytes,
        finishedHeapBytes,
      }),
    );
  };

  if (typeof window.requestAnimationFrame === "function" && typeof window.cancelAnimationFrame === "function") {
    const frame = window.requestAnimationFrame(captureSample);
    return () => window.cancelAnimationFrame(frame);
  }

  const timeout = window.setTimeout(captureSample, 0);
  return () => window.clearTimeout(timeout);
}

function queryKeyHasRootPrefix(queryKey: QueryKey, root: QueryKey): boolean {
  if (queryKey.length < root.length) {
    return false;
  }

  return root.every((rootSegment, index) => queryKey[index] === rootSegment);
}

// Position-independent on purpose: each root embeds its accountId at a different
// index (e.g. accountArticles is [...root, accountId], articlesByTag is
// [...root, tagId, accountId, mode]). A positional lookup silently breaks the
// invariant below if a key shape changes; scanning the whole key cannot, because
// a false "not found" only makes this function fail closed (skip cancelling),
// never fail open (cancel the incoming account's query).
function queryKeyIncludesAccountId(queryKey: QueryKey, normalizedAccountId: string | null): boolean {
  return queryKey.includes(normalizedAccountId);
}

// Invariant: an account switch must never cancel a query that belongs to the
// account being switched TO. Cancelling by root alone (the previous
// implementation) cannot honor this: Sidebar and ArticleList both call this
// hook, Sidebar's effect runs first, and by the time ArticleList's effect runs
// Sidebar may have already started fetching the new account's data under the
// same root. A root-only cancelQueries call then cancels that fresh fetch,
// leaving the incoming account's query stuck at fetchStatus "idle" with no
// automatic retry (React Query does not retry a cancelled fetch).
//
// NOTE: feeds/folders currently escape this failure mode in practice only
// because ArticleList independently subscribes to them too (see
// use-article-list-sources.ts), so a second fetch happens to be kicked off
// after the cancellation. That is an accidental side effect of duplicate
// subscription, not a guarantee this hook can rely on: if that duplicate
// subscription is ever removed, feeds/folders would silently regress into the
// same stuck-query bug as the sidebar-only roots (accountStarredCount,
// tagArticleCounts, feedArticleSummaries). The predicate below removes the
// dependency on that accident by protecting the incoming account's query for
// every root, regardless of who else happens to be subscribed.
//
// Known limitation: the whole-key scan can also false-positive-match a query
// that doesn't actually belong to the incoming account. Example:
// queryKeys.search.byAccountAndQuery(accountId, query) embeds the search
// text as a bare array element, so a search query for account A whose query
// text happens to equal the incoming account B's id (e.g. searching for the
// literal string "acc-2") looks like it "contains" B and is skipped. The only
// consequence is that A's now-stale search fetch is left in flight (wasted
// network work) -- it does not touch B's query, so the invariant above still
// holds. We deliberately don't fix this by reading accountId from a
// per-root position map: that reintroduces the exact fail-open risk this
// design avoids (a key-shape change silently making the position wrong would
// cancel the incoming account's query again), to prevent an extremely rare
// and harmless wasted request.
function isAccountSwitchCancelTarget(query: Query, normalizedSelectedAccountId: string | null): boolean {
  const matchesRoot = ACCOUNT_SWITCH_QUERY_ROOTS.some((root) => queryKeyHasRootPrefix(query.queryKey, root));

  if (!matchesRoot) {
    return false;
  }

  return !queryKeyIncludesAccountId(query.queryKey, normalizedSelectedAccountId);
}

export function useCancelReaderQueriesOnAccountSwitch(selectedAccountId: string | null): void {
  const queryClient = useQueryClient();
  const previousAccountIdRef = useRef(selectedAccountId);

  useEffect(() => {
    const previousAccountId = previousAccountIdRef.current;
    previousAccountIdRef.current = selectedAccountId;

    if (previousAccountId === selectedAccountId) {
      return;
    }

    const normalizedSelectedAccountId = normalizeQueryAccountId(selectedAccountId);
    void queryClient.cancelQueries({
      predicate: (query) => isAccountSwitchCancelTarget(query, normalizedSelectedAccountId),
    });

    return scheduleAccountSwitchBudgetSmoke(previousAccountId, selectedAccountId);
  }, [queryClient, selectedAccountId]);
}
