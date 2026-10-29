import { FOLDER_REORDER_FOLDER_ID_ATTRIBUTE } from "./folder-tree-drop-target";

function readMotionToken(name: string, fallback: string): string {
  if (typeof document === "undefined") {
    return fallback;
  }
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

// WAAPI cannot resolve var() in its timing options, so the shared tokens are read from the token layer.
function flipOptions(): KeyframeAnimationOptions {
  return {
    duration: Number.parseFloat(readMotionToken("--motion-duration-resize", "260")),
    easing: readMotionToken("--motion-ease-standard", "ease-out"),
    fill: "both",
  };
}

function reducedMotionFadeOptions(): KeyframeAnimationOptions {
  return {
    duration: Number.parseFloat(readMotionToken("--motion-duration-contextual", "180")),
    easing: readMotionToken("--motion-ease-standard", "ease-out"),
  };
}

export const FOLDER_REORDER_SNAPSHOT_MAX_AGE_MS = 1500;

export type FolderReorderSnapshot = {
  capturedAt: number;
  topByFolderId: ReadonlyMap<string, number>;
};

function listReorderRows(container: HTMLElement, targetAttribute: string): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(`[${targetAttribute}]`));
}

export function captureFolderReorderSnapshot(params: {
  container: HTMLElement | null;
  targetAttribute: string;
  idAttribute?: string;
  now: number;
}): FolderReorderSnapshot | null {
  const { container, targetAttribute, idAttribute = FOLDER_REORDER_FOLDER_ID_ATTRIBUTE, now } = params;
  if (!container) {
    return null;
  }

  const topByFolderId = new Map<string, number>();
  for (const row of listReorderRows(container, targetAttribute)) {
    const folderId = row.getAttribute(idAttribute);
    if (folderId) {
      topByFolderId.set(folderId, row.getBoundingClientRect().top);
    }
  }

  return topByFolderId.size === 0 ? null : { capturedAt: now, topByFolderId };
}

export type FolderReorderPlayOutcome = "played" | "unmoved" | "expired";

// "unmoved" means no row has left its captured position yet, so the caller keeps the snapshot
// for the render that actually applies the new order.
export function playFolderReorderAnimation(params: {
  container: HTMLElement | null;
  targetAttribute: string;
  idAttribute?: string;
  snapshot: FolderReorderSnapshot;
  reducedMotion: boolean;
  now: number;
}): FolderReorderPlayOutcome {
  const {
    container,
    targetAttribute,
    idAttribute = FOLDER_REORDER_FOLDER_ID_ATTRIBUTE,
    snapshot,
    reducedMotion,
    now,
  } = params;
  if (!container || now - snapshot.capturedAt > FOLDER_REORDER_SNAPSHOT_MAX_AGE_MS) {
    return "expired";
  }

  let played = false;
  for (const row of listReorderRows(container, targetAttribute)) {
    const folderId = row.getAttribute(idAttribute);
    const previousTop = folderId ? snapshot.topByFolderId.get(folderId) : undefined;
    if (previousTop === undefined) {
      continue;
    }

    const deltaY = previousTop - row.getBoundingClientRect().top;
    if (Math.abs(deltaY) < 1) {
      continue;
    }

    played = true;
    if (reducedMotion) {
      row.animate([{ opacity: 0.6 }, { opacity: 1 }], reducedMotionFadeOptions());
      continue;
    }

    row.animate([{ transform: `translateY(${deltaY}px)` }, { transform: "translateY(0)" }], flipOptions());
  }

  return played ? "played" : "unmoved";
}

// The new order reaches the DOM a render or two after the drop (optimistic cache write, then the
// presence layer), so the rows are watched until one of them has actually moved.
export function watchFolderReorderAnimation(params: {
  container: HTMLElement | null;
  targetAttribute: string;
  idAttribute?: string;
  snapshot: FolderReorderSnapshot;
  reducedMotion: boolean;
}): () => void {
  const { container, targetAttribute, idAttribute, snapshot, reducedMotion } = params;
  if (!container) {
    return () => undefined;
  }

  let timeoutId: number | null = null;
  const observer = new MutationObserver(() => {
    const outcome = playFolderReorderAnimation({
      container,
      targetAttribute,
      idAttribute,
      snapshot,
      reducedMotion,
      now: Date.now(),
    });
    if (outcome !== "unmoved") {
      stop();
    }
  });

  function stop() {
    observer.disconnect();
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  observer.observe(container, { childList: true, subtree: true });
  timeoutId = window.setTimeout(stop, FOLDER_REORDER_SNAPSHOT_MAX_AGE_MS);
  return stop;
}
