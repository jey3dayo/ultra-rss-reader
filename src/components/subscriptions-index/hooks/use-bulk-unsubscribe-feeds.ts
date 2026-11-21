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
export function useBulkUnsubscribeFeeds({ open, accountId }: UseBulkUnsubscribeFeedsArgs) {
  const state = useBulkUnsubscribeStore((store) => store.run);

  useEffect(() => {
    if (useBulkUnsubscribeStore.getState().run.phase === "result") {
      useBulkUnsubscribeStore.getState().reset();
    }
  }, []);

  useEffect(() => {
    useBulkUnsubscribeStore.getState().setDialogOpen(open);
    return () => {
      useBulkUnsubscribeStore.getState().setDialogOpen(false);
    };
  }, [open]);

  const execute = (snapshot: ReadonlyArray<BulkUnsubscribeTarget>, queue: ReadonlyArray<number>) => {
    useBulkUnsubscribeStore.getState().requestRun({ snapshot, queue, accountId });
  };

  const start = (targets: ReadonlyArray<BulkUnsubscribeTarget>) => {
    const snapshot = orderBulkUnsubscribeTargets(targets);
    if (snapshot.length === 0) {
      return;
    }
    execute(
      snapshot,
      snapshot.map((_target, index) => index),
    );
  };

  const retryQueue = state.rows.flatMap((row, index) =>
    row.status === "failed" || row.status === "skipped" ? [index] : [],
  );

  const retry = () => {
    execute(state.snapshot, retryQueue);
  };

  const stop = () => {
    useBulkUnsubscribeStore.getState().requestStop();
  };

  const reset = () => {
    useBulkUnsubscribeStore.getState().reset();
  };

  const settledCount = state.rows.filter((row) => row.status === "done" || row.status === "failed").length;

  return {
    phase: state.phase,
    snapshot: state.snapshot,
    rows: state.rows,
    outcome: state.outcome,
    stopRequested: state.stopRequested,
    waitingForSync: state.waitingForSync,
    settledCount,
    retryCount: retryQueue.length,
    start,
    retry,
    stop,
    reset,
  };
}
