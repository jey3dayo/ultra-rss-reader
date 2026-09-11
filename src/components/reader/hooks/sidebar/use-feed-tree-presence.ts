import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MOTION_SIDEBAR_ROW_EXIT_DURATION_MS } from "@/constants";
import { readMatchMedia, subscribeMatchMediaChange } from "@/lib/runtime/match-media-listener";
import type {
  FeedTreeFeedViewModel,
  FeedTreeFolderViewModel,
  FeedTreePresenceFeedViewModel,
  FeedTreePresenceFolderViewModel,
} from "../../feed-tree.types";

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
 * Architecture notes (why the internal state is shaped the way it is):
 *
 * - Feed identity is global, not per-parent. A feed id is tracked in exactly
 *   one place (`leavingFeeds`, keyed by feed id) regardless of which folder
 *   it is under. A feed that is alive anywhere in the logical tree — even
 *   under a *different* parent than before — is a move, not a departure: it
 *   is never marked leaving. Two separate per-parent maps for the same feed
 *   id would let a feed get scheduled to leave its old parent while it is
 *   simultaneously alive at a new one, and there would be no single owner
 *   deciding which schedule is authoritative when the feed keeps moving
 *   before either timer fires.
 * - React state only owns two things: the *leaving* snapshots (a feed's or
 *   folder's last-known view model, captured once at the moment it
 *   disappears) and the *order* arrays needed to re-insert a leaving row at
 *   its prior position. It does not mirror the live (still-logical) rows.
 *   Output for a still-logical row is read straight from the current
 *   `folders` / `unfolderedFeeds` props on every render (see `buildOutput`),
 *   so metadata such as unread counts or selection is always current and
 *   never depends on whether the diff effect happened to run or skip a
 *   `setState`. This also means the diff effect's own no-op check only has
 *   to compare small, cheap state (id order arrays, and reference identity
 *   of *frozen* leaving snapshots) instead of deep-comparing every live view
 *   model on every render.
 */

export type FeedTreePresenceOptions = {
  folders: FeedTreeFolderViewModel[];
  unfolderedFeeds: FeedTreeFeedViewModel[];
  /** Identifies the logical scope (e.g. account + view mode). Changing it discards all retained rows immediately. */
  scopeKey: string;
};

export type { FeedTreePresenceFeedViewModel, FeedTreePresenceFolderViewModel } from "../../feed-tree.types";

export type FeedTreePresenceResult = {
  folders: FeedTreePresenceFolderViewModel[];
  unfolderedFeeds: FeedTreePresenceFeedViewModel[];
};

type TimerKind = "folder" | "feed";

type TimerInstruction =
  | { action: "schedule"; kind: TimerKind; id: string }
  | { action: "cancel"; kind: TimerKind; id: string };

/** A feed's last-known view model and parent, frozen at the moment it left the logical tree. `parentKey` is the owning folder id, or `null` for unfoldered. */
type LeavingFeedEntry = {
  viewModel: FeedTreeFeedViewModel;
  parentKey: string | null;
};

/** A folder's last-known view model, frozen at the moment it left the top-level logical tree. */
type LeavingFolderEntry = {
  source: FeedTreeFolderViewModel;
};

/**
 * Everything this hook persists across renders: which rows are currently
 * leaving (with their frozen snapshot) and the display order for every
 * parent scope (top level, each folder, and unfoldered). Deliberately does
 * NOT contain a copy of any still-logical row's view model.
 */
type PresenceState = {
  // The scope (see `FeedTreePresenceOptions.scopeKey`) this state was last
  // reconciled against. Read during render (not just inside the diff
  // effect) so a render that happens between a scope-prop change and the
  // layout effect catching up can detect the mismatch and suppress stale
  // leaving rows instead of briefly mixing them into the new scope's output.
  scopeKey: string;
  folderOrder: string[];
  leavingFolders: Map<string, LeavingFolderEntry>;
  perFolderFeedOrder: Map<string, string[]>;
  unfolderedOrder: string[];
  leavingFeeds: Map<string, LeavingFeedEntry>;
};

const EMPTY_STRING_SET: ReadonlySet<string> = new Set();

export const EMPTY_STATE: PresenceState = {
  scopeKey: "",
  folderOrder: [],
  leavingFolders: new Map(),
  perFolderFeedOrder: new Map(),
  unfolderedOrder: [],
  leavingFeeds: new Map(),
};

/** A feed's current view model and parent, as read straight from the caller's `folders` / `unfolderedFeeds` this render. */
type LogicalFeedInfo = { viewModel: FeedTreeFeedViewModel; parentKey: string | null };

/** The logical tree flattened into lookup maps and per-scope order arrays, rebuilt fresh from props every render. */
export type LogicalMaps = {
  folders: ReadonlyMap<string, FeedTreeFolderViewModel>;
  feeds: ReadonlyMap<string, LogicalFeedInfo>;
  folderOrder: readonly string[];
  childOrderByFolder: ReadonlyMap<string, readonly string[]>;
  unfolderedOrder: readonly string[];
};

export const EMPTY_LOGICAL_MAPS: LogicalMaps = {
  folders: new Map(),
  feeds: new Map(),
  folderOrder: [],
  childOrderByFolder: new Map(),
  unfolderedOrder: [],
};

export function buildLogicalMaps(
  folders: FeedTreeFolderViewModel[],
  unfolderedFeeds: FeedTreeFeedViewModel[],
): LogicalMaps {
  const folderMap = new Map<string, FeedTreeFolderViewModel>();
  const feedMap = new Map<string, LogicalFeedInfo>();
  const childOrderByFolder = new Map<string, string[]>();
  const folderOrder: string[] = [];

  for (const folder of folders) {
    folderMap.set(folder.id, folder);
    folderOrder.push(folder.id);
    const childIds: string[] = [];
    for (const feed of folder.feeds) {
      feedMap.set(feed.id, { viewModel: feed, parentKey: folder.id });
      childIds.push(feed.id);
    }
    childOrderByFolder.set(folder.id, childIds);
  }

  const unfolderedOrder: string[] = [];
  for (const feed of unfolderedFeeds) {
    feedMap.set(feed.id, { viewModel: feed, parentKey: null });
    unfolderedOrder.push(feed.id);
  }

  return { folders: folderMap, feeds: feedMap, folderOrder, childOrderByFolder, unfolderedOrder };
}

/**
 * Merges a previous ordered id sequence with the current logical order,
 * keeping retained (leaving) ids inline right after the last logical
 * neighbour they had before they disappeared, rather than moving them to the
 * end of the list. Ids in `prevOrder` that are neither logical nor leaving
 * must already have been removed by the caller before this runs (this is
 * always true here: an id only stays in a scope's previous order if it was
 * logical or leaving in that same scope on the previous pass).
 */
function mergeOrder(
  prevOrder: readonly string[],
  logicalOrder: readonly string[],
  leavingIds: ReadonlySet<string>,
): string[] {
  const logicalSet = new Set(logicalOrder);
  const insertAfter = new Map<string, string[]>();
  const leading: string[] = [];
  let lastLogicalSeen: string | null = null;

  for (const id of prevOrder) {
    if (logicalSet.has(id)) {
      lastLogicalSeen = id;
      continue;
    }
    if (!leavingIds.has(id)) {
      continue;
    }
    if (lastLogicalSeen === null) {
      leading.push(id);
    } else {
      const bucket = insertAfter.get(lastLogicalSeen);
      if (bucket) {
        bucket.push(id);
      } else {
        insertAfter.set(lastLogicalSeen, [id]);
      }
    }
  }

  const result: string[] = [...leading];
  for (const id of logicalOrder) {
    result.push(id);
    const trailing = insertAfter.get(id);
    if (trailing) {
      result.push(...trailing);
    }
  }
  return result;
}

/**
 * Pure diff: given the previous presence state, the logical tree as it was
 * last time this ran (`prevLogical`), the logical tree now (`nextLogical`),
 * and whether retention is currently enabled, produces the next presence
 * state and the timer instructions the caller must apply.
 *
 * Feed and folder identity is resolved globally (by id, not by parent), so a
 * feed alive anywhere in `nextLogical` is never marked leaving anywhere,
 * even if its parent changed.
 */
export function computeNextState(
  prevState: PresenceState,
  prevLogical: LogicalMaps,
  nextLogical: LogicalMaps,
  retentionEnabled: boolean,
  scopeKey: string = prevState.scopeKey,
): { nextState: PresenceState; instructions: TimerInstruction[] } {
  const instructions: TimerInstruction[] = [];

  // --- Feeds: global identity. Alive anywhere means "not leaving anywhere". ---
  // `allFeedIds` must include `prevLogical.feeds` too: an id that was logical
  // last pass and has just disappeared this pass is neither in
  // `nextLogical.feeds` (it's gone) nor in `prevState.leavingFeeds` (it was
  // never leaving before) — without `prevLogical` here, such an id would
  // never be considered for "just started leaving" at all.
  const nextLeavingFeeds = new Map<string, LeavingFeedEntry>();
  const allFeedIds = new Set<string>([
    ...nextLogical.feeds.keys(),
    ...prevState.leavingFeeds.keys(),
    ...prevLogical.feeds.keys(),
  ]);
  for (const id of allFeedIds) {
    const logical = nextLogical.feeds.get(id);
    const wasLeaving = prevState.leavingFeeds.get(id);
    if (logical) {
      if (wasLeaving) {
        instructions.push({ action: "cancel", kind: "feed", id });
      }
      continue;
    }
    if (!retentionEnabled) {
      if (wasLeaving) {
        instructions.push({ action: "cancel", kind: "feed", id });
      }
      continue;
    }
    if (wasLeaving) {
      nextLeavingFeeds.set(id, wasLeaving);
      continue;
    }
    const lastKnown = prevLogical.feeds.get(id);
    if (!lastKnown) {
      // Never actually seen as logical before (e.g. a stale id from a
      // different scope); nothing to retain.
      continue;
    }
    nextLeavingFeeds.set(id, { viewModel: lastKnown.viewModel, parentKey: lastKnown.parentKey });
    instructions.push({ action: "schedule", kind: "feed", id });
  }

  // --- Folders: top-level identity only; children are handled entirely via the feed diff above. ---
  // Same reasoning as `allFeedIds` above: `prevLogical.folders` must be
  // included so a folder that just disappeared this pass is considered.
  const nextLeavingFolders = new Map<string, LeavingFolderEntry>();
  const allFolderIds = new Set<string>([
    ...nextLogical.folders.keys(),
    ...prevState.leavingFolders.keys(),
    ...prevLogical.folders.keys(),
  ]);
  for (const id of allFolderIds) {
    const logical = nextLogical.folders.get(id);
    const wasLeaving = prevState.leavingFolders.get(id);
    if (logical) {
      if (wasLeaving) {
        instructions.push({ action: "cancel", kind: "folder", id });
      }
      continue;
    }
    if (!retentionEnabled) {
      if (wasLeaving) {
        instructions.push({ action: "cancel", kind: "folder", id });
      }
      continue;
    }
    if (wasLeaving) {
      nextLeavingFolders.set(id, wasLeaving);
      continue;
    }
    const lastKnown = prevLogical.folders.get(id);
    if (!lastKnown) {
      continue;
    }
    nextLeavingFolders.set(id, { source: lastKnown });
    instructions.push({ action: "schedule", kind: "folder", id });
  }

  // --- Orders. ---
  const leavingFolderIds = new Set(nextLeavingFolders.keys());
  const folderOrder = retentionEnabled
    ? mergeOrder(prevState.folderOrder, nextLogical.folderOrder, leavingFolderIds)
    : [...nextLogical.folderOrder];

  const leavingFeedIdsByParent = new Map<string | null, Set<string>>();
  for (const [feedId, entry] of nextLeavingFeeds) {
    const bucket = leavingFeedIdsByParent.get(entry.parentKey);
    if (bucket) {
      bucket.add(feedId);
    } else {
      leavingFeedIdsByParent.set(entry.parentKey, new Set([feedId]));
    }
  }

  const perFolderFeedOrder = new Map<string, string[]>();
  for (const folderId of folderOrder) {
    const logicalChildIds = nextLogical.childOrderByFolder.get(folderId) ?? [];
    const leavingChildIds = leavingFeedIdsByParent.get(folderId) ?? EMPTY_STRING_SET;
    const prevChildOrder = prevState.perFolderFeedOrder.get(folderId) ?? [];
    const order = retentionEnabled
      ? mergeOrder(prevChildOrder, logicalChildIds, leavingChildIds)
      : [...logicalChildIds];
    perFolderFeedOrder.set(folderId, order);
  }

  const unfolderedLeavingIds = leavingFeedIdsByParent.get(null) ?? EMPTY_STRING_SET;
  const unfolderedOrder = retentionEnabled
    ? mergeOrder(prevState.unfolderedOrder, nextLogical.unfolderedOrder, unfolderedLeavingIds)
    : [...nextLogical.unfolderedOrder];

  return {
    nextState: {
      scopeKey,
      folderOrder,
      leavingFolders: nextLeavingFolders,
      perFolderFeedOrder,
      unfolderedOrder,
      leavingFeeds: nextLeavingFeeds,
    },
    instructions,
  };
}

/** Drops a leaving row once its exit timer fires. A no-op if the row already reverted or was already dropped (e.g. by a scope reset or a reduced-motion collapse). No generation counter is needed: `applyTimerInstructions` always clears an id's previous timer handle before scheduling a new one for the same id, so a superseded timer can never fire. */
function dropExpiredEntry(state: PresenceState, kind: TimerKind, id: string): PresenceState {
  if (kind === "folder") {
    if (!state.leavingFolders.has(id)) {
      return state;
    }
    const nextLeavingFolders = new Map(state.leavingFolders);
    nextLeavingFolders.delete(id);
    const nextPerFolderFeedOrder = new Map(state.perFolderFeedOrder);
    nextPerFolderFeedOrder.delete(id);
    return {
      ...state,
      folderOrder: state.folderOrder.filter((folderId) => folderId !== id),
      leavingFolders: nextLeavingFolders,
      perFolderFeedOrder: nextPerFolderFeedOrder,
    };
  }

  const leaving = state.leavingFeeds.get(id);
  if (!leaving) {
    return state;
  }
  const nextLeavingFeeds = new Map(state.leavingFeeds);
  nextLeavingFeeds.delete(id);

  if (leaving.parentKey === null) {
    return {
      ...state,
      unfolderedOrder: state.unfolderedOrder.filter((feedId) => feedId !== id),
      leavingFeeds: nextLeavingFeeds,
    };
  }

  const parentOrder = state.perFolderFeedOrder.get(leaving.parentKey);
  if (!parentOrder) {
    // The parent folder itself was already dropped; nothing left to prune there.
    return { ...state, leavingFeeds: nextLeavingFeeds };
  }
  const nextPerFolderFeedOrder = new Map(state.perFolderFeedOrder);
  nextPerFolderFeedOrder.set(
    leaving.parentKey,
    parentOrder.filter((feedId) => feedId !== id),
  );
  return { ...state, perFolderFeedOrder: nextPerFolderFeedOrder, leavingFeeds: nextLeavingFeeds };
}

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

function toFolderOutput(
  source: FeedTreeFolderViewModel,
  isLeaving: boolean,
  feeds: FeedTreePresenceFeedViewModel[],
): FeedTreePresenceFolderViewModel {
  const { feeds: _sourceFeeds, ...base } = source;
  return { ...base, isLeaving, feeds };
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/**
 * Builds the presence result from `state` (order + leaving snapshots), the
 * current `logical` tree, and `committedLogical` — the logical tree `state`
 * was last diffed against (i.e. as of the last time the diff effect ran).
 *
 * `state` is only guaranteed to be fully reconciled against `logical` right
 * after that effect runs. On the single React render between a
 * `folders`/`unfolderedFeeds` prop change and the effect catching up, an id
 * can be in an order array while resolving to neither a logical nor a
 * leaving entry (the effect hasn't marked it leaving yet). Falling back to
 * "omit that row" there would let React actually unmount that row's element
 * for one committed render and remount a fresh one once the effect fixes
 * `state` — destroying its transition history, which is exactly what this
 * hook exists to preserve. Falling back to `committedLogical` instead
 * resolves the row exactly the way the *next* render will (as leaving, using
 * its last known view model), so this transient render's output is
 * identical to the post-effect output and nothing unmounts.
 */
function buildOutput(
  state: PresenceState,
  logical: LogicalMaps,
  committedLogical: LogicalMaps,
): FeedTreePresenceResult {
  function resolveFeed(id: string): FeedTreePresenceFeedViewModel | undefined {
    const logicalFeed = logical.feeds.get(id);
    if (logicalFeed) {
      return { ...logicalFeed.viewModel, isLeaving: false };
    }
    const leavingFeed = state.leavingFeeds.get(id);
    if (leavingFeed) {
      return { ...leavingFeed.viewModel, isLeaving: true };
    }
    const committedFeed = committedLogical.feeds.get(id);
    if (committedFeed) {
      return { ...committedFeed.viewModel, isLeaving: true };
    }
    return undefined;
  }

  function resolveFolder(folderId: string): FeedTreePresenceFolderViewModel | undefined {
    const childOrder = state.perFolderFeedOrder.get(folderId) ?? [];
    const feeds = childOrder.map(resolveFeed).filter(isDefined);
    const logicalFolder = logical.folders.get(folderId);
    if (logicalFolder) {
      return toFolderOutput(logicalFolder, false, feeds);
    }
    const leavingFolder = state.leavingFolders.get(folderId);
    if (leavingFolder) {
      return toFolderOutput(leavingFolder.source, true, feeds);
    }
    const committedFolder = committedLogical.folders.get(folderId);
    if (!committedFolder) {
      return undefined;
    }
    return toFolderOutput(committedFolder, true, feeds);
  }

  return {
    folders: state.folderOrder.map(resolveFolder).filter(isDefined),
    unfolderedFeeds: state.unfolderedOrder.map(resolveFeed).filter(isDefined),
  };
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
}

/**
 * Structural no-op check used to decide whether the diff effect should
 * `setState`. Because `PresenceState` never mirrors live (non-leaving) view
 * models, this only has to compare order arrays (by content) and the
 * *frozen* leaving snapshots (by reference — they are only ever copied
 * verbatim between passes, never rebuilt, so reference equality is exact
 * equality here). This makes the check correct even when the caller's
 * `folders` / `unfolderedFeeds` arrays are new objects with unchanged
 * content on every render: the resulting `PresenceState` is untouched
 * because no metadata is stored in it in the first place.
 */
export function presenceStatesEquivalent(prev: PresenceState, next: PresenceState): boolean {
  if (prev.scopeKey !== next.scopeKey) {
    return false;
  }
  if (!arraysEqual(prev.folderOrder, next.folderOrder)) {
    return false;
  }
  if (!arraysEqual(prev.unfolderedOrder, next.unfolderedOrder)) {
    return false;
  }
  if (prev.leavingFeeds.size !== next.leavingFeeds.size) {
    return false;
  }
  for (const [id, entry] of prev.leavingFeeds) {
    const nextEntry = next.leavingFeeds.get(id);
    if (!nextEntry || nextEntry.viewModel !== entry.viewModel || nextEntry.parentKey !== entry.parentKey) {
      return false;
    }
  }
  if (prev.leavingFolders.size !== next.leavingFolders.size) {
    return false;
  }
  for (const [id, entry] of prev.leavingFolders) {
    const nextEntry = next.leavingFolders.get(id);
    if (!nextEntry || nextEntry.source !== entry.source) {
      return false;
    }
  }
  if (prev.perFolderFeedOrder.size !== next.perFolderFeedOrder.size) {
    return false;
  }
  for (const [folderId, order] of prev.perFolderFeedOrder) {
    const nextOrder = next.perFolderFeedOrder.get(folderId);
    if (!nextOrder || !arraysEqual(order, nextOrder)) {
      return false;
    }
  }
  return true;
}

function readPrefersReducedMotion(): boolean {
  return readMatchMedia("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function collapseToLogical(logical: LogicalMaps, scopeKey: string): PresenceState {
  return {
    scopeKey,
    folderOrder: [...logical.folderOrder],
    leavingFolders: new Map(),
    perFolderFeedOrder: new Map([...logical.childOrderByFolder].map(([id, order]) => [id, [...order]])),
    unfolderedOrder: [...logical.unfolderedOrder],
    leavingFeeds: new Map(),
  };
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
  // current by the time this runs during render. See `buildOutput`'s doc
  // comment for why the fallback to it matters.
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
