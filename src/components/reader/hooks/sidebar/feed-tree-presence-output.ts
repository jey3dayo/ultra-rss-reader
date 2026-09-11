import type {
  FeedTreeFolderViewModel,
  FeedTreePresenceFeedViewModel,
  FeedTreePresenceFolderViewModel,
} from "../../feed-tree.types";
import type { LogicalMaps, PresenceState } from "./feed-tree-presence-state";

/** The presence-augmented tree shape `useFeedTreePresence` (use-feed-tree-presence.ts) returns to the view. */
export type FeedTreePresenceResult = {
  folders: FeedTreePresenceFolderViewModel[];
  unfolderedFeeds: FeedTreePresenceFeedViewModel[];
};

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
 * was last diffed against (i.e. as of the last time the diff effect in
 * `use-feed-tree-presence.ts` ran).
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
export function buildOutput(
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
