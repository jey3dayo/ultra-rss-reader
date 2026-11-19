import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useReducer, useRef } from "react";
import { useTranslation } from "react-i18next";
import { deleteFeed } from "@/api/tauri-commands";
import { invalidateDeleteFeedQueries } from "@/lib/query/query-invalidation";
import type { resolveBulkUnsubscribeTargets } from "@/lib/subscriptions/bulk-unsubscribe";
import { getErrorMessage } from "@/lib/ui/errors";
import {
  isDatabaseMaintenanceBusyMessage,
  localizeUserVisibleAppErrorMessage,
} from "@/lib/ui/localize-app-error-message";
import { useUiStore } from "@/stores/ui-store";

export type BulkUnsubscribeTarget = ReturnType<typeof resolveBulkUnsubscribeTargets>[number];
type BulkUnsubscribePhase = "confirm" | "running" | "result";
export type BulkUnsubscribeRowStatus = "waiting" | "running" | "done" | "failed" | "skipped";
type BulkUnsubscribeRowState = { status: BulkUnsubscribeRowStatus; reason: string | null };
export type BulkUnsubscribeOutcome = "completed" | "partial" | "busy" | "cancelled";

type RunState = {
  phase: BulkUnsubscribePhase;
  snapshot: ReadonlyArray<BulkUnsubscribeTarget>;
  rows: ReadonlyArray<BulkUnsubscribeRowState>;
  outcome: BulkUnsubscribeOutcome | null;
  stopRequested: boolean;
};

type RunAction =
  | { type: "begin"; snapshot: ReadonlyArray<BulkUnsubscribeTarget>; queue: ReadonlyArray<number> }
  | { type: "rowRunning"; index: number }
  | { type: "rowDone"; index: number }
  | { type: "rowFailed"; index: number; reason: string }
  | { type: "stopRequested" }
  | { type: "finish"; outcome: BulkUnsubscribeOutcome; skipped: ReadonlyArray<number> }
  | { type: "reset" };

const INITIAL_STATE: RunState = { phase: "confirm", snapshot: [], rows: [], outcome: null, stopRequested: false };

function setRowState(
  rows: ReadonlyArray<BulkUnsubscribeRowState>,
  indices: ReadonlyArray<number>,
  next: BulkUnsubscribeRowState,
) {
  const targetIndices = new Set(indices);
  return rows.map((row, index) => (targetIndices.has(index) ? next : row));
}

function reduceRunState(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case "begin": {
      const rows =
        state.snapshot === action.snapshot
          ? state.rows
          : action.snapshot.map((): BulkUnsubscribeRowState => ({ status: "waiting", reason: null }));
      return {
        phase: "running",
        snapshot: action.snapshot,
        rows: setRowState(rows, action.queue, { status: "waiting", reason: null }),
        outcome: null,
        stopRequested: false,
      };
    }
    case "rowRunning":
      return { ...state, rows: setRowState(state.rows, [action.index], { status: "running", reason: null }) };
    case "rowDone":
      return { ...state, rows: setRowState(state.rows, [action.index], { status: "done", reason: null }) };
    case "rowFailed":
      return { ...state, rows: setRowState(state.rows, [action.index], { status: "failed", reason: action.reason }) };
    case "stopRequested":
      return { ...state, stopRequested: true };
    case "finish":
      return {
        ...state,
        phase: "result",
        outcome: action.outcome,
        stopRequested: false,
        rows: setRowState(state.rows, action.skipped, { status: "skipped", reason: null }),
      };
    case "reset":
      return INITIAL_STATE;
  }
}

// Kept feeds are listed first in the dialog, so the run follows the same top-to-bottom order.
export function orderBulkUnsubscribeTargets(
  targets: ReadonlyArray<BulkUnsubscribeTarget>,
): ReadonlyArray<BulkUnsubscribeTarget> {
  return [...targets.filter((target) => target.wasKept), ...targets.filter((target) => !target.wasKept)];
}

async function unsubscribeFeed(feedId: string): Promise<string | null> {
  const result = await deleteFeed(feedId);
  return Result.isFailure(result) ? result.error.message : null;
}

type UseBulkUnsubscribeFeedsArgs = {
  open: boolean;
  accountId: string | null;
  onSettled: (succeededFeedIds: readonly string[]) => void;
  onClose: (outcome: { allSucceeded: boolean }) => void;
};

export function useBulkUnsubscribeFeeds({ open, accountId, onSettled, onClose }: UseBulkUnsubscribeFeedsArgs) {
  const { t } = useTranslation("subscriptions");
  const queryClient = useQueryClient();
  const showToast = useUiStore((state) => state.showToast);
  const [state, dispatch] = useReducer(reduceRunState, INITIAL_STATE);
  const runIdRef = useRef(0);
  const runActiveRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const mountedRef = useRef(false);
  const callbacksRef = useRef({ onSettled, onClose });

  useEffect(() => {
    callbacksRef.current = { onSettled, onClose };
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      runIdRef.current += 1;
      runActiveRef.current = false;
    }
  }, [open]);

  const execute = async (snapshot: ReadonlyArray<BulkUnsubscribeTarget>, queue: ReadonlyArray<number>) => {
    if (runActiveRef.current) {
      return;
    }
    runActiveRef.current = true;
    stopRequestedRef.current = false;
    runIdRef.current += 1;
    const runId = runIdRef.current;
    const isCurrent = () => runIdRef.current === runId;
    dispatch({ type: "begin", snapshot, queue });

    const succeededFeedIds: string[] = [];
    let failureCount = 0;
    let halt: "busy" | "cancelled" | null = null;
    let position = 0;
    let inFlightIndex: number | null = null;
    try {
      while (position < queue.length && isCurrent()) {
        const stoppedByUser = stopRequestedRef.current;
        const accountChanged = useUiStore.getState().subscriptionsWorkspace?.accountId !== accountId;
        if (stoppedByUser || accountChanged) {
          halt = "cancelled";
          break;
        }

        const index = queue[position];
        const feedId = snapshot[index].row.feed.id;
        inFlightIndex = index;
        dispatch({ type: "rowRunning", index });
        const failureMessage = await unsubscribeFeed(feedId);
        position += 1;
        inFlightIndex = null;

        if (failureMessage === null) {
          succeededFeedIds.push(feedId);
          if (isCurrent()) {
            dispatch({ type: "rowDone", index });
          }
          continue;
        }

        failureCount += 1;
        if (isCurrent()) {
          dispatch({ type: "rowFailed", index, reason: localizeUserVisibleAppErrorMessage(failureMessage) });
        }
        if (isDatabaseMaintenanceBusyMessage(failureMessage)) {
          halt = "busy";
          break;
        }
      }
    } catch (error) {
      console.error("Bulk unsubscribe stopped on an unexpected error.", error);
      failureCount += 1;
      if (inFlightIndex !== null) {
        position += 1;
        if (isCurrent()) {
          dispatch({ type: "rowFailed", index: inFlightIndex, reason: getErrorMessage(error) });
        }
      }
    } finally {
      let outcome: BulkUnsubscribeOutcome | null = null;
      if (isCurrent()) {
        runActiveRef.current = false;
        outcome = halt ?? (failureCount > 0 ? "partial" : "completed");
        dispatch({ type: "finish", outcome, skipped: queue.slice(position) });
      }
      if (succeededFeedIds.length > 0) {
        invalidateDeleteFeedQueries(queryClient, { accountId });
      }
      if (mountedRef.current) {
        callbacksRef.current.onSettled(succeededFeedIds);
      }
      if (outcome === "completed") {
        showToast(t("bulk_toast_done", { count: snapshot.length }));
        callbacksRef.current.onClose({ allSucceeded: true });
      }
    }
  };

  const start = (targets: ReadonlyArray<BulkUnsubscribeTarget>) => {
    const snapshot = orderBulkUnsubscribeTargets(targets);
    if (snapshot.length === 0) {
      return;
    }
    void execute(
      snapshot,
      snapshot.map((_target, index) => index),
    );
  };

  const retryQueue = state.rows.flatMap((row, index) =>
    row.status === "failed" || row.status === "skipped" ? [index] : [],
  );

  const retry = () => {
    void execute(state.snapshot, retryQueue);
  };

  const stop = () => {
    if (!runActiveRef.current) {
      return;
    }
    stopRequestedRef.current = true;
    dispatch({ type: "stopRequested" });
  };

  const reset = () => {
    runIdRef.current += 1;
    runActiveRef.current = false;
    dispatch({ type: "reset" });
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
