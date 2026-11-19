import { Result } from "@praha/byethrow";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import type { SyncResultDto } from "@/api/schemas";
import { getLocalFeedSyncStatuses, type LocalFeedSyncStatusDto, syncFeed } from "@/api/tauri-commands";
import { useAccounts } from "@/hooks/use-accounts";
import { invalidateFeedRetryQueries, queryKeys } from "@/lib/query/query-invalidation";
import { summarizeSyncResult } from "@/lib/sync/sync-result-feedback";
import { useUiStore } from "@/stores/ui-store";

export const localFeedSyncStatusesQueryKey = (accountId: string | null) =>
  queryKeys.localFeedSyncStatuses.byAccount(accountId);

type PendingFeedRetry = { accountId: string; feedId: string };
type FeedRetryVariables = PendingFeedRetry & { attempt: number };

export type FeedRetryOutcomeKind = "succeeded" | "busy" | "incomplete" | "failed" | "refresh-failed";

// settledAttemptAt is undefined until the post-retry status refresh settles, then pins the outcome to the status it explains.
type FeedRetryOutcome = {
  accountId: string;
  feedId: string;
  attempt: number;
  kind: FeedRetryOutcomeKind;
  settledAttemptAt?: string | null;
};

function getPendingFeedRetryKey({ accountId, feedId }: PendingFeedRetry): string {
  return JSON.stringify([accountId, feedId]);
}

// Retry state lives at module scope so it survives hook remounts (account switch, workspace reopen) while a retry
// is in flight; keys stay account-scoped so parallel accounts cannot cross-talk, and deletes remove exactly the
// keys added in retryFeed.
const pendingFeedRetryKeys = new Set<string>();
const feedRetryOutcomes = new Map<string, FeedRetryOutcome>();
const pendingFeedRetryListeners = new Set<() => void>();
let feedRetryStoreVersion = 0;
let lastFeedRetryAttempt = 0;

export function __resetFeedRetryStateForTests(): void {
  pendingFeedRetryKeys.clear();
  feedRetryOutcomes.clear();
}

function subscribePendingFeedRetryChanges(listener: () => void): () => void {
  pendingFeedRetryListeners.add(listener);
  return () => pendingFeedRetryListeners.delete(listener);
}

const getFeedRetryStoreVersion = () => feedRetryStoreVersion;

function notifyPendingFeedRetryChange(): void {
  feedRetryStoreVersion += 1;
  for (const notify of pendingFeedRetryListeners) {
    notify();
  }
}

function resolveRetryOutcomeKind(result: SyncResultDto): FeedRetryOutcomeKind {
  const feedback = summarizeSyncResult(result);
  if (feedback.kind === "already-in-progress") return "busy";
  return feedback.kind === "success" ? "succeeded" : "incomplete";
}

function recordFeedRetryOutcome(variables: FeedRetryVariables, kind: FeedRetryOutcomeKind): void {
  feedRetryOutcomes.set(getPendingFeedRetryKey(variables), {
    accountId: variables.accountId,
    feedId: variables.feedId,
    attempt: variables.attempt,
    kind,
  });
  notifyPendingFeedRetryChange();
}

function settleFeedRetryOutcome(
  variables: FeedRetryVariables,
  refreshed: boolean,
  settledAttemptAt: string | null | undefined,
): FeedRetryOutcomeKind | null {
  const key = getPendingFeedRetryKey(variables);
  const outcome = feedRetryOutcomes.get(key);
  if (outcome?.attempt !== variables.attempt) return null;
  if (refreshed && outcome.kind === "succeeded") {
    feedRetryOutcomes.delete(key);
    return outcome.kind;
  }
  const stale = !refreshed && (outcome.kind === "succeeded" || outcome.kind === "incomplete");
  feedRetryOutcomes.set(key, {
    ...outcome,
    kind: stale ? "refresh-failed" : outcome.kind,
    settledAttemptAt,
  });
  return outcome.kind;
}

// An outcome settled while its status query was inactive has no anchor; the first post-retry status read supplies it.
function anchorDeferredRetryOutcomes(accountId: string, statuses: LocalFeedSyncStatusDto[]): void {
  const lastAttemptByFeedId = new Map(statuses.map((status) => [status.feed_id, status.last_attempt_at]));
  for (const [key, outcome] of feedRetryOutcomes) {
    if (outcome.accountId !== accountId || outcome.settledAttemptAt !== undefined || pendingFeedRetryKeys.has(key)) {
      continue;
    }
    const lastAttemptAt = lastAttemptByFeedId.get(outcome.feedId) ?? null;
    feedRetryOutcomes.set(key, { ...outcome, settledAttemptAt: lastAttemptAt });
  }
}

export function useLocalFeedSyncStatuses(accountId: string | null) {
  const { data: accounts, isPending: accountsPending } = useAccounts();
  const { t } = useTranslation("subscriptions");
  const showToast = useUiStore((state) => state.showToast);
  const queryClient = useQueryClient();
  const normalizedAccountId = accountId?.trim() || null;
  const account = accounts?.find((candidate) => candidate.id === normalizedAccountId);
  const isLocalAccount = account?.kind.toLowerCase() === "local";
  useSyncExternalStore(subscribePendingFeedRetryChanges, getFeedRetryStoreVersion);

  const statusQuery = useQuery({
    queryKey: localFeedSyncStatusesQueryKey(isLocalAccount ? normalizedAccountId : null),
    queryFn: async () => {
      if (!normalizedAccountId || !isLocalAccount) {
        throw new Error("Local feed sync statuses require a local account.");
      }
      return Result.unwrap(await getLocalFeedSyncStatuses(normalizedAccountId));
    },
    enabled: Boolean(normalizedAccountId && isLocalAccount),
  });

  const statusesFresh = !statusQuery.isFetching && statusQuery.data !== undefined;
  useEffect(() => {
    if (!normalizedAccountId || !statusesFresh || !statusQuery.data) return;
    const statusKey = localFeedSyncStatusesQueryKey(normalizedAccountId);
    if (queryClient.getQueryState(statusKey)?.isInvalidated !== false) return;
    anchorDeferredRetryOutcomes(normalizedAccountId, statusQuery.data);
  }, [normalizedAccountId, statusesFresh, statusQuery.data, queryClient]);

  const retryMutation = useMutation({
    mutationFn: async ({ feedId }: FeedRetryVariables) => Result.unwrap(await syncFeed(feedId)),
    onSuccess: (result, variables) => {
      const kind = resolveRetryOutcomeKind(result);
      recordFeedRetryOutcome(variables, kind);
      // A successful retry clears the error card that would hold its result, so the success needs its own surface.
      if (kind === "succeeded" && useUiStore.getState().subscriptionsWorkspace?.accountId === variables.accountId) {
        showToast(t("fetch_error_retry_succeeded"));
      }
    },
    onError: (_error, variables) => {
      recordFeedRetryOutcome(variables, "failed");
    },
    onSettled: async (_data, _error, variables) => {
      try {
        const refreshed = await invalidateFeedRetryQueries(queryClient, variables.accountId, variables.feedId);
        const statusKey = localFeedSyncStatusesQueryKey(variables.accountId);
        // An inactive status query is only marked invalid, so its cache still predates the retry and cannot anchor the outcome.
        const statusRefetched = queryClient.getQueryState(statusKey)?.isInvalidated === false;
        const statuses = queryClient.getQueryData<LocalFeedSyncStatusDto[]>(statusKey);
        const settledAttemptAt = statusRefetched
          ? (statuses?.find((status) => status.feed_id === variables.feedId)?.last_attempt_at ?? null)
          : undefined;
        const resolvedKind = settleFeedRetryOutcome(variables, refreshed, settledAttemptAt);
        // The refreshed statuses can drop the error card that would hold a refresh failure, so it needs its own surface.
        if (
          !refreshed &&
          resolvedKind === "succeeded" &&
          useUiStore.getState().subscriptionsWorkspace?.accountId === variables.accountId
        ) {
          showToast({ message: t("fetch_error_refresh_failed"), severity: "error", persistent: true });
        }
      } finally {
        pendingFeedRetryKeys.delete(getPendingFeedRetryKey(variables));
        notifyPendingFeedRetryChange();
      }
    },
  });

  return {
    account,
    accountsPending,
    isLocalAccount,
    statusQuery,
    retryFeed: (feedId: string) => {
      if (!normalizedAccountId || !isLocalAccount) return;
      const retryKey = getPendingFeedRetryKey({ accountId: normalizedAccountId, feedId });
      if (pendingFeedRetryKeys.has(retryKey)) return;
      lastFeedRetryAttempt += 1;
      const variables = { accountId: normalizedAccountId, feedId, attempt: lastFeedRetryAttempt };
      pendingFeedRetryKeys.add(retryKey);
      feedRetryOutcomes.delete(retryKey);
      notifyPendingFeedRetryChange();
      retryMutation.mutate(variables);
    },
    retryOutcomeFor: (feedId: string): FeedRetryOutcomeKind | null => {
      if (!normalizedAccountId) return null;
      const outcome = feedRetryOutcomes.get(getPendingFeedRetryKey({ accountId: normalizedAccountId, feedId }));
      if (!outcome) return null;
      if (outcome.settledAttemptAt !== undefined) {
        const currentAttemptAt = statusQuery.data?.find((status) => status.feed_id === feedId)?.last_attempt_at;
        if ((currentAttemptAt ?? null) !== outcome.settledAttemptAt) return null;
      }
      return outcome.kind;
    },
    isRetryingFeed: (feedId: string) =>
      Boolean(
        normalizedAccountId &&
          pendingFeedRetryKeys.has(getPendingFeedRetryKey({ accountId: normalizedAccountId, feedId })),
      ),
  };
}
