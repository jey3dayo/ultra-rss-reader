import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { deleteFeed } from "@/api/tauri-commands";
import { invalidateDeleteFeedQueries } from "@/lib/query/query-invalidation";
import { getErrorMessage } from "@/lib/ui/errors";
import {
  isDatabaseMaintenanceBusyMessage,
  localizeUserVisibleAppErrorMessage,
} from "@/lib/ui/localize-app-error-message";
import {
  type BulkUnsubscribeOutcome,
  type BulkUnsubscribeRunRequest,
  useBulkUnsubscribeStore,
} from "@/stores/bulk-unsubscribe-store";
import { useUiStore } from "@/stores/ui-store";
import { nextBusyRetryDelayMs, waitForBusyRetry } from "./bulk-unsubscribe-wait";

type RunDeps = {
  queryClient: QueryClient;
};

async function unsubscribeFeed(feedId: string): Promise<string | null> {
  const result = await deleteFeed(feedId);
  return Result.isFailure(result) ? result.error.message : null;
}

export async function executeRun(request: BulkUnsubscribeRunRequest, { queryClient }: RunDeps) {
  const { snapshot, queue, accountId, runId } = request;
  const store = useBulkUnsubscribeStore.getState();
  const isCurrent = () => useBulkUnsubscribeStore.getState().runId === runId;

  const succeededFeedIds: string[] = [];
  let failureCount = 0;
  let cancelled = false;
  let position = 0;
  let inFlightIndex: number | null = null;
  let busyDelayMs: number | null = null;
  let firstAttempt = true;
  let invalidatedSucceededCount = 0;
  const refreshSucceededFeeds = () => {
    if (succeededFeedIds.length > invalidatedSucceededCount) {
      invalidatedSucceededCount = succeededFeedIds.length;
      invalidateDeleteFeedQueries(queryClient, { accountId });
    }
  };
  try {
    while (position < queue.length && isCurrent()) {
      const stoppedByUser = useBulkUnsubscribeStore.getState().run.stopRequested;
      const accountChanged = useUiStore.getState().subscriptionsWorkspace?.accountId !== accountId;
      if (stoppedByUser || accountChanged) {
        cancelled = true;
        break;
      }

      const index = queue[position];
      const feedId = snapshot[index].row.feed.id;
      inFlightIndex = index;
      if (firstAttempt) {
        store.rowRunning(index);
        firstAttempt = false;
      }
      const syncCompletedSeqAtAttempt = useBulkUnsubscribeStore.getState().syncCompletedSeq;
      const failureMessage = await unsubscribeFeed(feedId);
      inFlightIndex = null;

      if (failureMessage !== null && isDatabaseMaintenanceBusyMessage(failureMessage)) {
        if (isCurrent()) {
          store.syncWaiting(index);
        }
        // The wait can stretch for a while, so feeds already unsubscribed stop lingering in the list behind.
        refreshSucceededFeeds();
        busyDelayMs = nextBusyRetryDelayMs(busyDelayMs);
        await waitForBusyRetry({ delayMs: busyDelayMs, runId, accountId, syncCompletedSeqAtAttempt });
        continue;
      }

      position += 1;
      busyDelayMs = null;
      firstAttempt = true;

      if (failureMessage === null) {
        succeededFeedIds.push(feedId);
        if (isCurrent()) {
          store.rowDone(index);
        }
        continue;
      }

      failureCount += 1;
      if (isCurrent()) {
        store.rowFailed(index, localizeUserVisibleAppErrorMessage(failureMessage));
      }
    }
  } catch (error) {
    console.error("Bulk unsubscribe stopped on an unexpected error.", error);
    failureCount += 1;
    if (inFlightIndex !== null) {
      position += 1;
      if (isCurrent()) {
        store.rowFailed(inFlightIndex, getErrorMessage(error));
      }
    }
  } finally {
    let outcome: BulkUnsubscribeOutcome | null = null;
    if (isCurrent()) {
      outcome = cancelled ? "cancelled" : failureCount > 0 ? "partial" : "completed";
      store.finish(outcome, queue.slice(position));
    }
    refreshSucceededFeeds();
    if (outcome !== null) {
      store.settle({ runId, accountId, outcome, succeededFeedIds: [...succeededFeedIds] });
    }
  }
}
