import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { queryKeys } from "@/lib/query/query-invalidation";

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

export function useCancelReaderQueriesOnAccountSwitch(selectedAccountId: string | null): void {
  const queryClient = useQueryClient();
  const previousAccountIdRef = useRef(selectedAccountId);

  useEffect(() => {
    const previousAccountId = previousAccountIdRef.current;
    previousAccountIdRef.current = selectedAccountId;

    if (previousAccountId === selectedAccountId) {
      return;
    }

    for (const queryKey of ACCOUNT_SWITCH_QUERY_ROOTS) {
      void queryClient.cancelQueries({ queryKey });
    }

    return scheduleAccountSwitchBudgetSmoke(previousAccountId, selectedAccountId);
  }, [queryClient, selectedAccountId]);
}
