import { MOTION_DATA_SIDEBAR_ROW_LEAVING_ATTRIBUTE } from "@/constants";
import { FOLDER_REORDER_FOLDER_ID_ATTRIBUTE } from "./folder-tree-drop-target";
import { FOLDER_REORDER_SNAPSHOT_MAX_AGE_MS, fadeOptions, flipOptions } from "./folder-tree-reorder-animation";

export const FEED_MOVE_FEED_ROW_ATTRIBUTE = "data-feed-row-id";
export const FEED_MOVE_FOLDER_ROW_ATTRIBUTE = "data-folder-row-id";

const MOTION_ROW_SELECTOR = `[${FEED_MOVE_FEED_ROW_ATTRIBUTE}], [${FEED_MOVE_FOLDER_ROW_ATTRIBUTE}]`;
const NOT_ANIMATABLE_ANCESTOR_SELECTOR = `[aria-hidden="true"], [inert], [${MOTION_DATA_SIDEBAR_ROW_LEAVING_ATTRIBUTE}="true"]`;
// The row's button carries the mount-time list-item enter animation; the fade has to sit on the same element to override it.
const MOVED_ROW_FADE_TARGET_SELECTOR = "[data-feed-id]";
const FADE_KEYFRAMES: Keyframe[] = [{ opacity: 0.6 }, { opacity: 1 }];

// Animated rows are leaves only (feed rows and folder header rows), so a folder's displacement never stacks on its children's.
export type FeedMoveSnapshot = {
  capturedAt: number;
  scopeKey: string;
  scrollTop: number;
  movedFeedId: string;
  destinationFolderId: string | null;
  movedRow: HTMLElement | null;
  topByRowKey: ReadonlyMap<string, number>;
};

type MotionRow = { key: string; element: HTMLElement };

function readRowKey(element: HTMLElement): string | null {
  const feedId = element.getAttribute(FEED_MOVE_FEED_ROW_ATTRIBUTE);
  if (feedId) {
    return `feed:${feedId}`;
  }
  const folderId = element.getAttribute(FEED_MOVE_FOLDER_ROW_ATTRIBUTE);
  return folderId ? `folder:${folderId}` : null;
}

function listMotionRows(container: HTMLElement): MotionRow[] {
  const rows: MotionRow[] = [];
  for (const element of container.querySelectorAll<HTMLElement>(MOTION_ROW_SELECTOR)) {
    const key = readRowKey(element);
    if (key) {
      rows.push({ key, element });
    }
  }
  return rows;
}

function isRowAnimatable(element: HTMLElement): boolean {
  return element.closest(NOT_ANIMATABLE_ANCESTOR_SELECTOR) === null;
}

function readOwningFolderId(element: HTMLElement): string | null {
  return (
    element.closest(`[${FOLDER_REORDER_FOLDER_ID_ATTRIBUTE}]`)?.getAttribute(FOLDER_REORDER_FOLDER_ID_ATTRIBUTE) ?? null
  );
}

export function captureFeedMoveSnapshot(params: {
  container: HTMLElement | null;
  feedId: string;
  destinationFolderId: string | null;
  scopeKey: string;
  now: number;
}): FeedMoveSnapshot | null {
  const { container, feedId, destinationFolderId, scopeKey, now } = params;
  if (!container) {
    return null;
  }

  const movedKey = `feed:${feedId}`;
  const topByRowKey = new Map<string, number>();
  let movedRow: HTMLElement | null = null;
  for (const { key, element } of listMotionRows(container)) {
    if (key === movedKey) {
      movedRow = element;
    } else if (isRowAnimatable(element)) {
      topByRowKey.set(key, element.getBoundingClientRect().top);
    }
  }

  return {
    capturedAt: now,
    scopeKey,
    scrollTop: container.scrollTop,
    movedFeedId: feedId,
    destinationFolderId,
    movedRow,
    topByRowKey,
  };
}

export type FeedMovePlayResult = { outcome: "pending" | "discarded" } | { outcome: "played"; animations: Animation[] };

// "pending" means the move has not reached the DOM yet, so layout changes unrelated to it (drop zone teardown,
// hover styles) must not consume the snapshot.
export function playFeedMoveAnimation(params: {
  container: HTMLElement | null;
  snapshot: FeedMoveSnapshot;
  scopeKey: string;
  reducedMotion: boolean;
  now: number;
}): FeedMovePlayResult {
  const { container, snapshot, scopeKey, reducedMotion, now } = params;
  if (
    !container ||
    scopeKey !== snapshot.scopeKey ||
    container.scrollTop !== snapshot.scrollTop ||
    now - snapshot.capturedAt > FOLDER_REORDER_SNAPSHOT_MAX_AGE_MS
  ) {
    return { outcome: "discarded" };
  }

  const movedKey = `feed:${snapshot.movedFeedId}`;
  const rows = listMotionRows(container);
  const movedRow = rows.find((row) => row.key === movedKey)?.element ?? null;
  const landed = movedRow
    ? readOwningFolderId(movedRow) === snapshot.destinationFolderId
    : snapshot.movedRow !== null && !snapshot.movedRow.isConnected;
  if (!landed) {
    return { outcome: "pending" };
  }

  const animations: Animation[] = [];
  for (const { key, element } of rows) {
    const previousTop = snapshot.topByRowKey.get(key);
    if (previousTop === undefined || !isRowAnimatable(element)) {
      continue;
    }
    const deltaY = previousTop - element.getBoundingClientRect().top;
    if (Math.abs(deltaY) < 1) {
      continue;
    }
    animations.push(
      reducedMotion
        ? element.animate(FADE_KEYFRAMES, fadeOptions())
        : element.animate([{ transform: `translateY(${deltaY}px)` }, { transform: "translateY(0)" }], flipOptions()),
    );
  }

  if (movedRow && isRowAnimatable(movedRow)) {
    const fadeTarget = movedRow.querySelector<HTMLElement>(MOVED_ROW_FADE_TARGET_SELECTOR) ?? movedRow;
    animations.push(fadeTarget.animate(FADE_KEYFRAMES, fadeOptions()));
  }

  return { outcome: "played", animations };
}

export type FeedMoveMotionSession = { stop: () => void };

export function watchFeedMoveAnimation(params: {
  container: HTMLElement | null;
  snapshot: FeedMoveSnapshot;
  getScopeKey: () => string;
  reducedMotion: boolean;
}): FeedMoveMotionSession {
  const { container, snapshot, getScopeKey, reducedMotion } = params;
  if (!container) {
    return { stop: () => undefined };
  }

  const animations: Animation[] = [];
  let timeoutId: number | null = null;
  const observer = new MutationObserver(() => {
    const result = playFeedMoveAnimation({
      container,
      snapshot,
      scopeKey: getScopeKey(),
      reducedMotion,
      now: Date.now(),
    });
    if (result.outcome === "played") {
      animations.push(...result.animations);
    }
    if (result.outcome !== "pending") {
      stopWatching();
    }
  });

  function stopWatching() {
    observer.disconnect();
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function stop() {
    stopWatching();
    for (const animation of animations.splice(0)) {
      animation.cancel();
    }
  }

  observer.observe(container, { childList: true, subtree: true });
  timeoutId = window.setTimeout(stopWatching, FOLDER_REORDER_SNAPSHOT_MAX_AGE_MS);
  return { stop };
}
