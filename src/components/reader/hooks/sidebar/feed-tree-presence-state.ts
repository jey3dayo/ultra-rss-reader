import type { FeedTreeFeedViewModel, FeedTreeFolderViewModel } from "../../feed-tree.types";

/**
 * Pure presence/diff state machine for the sidebar feed tree: given the
 * logical tree (from `useSidebarFeedTree`'s output) as it was last reconciled
 * and as it is now, computes which rows should be retained as "leaving" and
 * the timer instructions the runtime owner (`use-feed-tree-presence.ts`)
 * must apply. Nothing here touches React, timers, or `window` — see that
 * file for the retention lifecycle and CSS/timer wiring this state feeds.
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
 *   `folders` / `unfolderedFeeds` props on every render (see
 *   `feed-tree-presence-output.ts`'s `buildOutput`), so metadata such as
 *   unread counts or selection is always current and never depends on
 *   whether the diff effect happened to run or skip a `setState`. This also
 *   means the diff effect's own no-op check only has to compare small,
 *   cheap state (id order arrays, and reference identity of *frozen* leaving
 *   snapshots) instead of deep-comparing every live view model on every
 *   render.
 */

export type TimerKind = "folder" | "feed";

export type TimerInstruction =
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
export type PresenceState = {
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

function diffLeavingFeeds(
  prevState: PresenceState,
  prevLogical: LogicalMaps,
  nextLogical: LogicalMaps,
  retentionEnabled: boolean,
): { leaving: Map<string, LeavingFeedEntry>; instructions: TimerInstruction[] } {
  const instructions: TimerInstruction[] = [];
  const leaving = new Map<string, LeavingFeedEntry>();
  // `prevLogical` must be included: an id that was logical last pass and has
  // just disappeared is in neither `nextLogical` nor `prevState.leavingFeeds`.
  const allFeedIds = new Set<string>([
    ...nextLogical.feeds.keys(),
    ...prevState.leavingFeeds.keys(),
    ...prevLogical.feeds.keys(),
  ]);
  for (const id of allFeedIds) {
    const wasLeaving = prevState.leavingFeeds.get(id);
    if (nextLogical.feeds.has(id) || !retentionEnabled) {
      if (wasLeaving) {
        instructions.push({ action: "cancel", kind: "feed", id });
      }
      continue;
    }
    if (wasLeaving) {
      leaving.set(id, wasLeaving);
      continue;
    }
    const lastKnown = prevLogical.feeds.get(id);
    if (!lastKnown) {
      continue;
    }
    leaving.set(id, { viewModel: lastKnown.viewModel, parentKey: lastKnown.parentKey });
    instructions.push({ action: "schedule", kind: "feed", id });
  }
  return { leaving, instructions };
}

/**
 * Collapse-owner handoff: children still leaving alongside a folder deferred
 * their collapse to the folder's wrapper. When the folder returns they own
 * their collapse again, so their exit timers must restart from now.
 */
function restartChildFeedTimers(
  folderId: string,
  nextLeavingFeeds: ReadonlyMap<string, LeavingFeedEntry>,
): TimerInstruction[] {
  const instructions: TimerInstruction[] = [];
  for (const [feedId, entry] of nextLeavingFeeds) {
    if (entry.parentKey === folderId) {
      instructions.push({ action: "schedule", kind: "feed", id: feedId });
    }
  }
  return instructions;
}

function diffLeavingFolders(
  prevState: PresenceState,
  prevLogical: LogicalMaps,
  nextLogical: LogicalMaps,
  retentionEnabled: boolean,
  nextLeavingFeeds: ReadonlyMap<string, LeavingFeedEntry>,
): { leaving: Map<string, LeavingFolderEntry>; instructions: TimerInstruction[] } {
  const instructions: TimerInstruction[] = [];
  const leaving = new Map<string, LeavingFolderEntry>();
  const allFolderIds = new Set<string>([
    ...nextLogical.folders.keys(),
    ...prevState.leavingFolders.keys(),
    ...prevLogical.folders.keys(),
  ]);
  for (const id of allFolderIds) {
    const wasLeaving = prevState.leavingFolders.get(id);
    if (nextLogical.folders.has(id)) {
      if (wasLeaving) {
        instructions.push({ action: "cancel", kind: "folder", id }, ...restartChildFeedTimers(id, nextLeavingFeeds));
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
      leaving.set(id, wasLeaving);
      continue;
    }
    const lastKnown = prevLogical.folders.get(id);
    if (!lastKnown) {
      continue;
    }
    leaving.set(id, { source: lastKnown });
    instructions.push({ action: "schedule", kind: "folder", id });
  }
  return { leaving, instructions };
}

function groupLeavingFeedIdsByParent(
  leavingFeeds: ReadonlyMap<string, LeavingFeedEntry>,
): Map<string | null, Set<string>> {
  const byParent = new Map<string | null, Set<string>>();
  for (const [feedId, entry] of leavingFeeds) {
    const bucket = byParent.get(entry.parentKey);
    if (bucket) {
      bucket.add(feedId);
    } else {
      byParent.set(entry.parentKey, new Set([feedId]));
    }
  }
  return byParent;
}

function mergeOrderIf(
  retentionEnabled: boolean,
  prevOrder: readonly string[],
  logicalOrder: readonly string[],
  leavingIds: ReadonlySet<string>,
): string[] {
  return retentionEnabled ? mergeOrder(prevOrder, logicalOrder, leavingIds) : [...logicalOrder];
}

function computePresenceOrders(
  prevState: PresenceState,
  nextLogical: LogicalMaps,
  retentionEnabled: boolean,
  nextLeavingFolders: ReadonlyMap<string, LeavingFolderEntry>,
  nextLeavingFeeds: ReadonlyMap<string, LeavingFeedEntry>,
): Pick<PresenceState, "folderOrder" | "perFolderFeedOrder" | "unfolderedOrder"> {
  const folderOrder = mergeOrderIf(
    retentionEnabled,
    prevState.folderOrder,
    nextLogical.folderOrder,
    new Set(nextLeavingFolders.keys()),
  );
  const leavingFeedIdsByParent = groupLeavingFeedIdsByParent(nextLeavingFeeds);

  const perFolderFeedOrder = new Map<string, string[]>();
  for (const folderId of folderOrder) {
    perFolderFeedOrder.set(
      folderId,
      mergeOrderIf(
        retentionEnabled,
        prevState.perFolderFeedOrder.get(folderId) ?? [],
        nextLogical.childOrderByFolder.get(folderId) ?? [],
        leavingFeedIdsByParent.get(folderId) ?? EMPTY_STRING_SET,
      ),
    );
  }

  const unfolderedOrder = mergeOrderIf(
    retentionEnabled,
    prevState.unfolderedOrder,
    nextLogical.unfolderedOrder,
    leavingFeedIdsByParent.get(null) ?? EMPTY_STRING_SET,
  );
  return { folderOrder, perFolderFeedOrder, unfolderedOrder };
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
  const feeds = diffLeavingFeeds(prevState, prevLogical, nextLogical, retentionEnabled);
  const folders = diffLeavingFolders(prevState, prevLogical, nextLogical, retentionEnabled, feeds.leaving);
  const orders = computePresenceOrders(prevState, nextLogical, retentionEnabled, folders.leaving, feeds.leaving);

  return {
    nextState: {
      scopeKey,
      ...orders,
      leavingFolders: folders.leaving,
      leavingFeeds: feeds.leaving,
    },
    instructions: [...feeds.instructions, ...folders.instructions],
  };
}

/** Drops a leaving row once its exit timer fires. A no-op if the row already reverted or was already dropped (e.g. by a scope reset or a reduced-motion collapse). No generation counter is needed: `applyTimerInstructions` (use-feed-tree-presence.ts) always clears an id's previous timer handle before scheduling a new one for the same id, so a superseded timer can never fire. */
export function dropExpiredEntry(state: PresenceState, kind: TimerKind, id: string): PresenceState {
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

export function collapseToLogical(logical: LogicalMaps, scopeKey: string): PresenceState {
  return {
    scopeKey,
    folderOrder: [...logical.folderOrder],
    leavingFolders: new Map(),
    perFolderFeedOrder: new Map([...logical.childOrderByFolder].map(([id, order]) => [id, [...order]])),
    unfolderedOrder: [...logical.unfolderedOrder],
    leavingFeeds: new Map(),
  };
}
