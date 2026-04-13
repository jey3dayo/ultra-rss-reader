import { type Dispatch, type MutableRefObject, type SetStateAction, useEffect } from "react";
import { applyFeedTreePointerDropOutcome, resolveFeedTreePointerDropOutcome } from "./feed-tree-drag-outcome";
import type { FeedTreeDragOverlayPreview } from "./feed-tree-drag-overlay";
import { getFeedTreePointerDragSessionForPointer, shouldStartFeedTreePointerDrag, updateFeedTreePointerDragSessionPosition } from "./feed-tree-drag-session";
import { getFeedDropTargetAtPoint, isSameFeedDropTarget } from "./feed-tree-drop-target";
import type { ActiveDropTarget } from "./feed-tree-folder-section";
import { applyFeedTreeHoverTarget } from "./feed-tree-hover-target";
import type { FeedTreeFeedViewModel } from "./feed-tree-row";

type UseFeedTreePointerDragEventsParams = {
  isPointerTracking: boolean;
  pointerDragRef: MutableRefObject<ReturnType<typeof getFeedTreePointerDragSessionForPointer> | null>;
  setPointerDragPreview: Dispatch<SetStateAction<FeedTreeDragOverlayPreview | null>>;
  setPointerHoverTarget: Dispatch<SetStateAction<ActiveDropTarget>>;
  queueSuppressHandleClickReset: () => void;
  clearPointerTracking: () => void;
  onDragStartFeed?: (feed: FeedTreeFeedViewModel) => void;
  onDragEnterFolder?: (folderId: string) => void;
  onDragEnterUnfoldered?: () => void;
  onDropToFolder?: (folderId: string) => void;
  onDropToUnfoldered?: () => void;
  onDragEnd?: () => void;
};

export function useFeedTreePointerDragEvents({
  isPointerTracking,
  pointerDragRef,
  setPointerDragPreview,
  setPointerHoverTarget,
  queueSuppressHandleClickReset,
  clearPointerTracking,
  onDragStartFeed,
  onDragEnterFolder,
  onDragEnterUnfoldered,
  onDropToFolder,
  onDropToUnfoldered,
  onDragEnd,
}: UseFeedTreePointerDragEventsParams) {
  useEffect(() => {
    if (!isPointerTracking) {
      return;
    }

    const finishPointerDrag = (target: ActiveDropTarget, shouldCancel: boolean) => {
      applyFeedTreePointerDropOutcome({
        outcome: resolveFeedTreePointerDropOutcome(pointerDragRef.current, target, shouldCancel),
        queueSuppressHandleClickReset,
        clearPointerTracking,
        onDragEnd,
        onDropToFolder,
        onDropToUnfoldered,
      });
    };

    const handlePointerMove = (event: PointerEvent) => {
      const session = getFeedTreePointerDragSessionForPointer(pointerDragRef.current, event.pointerId);
      if (!session) {
        return;
      }

      updateFeedTreePointerDragSessionPosition(session, event.clientX, event.clientY);

      if (!session.isDragging && shouldStartFeedTreePointerDrag(session, event.clientX, event.clientY)) {
        session.isDragging = true;
        onDragStartFeed?.(session.feed);
      }

      if (!session.isDragging) {
        return;
      }

      const hoverTarget = getFeedDropTargetAtPoint(event.clientX, event.clientY);
      if (!isSameFeedDropTarget(session.hoverTarget, hoverTarget)) {
        session.hoverTarget = hoverTarget;
        applyFeedTreeHoverTarget({
          target: hoverTarget,
          setPointerHoverTarget,
          onDragEnterFolder,
          onDragEnterUnfoldered,
        });
      }

      setPointerDragPreview({
        feed: session.feed,
        x: event.clientX,
        y: event.clientY,
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const session = getFeedTreePointerDragSessionForPointer(pointerDragRef.current, event.pointerId);
      if (!session) {
        return;
      }
      finishPointerDrag(getFeedDropTargetAtPoint(event.clientX, event.clientY), false);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      const session = getFeedTreePointerDragSessionForPointer(pointerDragRef.current, event.pointerId);
      if (!session) {
        return;
      }
      finishPointerDrag(null, true);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !pointerDragRef.current) {
        return;
      }
      finishPointerDrag(null, true);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [
    clearPointerTracking,
    isPointerTracking,
    onDragEnd,
    onDragEnterFolder,
    onDragEnterUnfoldered,
    onDragStartFeed,
    onDropToFolder,
    onDropToUnfoldered,
    pointerDragRef,
    queueSuppressHandleClickReset,
    setPointerDragPreview,
    setPointerHoverTarget,
  ]);
}
