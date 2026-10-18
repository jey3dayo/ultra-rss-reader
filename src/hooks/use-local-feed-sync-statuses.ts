import { Result } from "@praha/byethrow";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { getLocalFeedSyncStatuses, syncFeed } from "@/api/tauri-commands";
import { useAccounts } from "@/hooks/use-accounts";
import { invalidateFeedRetryQueries, queryKeys } from "@/lib/query/query-invalidation";
import { summarizeSyncResult } from "@/lib/sync/sync-result-feedback";
import { useUiStore } from "@/stores/ui-store";

export const localFeedSyncStatusesQueryKey = (accountId: string | null) =>
  queryKeys.localFeedSyncStatuses.byAccount(accountId);

type PendingFeedRetry = { accountId: string; feedId: string };

function getPendingFeedRetryKey({ accountId, feedId }: PendingFeedRetry): string {
  return JSON.stringify([accountId, feedId]);
}

// Dedupe keys live at module scope so they survive hook remounts while a retry
// is in flight; keys stay account-scoped so parallel accounts cannot cross-talk,
// and deletes remove exactly the keys added in retryFeed.
const pendingFeedRetryKeys = new Set<string>();
const pendingFeedRetryListeners = new Set<() => void>();

export function __resetPendingFeedRetryKeysForTests(): void {
  pendingFeedRetryKeys.clear();
}

function subscribePendingFeedRetryChanges(listener: () => void): () => void {
  pendingFeedRetryListeners.add(listener);
  return () => pendingFeedRetryListeners.delete(listener);
}

const getPendingFeedRetryCount = () => pendingFeedRetryKeys.size;

function notifyPendingFeedRetryChange(): void {
  for (const notify of pendingFeedRetryListeners) {
    notify();
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
  useSyncExternalStore(subscribePendingFeedRetryChanges, getPendingFeedRetryCount);

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
    mutationFn: async ({ feedId }: { accountId: string; feedId: string }) => Result.unwrap(await syncFeed(feedId)),
    onSuccess: (result, variables) => {
      if (useUiStore.getState().selectedAccountId !== variables.accountId) return;
      const feedback = summarizeSyncResult(result);
      if (feedback.kind === "already-in-progress") {
        showToast(t("fetch_error_retry_busy"));
      } else if (feedback.kind === "success") {
        showToast(t("fetch_error_retry_succeeded"));
      } else {
        showToast(t("fetch_error_retry_incomplete"));
      }
    },
    onError: (_error, variables) => {
      if (useUiStore.getState().selectedAccountId === variables.accountId) {
        showToast(t("detail_fetch_error_retry_failed"));
      }
    },
    onSettled: async (_data, _error, variables) => {
      try {
        const refreshed = await invalidateFeedRetryQueries(queryClient, variables.accountId, variables.feedId);
        if (!refreshed && useUiStore.getState().selectedAccountId === variables.accountId) {
          showToast(t("fetch_error_refresh_failed"));
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
      const variables = { accountId: normalizedAccountId, feedId };
      const retryKey = getPendingFeedRetryKey(variables);
      if (pendingFeedRetryKeys.has(retryKey)) return;
      pendingFeedRetryKeys.add(retryKey);
      notifyPendingFeedRetryChange();
      retryMutation.mutate(variables);
    },
    isRetryingFeed: (feedId: string) =>
      Boolean(
        normalizedAccountId &&
          pendingFeedRetryKeys.has(getPendingFeedRetryKey({ accountId: normalizedAccountId, feedId })),
      ),
  };
}
