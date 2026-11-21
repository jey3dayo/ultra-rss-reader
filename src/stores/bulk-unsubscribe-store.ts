import { create } from "zustand";
import type { resolveBulkUnsubscribeTargets } from "@/lib/subscriptions/bulk-unsubscribe";

export type BulkUnsubscribeTarget = ReturnType<typeof resolveBulkUnsubscribeTargets>[number];
type BulkUnsubscribePhase = "confirm" | "running" | "result";
export type BulkUnsubscribeRowStatus = "waiting" | "running" | "done" | "failed" | "skipped";
type BulkUnsubscribeRowState = { status: BulkUnsubscribeRowStatus; reason: string | null };
export type BulkUnsubscribeOutcome = "completed" | "partial" | "cancelled";

type RunState = {
  phase: BulkUnsubscribePhase;
  snapshot: ReadonlyArray<BulkUnsubscribeTarget>;
  rows: ReadonlyArray<BulkUnsubscribeRowState>;
  outcome: BulkUnsubscribeOutcome | null;
  stopRequested: boolean;
  waitingForSync: boolean;
};

type RunAction =
  | { type: "begin"; snapshot: ReadonlyArray<BulkUnsubscribeTarget>; queue: ReadonlyArray<number> }
  | { type: "rowRunning"; index: number }
  | { type: "syncWaiting"; index: number }
  | { type: "rowDone"; index: number }
  | { type: "rowFailed"; index: number; reason: string }
  | { type: "stopRequested" }
  | { type: "finish"; outcome: BulkUnsubscribeOutcome; skipped: ReadonlyArray<number> }
  | { type: "reset" };

const INITIAL_STATE: RunState = {
  phase: "confirm",
  snapshot: [],
  rows: [],
  outcome: null,
  stopRequested: false,
  waitingForSync: false,
};

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
        waitingForSync: false,
      };
    }
    case "rowRunning":
      return { ...state, rows: setRowState(state.rows, [action.index], { status: "running", reason: null }) };
    case "syncWaiting":
      return {
        ...state,
        waitingForSync: true,
        rows: setRowState(state.rows, [action.index], { status: "waiting", reason: null }),
      };
    case "rowDone":
      return {
        ...state,
        waitingForSync: false,
        rows: setRowState(state.rows, [action.index], { status: "done", reason: null }),
      };
    case "rowFailed":
      return {
        ...state,
        waitingForSync: false,
        rows: setRowState(state.rows, [action.index], { status: "failed", reason: action.reason }),
      };
    case "stopRequested":
      return { ...state, stopRequested: true };
    case "finish":
      return {
        ...state,
        phase: "result",
        outcome: action.outcome,
        stopRequested: false,
        waitingForSync: false,
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

// onSettled / onClose are delivered to the dialog that requested the run, and only while it is still mounted.
type BulkUnsubscribeRunInput = {
  snapshot: ReadonlyArray<BulkUnsubscribeTarget>;
  queue: ReadonlyArray<number>;
  accountId: string | null;
  onSettled: (succeededFeedIds: readonly string[]) => void;
  onClose: (outcome: { allSucceeded: boolean }) => void;
};

export type BulkUnsubscribeRunRequest = BulkUnsubscribeRunInput & { runId: number };

type BulkUnsubscribeState = {
  run: RunState;
  runId: number;
  runActive: boolean;
  runnerMounted: boolean;
  syncCompletedSeq: number;
  request: BulkUnsubscribeRunRequest | null;
};

type BulkUnsubscribeActions = {
  setRunnerMounted: (mounted: boolean) => void;
  requestRun: (input: BulkUnsubscribeRunInput) => void;
  rowRunning: (index: number) => void;
  syncWaiting: (index: number) => void;
  rowDone: (index: number) => void;
  rowFailed: (index: number, reason: string) => void;
  requestStop: () => void;
  notifySyncCompleted: () => void;
  finish: (outcome: BulkUnsubscribeOutcome, skipped: ReadonlyArray<number>) => void;
  invalidateRun: () => void;
  reset: () => void;
};

export const useBulkUnsubscribeStore = create<BulkUnsubscribeState & BulkUnsubscribeActions>()((set, get) => ({
  run: INITIAL_STATE,
  runId: 0,
  runActive: false,
  runnerMounted: false,
  syncCompletedSeq: 0,
  request: null,

  setRunnerMounted: (mounted) => set({ runnerMounted: mounted }),

  requestRun: (input) => {
    const state = get();
    if (state.runActive) {
      return;
    }
    if (!state.runnerMounted) {
      console.error("Bulk unsubscribe was requested but no BulkUnsubscribeRunner is mounted.");
      return;
    }
    const runId = state.runId + 1;
    set({
      runId,
      runActive: true,
      run: reduceRunState(state.run, { type: "begin", snapshot: input.snapshot, queue: input.queue }),
      request: { ...input, runId },
    });
  },

  rowRunning: (index) => set((state) => ({ run: reduceRunState(state.run, { type: "rowRunning", index }) })),
  syncWaiting: (index) => set((state) => ({ run: reduceRunState(state.run, { type: "syncWaiting", index }) })),
  rowDone: (index) => set((state) => ({ run: reduceRunState(state.run, { type: "rowDone", index }) })),
  rowFailed: (index, reason) =>
    set((state) => ({ run: reduceRunState(state.run, { type: "rowFailed", index, reason }) })),

  requestStop: () =>
    set((state) => (state.runActive ? { run: reduceRunState(state.run, { type: "stopRequested" }) } : state)),

  notifySyncCompleted: () => set((state) => ({ syncCompletedSeq: state.syncCompletedSeq + 1 })),

  finish: (outcome, skipped) =>
    set((state) => ({ runActive: false, run: reduceRunState(state.run, { type: "finish", outcome, skipped }) })),

  invalidateRun: () => set((state) => ({ runId: state.runId + 1, runActive: false })),

  reset: () =>
    set((state) => ({
      runId: state.runId + 1,
      runActive: false,
      run: reduceRunState(state.run, { type: "reset" }),
      request: null,
    })),
}));
