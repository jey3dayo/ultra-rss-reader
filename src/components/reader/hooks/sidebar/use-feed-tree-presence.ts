import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MOTION_SIDEBAR_ROW_EXIT_DURATION_MS } from "@/constants";
import { readMatchMedia, subscribeMatchMediaChange } from "@/lib/runtime/match-media-listener";
import type { FeedTreeFeedViewModel, FeedTreeFolderViewModel } from "../../feed-tree.types";
import { buildOutput, type FeedTreePresenceResult, presenceStatesEquivalent } from "./feed-tree-presence-output";
import {
  buildLogicalMaps,
  collapseToLogical,
  computeNextState,
  dropExpiredEntry,
  EMPTY_LOGICAL_MAPS,
  EMPTY_STATE,
  type PresenceState,
  type TimerInstruction,
  type TimerKind,
} from "./feed-tree-presence-state";

/**
 * Presence-aware sidebar feed tree hook.
 *
 * `getVisibleSidebarFeeds()` (src/lib/sidebar/sidebar-feed-tree.ts) filters
 * read feeds out of the logical tree synchronously, and
 * `buildVisibleSidebarFeedTreeFolder` drops a folder entirely once it has no
 * visible children. Both are correct for the *logical* tree, but neither
 * leaves anything mounted for an exit animation to run against. This hook
 * sits between the logical tree (`useSidebarFeedTree`'s output) and the view:
 * it retains a row (feed or folder) for `MOTION_SIDEBAR_ROW_EXIT_DURATION_MS`
 * after it disappears from the logical tree, flags it `isLeaving`, and keeps
 * a disappearing folder's children retained alongside it so the last child's
 * exit can still animate even though the folder itself vanished in the same
 * tick.
 *
 * CSS wiring, `orderedFeedIds`, and component call sites are out of scope
 * here; this hook only owns the presence/diff/timer state machine.
 *
 * The pure tree-transition diff (what should start/stop leaving, and the
 * per-scope order arrays) lives in `feed-tree-presence-state.ts`. Assembling
 * the output view models and the no-op comparison used to skip redundant
 * `setState` calls live in `feed-tree-presence-output.ts`. This file owns
 * only the runtime: React state/refs, the diff effect, exit timers, and the
 * reduced-motion listener.
 */

export type FeedTreePresenceOptions = {
  folders: FeedTreeFolderViewModel[];
  unfolderedFeeds: FeedTreeFeedViewModel[];
  /** Identifies the logical scope (e.g. account + view mode). Changing it discards all retained rows immediately. */
  scopeKey: string;
};

export type { FeedTreePresenceFeedViewModel, FeedTreePresenceFolderViewModel } from "../../feed-tree.types";
export type { FeedTreePresenceResult } from "./feed-tree-presence-output";

function timerKey(kind: TimerKind, id: string): string {
  return `${kind}:${id}`;
}

function applyTimerInstructions(
  instructions: TimerInstruction[],
  timeoutsRef: { current: Map<string, number> },
  onExpire: (kind: TimerKind, id: string) => void,
): void {
  for (const instruction of instructions) {
    const key = timerKey(instruction.kind, instruction.id);
    const existingHandle = timeoutsRef.current.get(key);
    if (existingHandle !== undefined) {
      window.clearTimeout(existingHandle);
      timeoutsRef.current.delete(key);
    }
    if (instruction.action === "cancel") {
      continue;
    }
    const handle = window.setTimeout(() => {
      timeoutsRef.current.delete(key);
      onExpire(instruction.kind, instruction.id);
    }, MOTION_SIDEBAR_ROW_EXIT_DURATION_MS);
    timeoutsRef.current.set(key, handle);
  }
}

function readPrefersReducedMotion(): boolean {
  return readMatchMedia("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

export function useFeedTreePresence({
  folders,
  unfolderedFeeds,
  scopeKey,
}: FeedTreePresenceOptions): FeedTreePresenceResult {
  const logicalMaps = useMemo(() => buildLogicalMaps(folders, unfolderedFeeds), [folders, unfolderedFeeds]);

  const [state, setState] = useState<PresenceState>(
    () => computeNextState(EMPTY_STATE, EMPTY_LOGICAL_MAPS, logicalMaps, true, scopeKey).nextState,
  );
  const stateRef = useRef(state);
  // The logical tree as of the last time the diff effect ran. Read by the
  // reduced-motion listener too (which fires outside the normal render
  // cycle), so it always reflects the most recently committed props.
  const committedLogicalRef = useRef(logicalMaps);
  const timeoutsRef = useRef(new Map<string, number>());

  const handleExpire = useCallback((kind: TimerKind, id: string) => {
    const nextState = dropExpiredEntry(stateRef.current, kind, id);
    if (nextState === stateRef.current) {
      return;
    }
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  useLayoutEffect(() => {
    // `stateRef.current.scopeKey` (not a separate ref) is the scope the
    // currently committed presence state belongs to: it is only ever
    // written here, in `handleExpire`, and in the reduced-motion listener,
    // always in lockstep with `state` itself. Comparing it against the
    // latest `scopeKey` prop is what render's own scope guard below also
    // relies on, so there is exactly one source of truth for "which scope
    // is this state currently in".
    const scopeChanged = stateRef.current.scopeKey !== scopeKey;

    if (scopeChanged) {
      for (const handle of timeoutsRef.current.values()) {
        window.clearTimeout(handle);
      }
      timeoutsRef.current.clear();
      const freshState = collapseToLogical(logicalMaps, scopeKey);
      stateRef.current = freshState;
      committedLogicalRef.current = logicalMaps;
      setState(freshState);
      return;
    }

    const retentionEnabled = !readPrefersReducedMotion();
    const { nextState, instructions } = computeNextState(
      stateRef.current,
      committedLogicalRef.current,
      logicalMaps,
      retentionEnabled,
      scopeKey,
    );
    committedLogicalRef.current = logicalMaps;
    if (presenceStatesEquivalent(stateRef.current, nextState)) {
      // Nothing observable changed (e.g. the caller passed new array/object
      // references with the same content). Skip setState so this doesn't
      // re-render and re-run this effect forever. `instructions` is
      // discarded here — that is only correct because every instruction
      // shape (`schedule`/`cancel`, feed or folder) is produced exactly when
      // an id's leaving-map membership or parent changes, which
      // `presenceStatesEquivalent` also checks. So a non-empty
      // `instructions` always implies `presenceStatesEquivalent` is false,
      // and this branch is only reached when `instructions` is empty. If a
      // future change adds an instruction that does not correspond to a
      // leaving-map change, this invariant breaks and instructions could be
      // silently dropped.
      return;
    }
    stateRef.current = nextState;
    applyTimerInstructions(instructions, timeoutsRef, handleExpire);
    setState(nextState);
  }, [logicalMaps, scopeKey, handleExpire]);

  // Reduced-motion can change independently of any logical-tree prop change.
  // Subscribe so an in-progress retention is torn down immediately rather
  // than waiting for the next `folders` / `unfolderedFeeds` update.
  useEffect(() => {
    const mediaQuery = readMatchMedia("(prefers-reduced-motion: reduce)");
    if (!mediaQuery) {
      return;
    }
    return subscribeMatchMediaChange(mediaQuery, (event) => {
      if (!event.matches) {
        return;
      }
      if (stateRef.current.leavingFeeds.size === 0 && stateRef.current.leavingFolders.size === 0) {
        return;
      }
      for (const handle of timeoutsRef.current.values()) {
        window.clearTimeout(handle);
      }
      timeoutsRef.current.clear();
      const collapsed = collapseToLogical(committedLogicalRef.current, stateRef.current.scopeKey);
      stateRef.current = collapsed;
      setState(collapsed);
    });
  }, []);

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      for (const handle of timeouts.values()) {
        window.clearTimeout(handle);
      }
      timeouts.clear();
    };
  }, []);

  // `committedLogicalRef` is read directly (not listed as a dep): it only
  // ever changes in lockstep with a `state` or `logicalMaps` change (the
  // layout effect updates it right alongside `state`), so it is already
  // current by the time this runs during render. See
  // `feed-tree-presence-output.ts`'s `buildOutput` doc comment for why the
  // fallback to it matters.
  //
  // `state.scopeKey !== scopeKey` covers the one render that can happen
  // between a `scopeKey` prop change and the layout effect above catching
  // up: `state` (and `committedLogicalRef`) still belong to the *previous*
  // scope at that point, so resolving against them would mix the old
  // scope's leaving snapshots into the new scope's output for a frame.
  // Instead, render a transient, purely-logical view of the *new* scope's
  // tree (no leaving rows) — exactly what the layout effect is about to
  // commit anyway, so nothing observable flickers.
  return useMemo(() => {
    if (state.scopeKey !== scopeKey) {
      const transientState = collapseToLogical(logicalMaps, scopeKey);
      return buildOutput(transientState, logicalMaps, logicalMaps);
    }
    return buildOutput(state, logicalMaps, committedLogicalRef.current);
  }, [state, logicalMaps, scopeKey]);
}
