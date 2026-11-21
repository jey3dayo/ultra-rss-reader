import { useBulkUnsubscribeStore } from "@/stores/bulk-unsubscribe-store";
import { useUiStore } from "@/stores/ui-store";

const BUSY_RETRY_INITIAL_DELAY_MS = 3_000;
const BUSY_RETRY_MAX_DELAY_MS = 30_000;
const BUSY_RETRY_AFTER_SYNC_COMPLETED_DELAY_MS = 1_000;

export function nextBusyRetryDelayMs(previousDelayMs: number | null): number {
  return previousDelayMs === null
    ? BUSY_RETRY_INITIAL_DELAY_MS
    : Math.min(previousDelayMs * 2, BUSY_RETRY_MAX_DELAY_MS);
}

type BusyRetryWait = {
  delayMs: number;
  runId: number;
  accountId: string | null;
  // The sync-completed event fires before the busy flag is released, so it only shortens the wait.
  syncCompletedSeqAtAttempt: number;
};

// Resolves at the delay, or at once when the run is superseded, stopped, or the displayed account changes.
export function waitForBusyRetry({ delayMs, runId, accountId, syncCompletedSeqAtAttempt }: BusyRetryWait) {
  return new Promise<void>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let dueAt = Date.now() + delayMs;
    let unsubscribeBulk: (() => void) | undefined;
    let unsubscribeUi: (() => void) | undefined;

    const finish = () => {
      clearTimeout(timer);
      unsubscribeBulk?.();
      unsubscribeUi?.();
      resolve();
    };

    const isInterrupted = () => {
      const { runId: currentRunId, run } = useBulkUnsubscribeStore.getState();
      return (
        currentRunId !== runId ||
        run.stopRequested ||
        useUiStore.getState().subscriptionsWorkspace?.accountId !== accountId
      );
    };

    const shortenAfterSyncCompleted = () => {
      const shortenedDueAt = Date.now() + BUSY_RETRY_AFTER_SYNC_COMPLETED_DELAY_MS;
      if (shortenedDueAt < dueAt) {
        dueAt = shortenedDueAt;
        clearTimeout(timer);
        timer = setTimeout(finish, BUSY_RETRY_AFTER_SYNC_COMPLETED_DELAY_MS);
      }
    };

    if (isInterrupted()) {
      resolve();
      return;
    }

    timer = setTimeout(finish, delayMs);
    if (useBulkUnsubscribeStore.getState().syncCompletedSeq !== syncCompletedSeqAtAttempt) {
      shortenAfterSyncCompleted();
    }
    unsubscribeBulk = useBulkUnsubscribeStore.subscribe((state, previous) => {
      if (isInterrupted()) {
        finish();
      } else if (state.syncCompletedSeq !== previous.syncCompletedSeq) {
        shortenAfterSyncCompleted();
      }
    });
    unsubscribeUi = useUiStore.subscribe(() => {
      if (isInterrupted()) {
        finish();
      }
    });
  });
}
