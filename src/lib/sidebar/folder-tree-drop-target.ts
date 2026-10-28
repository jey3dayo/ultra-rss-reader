export const FOLDER_REORDER_TARGET_ATTRIBUTE = "data-folder-reorder-target";
export const FOLDER_REORDER_FOLDER_ID_ATTRIBUTE = "data-folder-reorder-folder-id";

export type FolderReorderDropTarget = {
  insertionIndex: number;
} | null;

export function isSameFolderReorderDropTarget(left: FolderReorderDropTarget, right: FolderReorderDropTarget): boolean {
  if (left === null || right === null) {
    return left === right;
  }

  return left.insertionIndex === right.insertionIndex;
}

function getFolderReorderTargets(): HTMLElement[] {
  if (typeof document === "undefined") {
    return [];
  }

  return Array.from(document.querySelectorAll<HTMLElement>(`[${FOLDER_REORDER_TARGET_ATTRIBUTE}="true"]`)).filter(
    (element) => !element.closest('[aria-hidden="true"]'),
  );
}

export function resolveFolderReorderInsertionIndex(clientY: number): FolderReorderDropTarget {
  const targets = getFolderReorderTargets();
  if (targets.length === 0) {
    return null;
  }

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    const rect = target.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;

    if (clientY < midpoint) {
      return { insertionIndex: index };
    }
  }

  return { insertionIndex: targets.length };
}
