import type { ActiveDropTarget, FeedTreeFeedViewModel } from "./feed-tree.types";

const POINTER_DRAG_THRESHOLD = 6;

export type FeedTreePointerDragSession = {
  feed: FeedTreeFeedViewModel;
  pointerId: number;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
  hoverTarget: ActiveDropTarget;
};

export function createFeedTreePointerDragSession(
  feed: FeedTreeFeedViewModel,
  pointerId: number,
  clientX: number,
  clientY: number,
): FeedTreePointerDragSession {
  return {
    feed,
    pointerId,
    originX: clientX,
    originY: clientY,
    currentX: clientX,
    currentY: clientY,
    isDragging: false,
    hoverTarget: null,
  };
}

export function updateFeedTreePointerDragSessionPosition(
  session: FeedTreePointerDragSession,
  clientX: number,
  clientY: number,
) {
  session.currentX = clientX;
  session.currentY = clientY;
}

export function shouldStartFeedTreePointerDrag(
  session: FeedTreePointerDragSession,
  clientX: number,
  clientY: number,
): boolean {
  return Math.hypot(clientX - session.originX, clientY - session.originY) >= POINTER_DRAG_THRESHOLD;
}

export function getFeedTreePointerDragSessionForPointer(
  session: FeedTreePointerDragSession | null,
  pointerId: number,
): FeedTreePointerDragSession | null {
  if (!session || session.pointerId !== pointerId) {
    return null;
  }

  return session;
}
