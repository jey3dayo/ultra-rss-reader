import type { ReaderQuerySelection } from "@/lib/reader/reader-query";

export const MAX_SELECTION_HISTORY_ENTRIES = 50;

export type SelectionHistory = {
  entries: readonly ReaderQuerySelection[];
  index: number;
};

export type SelectionHistoryDirection = "back" | "forward";

export function createSelectionHistory(selection: ReaderQuerySelection): SelectionHistory {
  return { entries: [selection], index: 0 };
}

export function isSameSelection(a: ReaderQuerySelection, b: ReaderQuerySelection): boolean {
  switch (a.type) {
    case "feed":
      return b.type === "feed" && a.feedId === b.feedId;
    case "folder":
      return b.type === "folder" && a.folderId === b.folderId;
    case "tag":
      return b.type === "tag" && a.tagId === b.tagId;
    case "smart":
      return b.type === "smart" && a.kind === b.kind;
    case "all":
      return b.type === "all";
  }
}

/** Records a user-driven selection; drops the forward side like a browser and caps the length. */
export function pushSelectionHistory(history: SelectionHistory, selection: ReaderQuerySelection): SelectionHistory {
  const current = history.entries[history.index];
  if (current !== undefined && isSameSelection(current, selection)) {
    return history;
  }

  const entries = [...history.entries.slice(0, history.index + 1), selection].slice(-MAX_SELECTION_HISTORY_ENTRIES);
  return { entries, index: entries.length - 1 };
}

/**
 * Finds the nearest entry in `direction` that differs from `current` and is still available.
 * A history whose cursor no longer matches `current` was bypassed by a direct state write, so it is ignored.
 */
export function findSelectionHistoryTarget(
  history: SelectionHistory,
  direction: SelectionHistoryDirection,
  current: ReaderQuerySelection,
  isAvailable: (selection: ReaderQuerySelection) => boolean,
): number | null {
  const cursorEntry = history.entries[history.index];
  if (cursorEntry === undefined || !isSameSelection(cursorEntry, current)) {
    return null;
  }

  const step = direction === "back" ? -1 : 1;
  for (let index = history.index + step; index >= 0 && index < history.entries.length; index += step) {
    const entry = history.entries[index];
    if (entry !== undefined && !isSameSelection(entry, current) && isAvailable(entry)) {
      return index;
    }
  }
  return null;
}
