import { useEffect, useRef } from "react";
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
  onSettled: (succeededFeedIds: readonly string[]) => void;
  onClose: (outcome: { allSucceeded: boolean }) => void;
};

export function useBulkUnsubscribeFeeds({ open, accountId, onSettled, onClose }: UseBulkUnsubscribeFeedsArgs) {
  const state = useBulkUnsubscribeStore((store) => store.run);
  const mountedRef = useRef(false);
  const callbacksRef = useRef({ onSettled, onClose });

  useEffect(() => {
    callbacksRef.current = { onSettled, onClose };
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      useBulkUnsubscribeStore.getState().reset();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      useBulkUnsubscribeStore.getState().invalidateRun();
    }
  }, [open]);

  const execute = (snapshot: ReadonlyArray<BulkUnsubscribeTarget>, queue: ReadonlyArray<number>) => {
    useBulkUnsubscribeStore.getState().requestRun({
      snapshot,
      queue,
      accountId,
      onSettled: (succeededFeedIds) => {
        if (mountedRef.current) {
          callbacksRef.current.onSettled(succeededFeedIds);
        }
      },
      onClose: (outcome) => callbacksRef.current.onClose(outcome),
    });
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
    settledCount,
    retryCount: retryQueue.length,
    start,
    retry,
    stop,
    reset,
  };
}
