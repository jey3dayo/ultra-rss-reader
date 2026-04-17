import { useEffect } from "react";
import type { ActiveDropTarget, UseFeedTreePointerDragEventsParams } from "./feed-tree.types";
import { applyFeedTreePointerDropOutcome, resolveFeedTreePointerDropOutcome } from "./feed-tree-drag-outcome";
import {
  getFeedTreePointerDragSessionForPointer,
  shouldStartFeedTreePointerDrag,
  updateFeedTreePointerDragSessionPosition,
} from "./feed-tree-drag-session";
import { getFeedDropTargetAtPoint, isSameFeedDropTarget } from "./feed-tree-drop-target";
import { applyFeedTreeHoverTarget } from "./feed-tree-hover-target";
import { bindWindowEvents } from "./use-browser-url-effect";

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

    return bindWindowEvents([
      { type: "pointermove", listener: handlePointerMove },
      { type: "pointerup", listener: handlePointerUp },
      { type: "pointercancel", listener: handlePointerCancel },
      { type: "keydown", listener: handleEscape },
    ]);
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
