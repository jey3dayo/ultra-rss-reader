import type { ActiveDropTarget } from "./feed-tree-folder-section";

export const FEED_DROP_TARGET_KIND_ATTRIBUTE = "data-feed-drop-kind";
export const FEED_DROP_TARGET_ID_ATTRIBUTE = "data-feed-drop-target";

export function isSameFeedDropTarget(left: ActiveDropTarget, right: ActiveDropTarget): boolean {
  if (left?.kind !== right?.kind) {
    return false;
  }

  if (left?.kind === "folder" && right?.kind === "folder") {
    return left.folderId === right.folderId;
  }

  if (left?.kind === "unfoldered" && right?.kind === "unfoldered") {
    return true;
  }

  return left === right;
}

export function getFeedDropTargetFromElement(element: Element | null): ActiveDropTarget {
  const dropTarget = element?.closest<HTMLElement>(`[${FEED_DROP_TARGET_KIND_ATTRIBUTE}]`);
  if (!dropTarget) {
    return null;
  }

  const kind = dropTarget.getAttribute(FEED_DROP_TARGET_KIND_ATTRIBUTE);
  if (kind === "folder") {
    const folderId = dropTarget.getAttribute(FEED_DROP_TARGET_ID_ATTRIBUTE);
    return folderId ? { kind: "folder", folderId } : null;
  }

  if (kind === "unfoldered") {
    return { kind: "unfoldered" };
  }

  return null;
}

export function getFeedDropTargetAtPoint(x: number, y: number): ActiveDropTarget {
  if (typeof document.elementFromPoint !== "function") {
    return null;
  }

  return getFeedDropTargetFromElement(document.elementFromPoint(x, y));
}
