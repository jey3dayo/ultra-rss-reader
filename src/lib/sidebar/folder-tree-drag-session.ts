import type { FeedTreeFolderViewModel } from "@/lib/sidebar/sidebar-feed-tree";
import type { FolderReorderDropTarget } from "./folder-tree-drop-target";

const POINTER_DRAG_THRESHOLD = 6;

export type FolderTreePointerDragSession = {
  folder: FeedTreeFolderViewModel;
  pointerId: number;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
  dropTarget: FolderReorderDropTarget;
};

export function createFolderTreePointerDragSession(
  folder: FeedTreeFolderViewModel,
  pointerId: number,
  clientX: number,
  clientY: number,
): FolderTreePointerDragSession {
  return {
    folder,
    pointerId,
    originX: clientX,
    originY: clientY,
    currentX: clientX,
    currentY: clientY,
    isDragging: false,
    dropTarget: null,
  };
}

export function updateFolderTreePointerDragSessionPosition(
  session: FolderTreePointerDragSession,
  clientX: number,
  clientY: number,
) {
  session.currentX = clientX;
  session.currentY = clientY;
}

export function shouldStartFolderTreePointerDrag(
  session: FolderTreePointerDragSession,
  clientX: number,
  clientY: number,
): boolean {
  return Math.hypot(clientX - session.originX, clientY - session.originY) >= POINTER_DRAG_THRESHOLD;
}

export function getFolderTreePointerDragSessionForPointer(
  session: FolderTreePointerDragSession | null,
  pointerId: number,
): FolderTreePointerDragSession | null {
  if (!session || session.pointerId !== pointerId) {
    return null;
  }

  return session;
}
