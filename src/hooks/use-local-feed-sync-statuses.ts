import { Result } from "@praha/byethrow";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import type { SyncResultDto } from "@/api/schemas";
import { getLocalFeedSyncStatuses, type LocalFeedSyncStatusDto, syncFeed } from "@/api/tauri-commands";
import { useAccounts } from "@/hooks/use-accounts";
import { invalidateFeedRetryQueries, queryKeys } from "@/lib/query/query-invalidation";
import { summarizeSyncResult } from "@/lib/sync/sync-result-feedback";

export const localFeedSyncStatusesQueryKey = (accountId: string | null) =>
  queryKeys.localFeedSyncStatuses.byAccount(accountId);

type PendingFeedRetry = { accountId: string; feedId: string };
type FeedRetryVariables = PendingFeedRetry & { attempt: number };

export type FeedRetryOutcomeKind = "succeeded" | "busy" | "incomplete" | "failed" | "refresh-failed";

// settledAttemptAt is undefined until the post-retry status refresh settles, then pins the outcome to the status it explains.
type FeedRetryOutcome = {
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
  feedRetryOutcomes.set(getPendingFeedRetryKey(variables), { attempt: variables.attempt, kind });
  notifyPendingFeedRetryChange();
}

function settleFeedRetryOutcome(
  variables: FeedRetryVariables,
  refreshed: boolean,
  settledAttemptAt: string | null,
): void {
  const key = getPendingFeedRetryKey(variables);
  const outcome = feedRetryOutcomes.get(key);
  if (outcome?.attempt !== variables.attempt) return;
  if (refreshed && outcome.kind === "succeeded") {
    feedRetryOutcomes.delete(key);
    return;
  }
  const stale = !refreshed && (outcome.kind === "succeeded" || outcome.kind === "incomplete");
  feedRetryOutcomes.set(key, {
    attempt: outcome.attempt,
    kind: stale ? "refresh-failed" : outcome.kind,
    settledAttemptAt,
  });
}

export function useLocalFeedSyncStatuses(accountId: string | null) {
  const { data: accounts, isPending: accountsPending } = useAccounts();
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

  const retryMutation = useMutation({
    mutationFn: async ({ feedId }: FeedRetryVariables) => Result.unwrap(await syncFeed(feedId)),
    onSuccess: (result, variables) => {
      recordFeedRetryOutcome(variables, resolveRetryOutcomeKind(result));
    },
    onError: (_error, variables) => {
      recordFeedRetryOutcome(variables, "failed");
    },
    onSettled: async (_data, _error, variables) => {
      try {
        const refreshed = await invalidateFeedRetryQueries(queryClient, variables.accountId, variables.feedId);
        const statuses = queryClient.getQueryData<LocalFeedSyncStatusDto[]>(
          localFeedSyncStatusesQueryKey(variables.accountId),
        );
        const settledAttemptAt = statuses?.find((status) => status.feed_id === variables.feedId)?.last_attempt_at;
        settleFeedRetryOutcome(variables, refreshed, settledAttemptAt ?? null);
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
