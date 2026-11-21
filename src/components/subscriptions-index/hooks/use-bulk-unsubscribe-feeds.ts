import { useEffect } from "react";
import {
  type BulkUnsubscribeTarget,
  orderBulkUnsubscribeTargets,
  useBulkUnsubscribeStore,
} from "@/stores/bulk-unsubscribe-store";

export type {
  BulkUnsubscribeOutcome,
  BulkUnsubscribeRowStatus,
  BulkUnsubscribeTarget,
} from "@/stores/bulk-unsubscribe-store";
export { orderBulkUnsubscribeTargets } from "@/stores/bulk-unsubscribe-store";

type UseBulkUnsubscribeFeedsArgs = {
  open: boolean;
  accountId: string | null;
};

// The dialog is only a view onto the store run: closing or unmounting it never touches the
// run, and a finished run's leftover result step is dropped when a dialog mounts again.
// A retained run belongs to the account that requested it. A dialog opened for another
// account sees a fresh confirm step instead: it must neither display the other account's
// run nor act on it (in particular, a retry must never rebind the retained snapshot to
// the account the dialog happens to display).
export function useBulkUnsubscribeFeeds({ open, accountId }: UseBulkUnsubscribeFeedsArgs) {
  const state = useBulkUnsubscribeStore((store) => store.run);
  const hasRun = state.snapshot.length > 0;
  const isOwnRun = !hasRun || state.accountId === accountId;
  const visible = isOwnRun ? state : null;

  useEffect(() => {
    const retained = useBulkUnsubscribeStore.getState().run;
    if (retained.phase === "result" && (retained.snapshot.length === 0 || retained.accountId === accountId)) {
      useBulkUnsubscribeStore.getState().reset();
    }
  }, [accountId]);

  useEffect(() => {
    useBulkUnsubscribeStore.getState().setDialogOpen(open, accountId);
    return () => {
      useBulkUnsubscribeStore.getState().setDialogOpen(false, accountId);
    };
  }, [open, accountId]);

  const execute = (
    snapshot: ReadonlyArray<BulkUnsubscribeTarget>,
    queue: ReadonlyArray<number>,
    runAccountId: string | null,
  ) => {
    useBulkUnsubscribeStore.getState().requestRun({ snapshot, queue, accountId: runAccountId });
  };

  const start = (targets: ReadonlyArray<BulkUnsubscribeTarget>) => {
    const snapshot = orderBulkUnsubscribeTargets(targets);
    if (snapshot.length === 0) {
      return;
    }
    execute(
      snapshot,
      snapshot.map((_target, index) => index),
      accountId,
    );
  };

  const visibleRows = visible?.rows ?? [];
  const retryQueue = visibleRows.flatMap((row, index) =>
    row.status === "failed" || row.status === "skipped" ? [index] : [],
  );

  const retry = () => {
    if (!isOwnRun) {
      return;
    }
    // Bind the retry to the account that owns the retained snapshot, never to the
    // account this dialog instance happens to display.
    execute(state.snapshot, retryQueue, state.accountId);
  };

  const stop = () => {
    useBulkUnsubscribeStore.getState().requestStop();
  };

  const reset = () => {
    if (!isOwnRun) {
      return;
    }
    useBulkUnsubscribeStore.getState().reset();
  };

  const settledCount = visibleRows.filter((row) => row.status === "done" || row.status === "failed").length;

  return {
    phase: visible?.phase ?? "confirm",
    snapshot: visible?.snapshot ?? [],
    rows: visibleRows,
    outcome: visible?.outcome ?? null,
    stopRequested: visible?.stopRequested ?? false,
    waitingForSync: visible?.waitingForSync ?? false,
    settledCount,
    retryCount: retryQueue.length,
    start,
    retry,
    stop,
    reset,
  };
}
