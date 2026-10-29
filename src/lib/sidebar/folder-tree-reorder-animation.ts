import { FOLDER_REORDER_FOLDER_ID_ATTRIBUTE } from "./folder-tree-drop-target";

const FLIP_SPRING_OPTIONS: KeyframeAnimationOptions = {
  duration: 420,
  easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  fill: "both",
};

const REDUCED_MOTION_HIGHLIGHT_MS = 150;

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
  now: number;
}): FolderReorderSnapshot | null {
  const { container, targetAttribute, now } = params;
  if (!container) {
    return null;
  }

  const topByFolderId = new Map<string, number>();
  for (const row of listReorderRows(container, targetAttribute)) {
    const folderId = row.getAttribute(FOLDER_REORDER_FOLDER_ID_ATTRIBUTE);
    if (folderId) {
      topByFolderId.set(folderId, row.getBoundingClientRect().top);
    }
  }

  return topByFolderId.size === 0 ? null : { capturedAt: now, topByFolderId };
}

export function playFolderReorderAnimation(params: {
  container: HTMLElement | null;
  targetAttribute: string;
  snapshot: FolderReorderSnapshot;
  reducedMotion: boolean;
  now: number;
}): void {
  const { container, targetAttribute, snapshot, reducedMotion, now } = params;
  if (!container || now - snapshot.capturedAt > FOLDER_REORDER_SNAPSHOT_MAX_AGE_MS) {
    return;
  }

  for (const row of listReorderRows(container, targetAttribute)) {
    const folderId = row.getAttribute(FOLDER_REORDER_FOLDER_ID_ATTRIBUTE);
    const previousTop = folderId ? snapshot.topByFolderId.get(folderId) : undefined;
    if (previousTop === undefined) {
      continue;
    }

    const deltaY = previousTop - row.getBoundingClientRect().top;
    if (Math.abs(deltaY) < 1) {
      continue;
    }

    if (reducedMotion) {
      row.animate([{ backgroundColor: "var(--feed-tree-drop-target-surface)" }, { backgroundColor: "transparent" }], {
        duration: REDUCED_MOTION_HIGHLIGHT_MS,
        fill: "none",
      });
      continue;
    }

    row.animate([{ transform: `translateY(${deltaY}px)` }, { transform: "translateY(0)" }], FLIP_SPRING_OPTIONS);
  }
}
