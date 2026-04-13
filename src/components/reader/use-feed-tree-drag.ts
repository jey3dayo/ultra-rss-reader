import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { applyFeedTreePointerDropOutcome, resolveFeedTreePointerDropOutcome } from "./feed-tree-drag-outcome";
import type { FeedTreeDragOverlayPreview } from "./feed-tree-drag-overlay";
import {
  createFeedTreePointerDragSession,
  type FeedTreePointerDragSession,
  getFeedTreePointerDragSessionForPointer,
  shouldStartFeedTreePointerDrag,
  updateFeedTreePointerDragSessionPosition,
} from "./feed-tree-drag-session";
import { getFeedDropTargetAtPoint, isSameFeedDropTarget } from "./feed-tree-drop-target";
import type { ActiveDropTarget } from "./feed-tree-folder-section";
import { applyFeedTreeHoverTarget } from "./feed-tree-hover-target";
import type { FeedTreeFeedViewModel } from "./feed-tree-row";
import { useFeedTreeHandleClickSuppression } from "./use-feed-tree-handle-click-suppression";

export type UseFeedTreeDragParams = {
  isOpen: boolean;
  hasFeeds: boolean;
  canDragFeeds: boolean;
  activeDropTarget: ActiveDropTarget;
  draggedFeedId?: string | null;
  onDragStartFeed?: (feed: FeedTreeFeedViewModel) => void;
  onDragEnterFolder?: (folderId: string) => void;
  onDragEnterUnfoldered?: () => void;
  onDropToFolder?: (folderId: string) => void;
  onDropToUnfoldered?: () => void;
  onDragEnd?: () => void;
};

export type UseFeedTreeDragResult = {
  isPointerTracking: boolean;
  pointerDragPreview: FeedTreeDragOverlayPreview | null;
  activeVisualDropTarget: ActiveDropTarget;
  activeUnfoldered: boolean;
  showUnfolderedDropZone: boolean;
  normalizedDraggedFeedId: string | null;
  handlePointerDownFeed: (feed: FeedTreeFeedViewModel, event: ReactPointerEvent<HTMLButtonElement>) => void;
  consumeSuppressedHandleClick: () => boolean;
};

export function useFeedTreeDrag({
  isOpen,
  hasFeeds,
  canDragFeeds,
  activeDropTarget,
  draggedFeedId,
  onDragStartFeed,
  onDragEnterFolder,
  onDragEnterUnfoldered,
  onDropToFolder,
  onDropToUnfoldered,
  onDragEnd,
}: UseFeedTreeDragParams): UseFeedTreeDragResult {
  const normalizedDraggedFeedId = draggedFeedId ?? null;
  const [isPointerTracking, setIsPointerTracking] = useState(false);
  const [pointerDragPreview, setPointerDragPreview] = useState<FeedTreeDragOverlayPreview | null>(null);
  const [pointerHoverTarget, setPointerHoverTarget] = useState<ActiveDropTarget>(null);
  const pointerDragRef = useRef<FeedTreePointerDragSession | null>(null);
  const { consumeSuppressedHandleClick, queueSuppressHandleClickReset } = useFeedTreeHandleClickSuppression();

  const activeVisualDropTarget = isPointerTracking ? pointerHoverTarget : activeDropTarget;
  const activeUnfoldered = canDragFeeds && activeVisualDropTarget?.kind === "unfoldered";
  const showUnfolderedDropZone = canDragFeeds && (normalizedDraggedFeedId !== null || pointerDragPreview !== null);

  const clearPointerTracking = useCallback(() => {
    pointerDragRef.current = null;
    setIsPointerTracking(false);
    setPointerDragPreview(null);
    setPointerHoverTarget(null);
  }, []);

  const handlePointerDownFeed = useCallback(
    (feed: FeedTreeFeedViewModel, event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!canDragFeeds || event.button !== 0) {
        return;
      }

      pointerDragRef.current = createFeedTreePointerDragSession(feed, event.pointerId, event.clientX, event.clientY);
      setIsPointerTracking(true);
    },
    [canDragFeeds],
  );

  useEffect(() => {
    if (!isOpen || !hasFeeds || !canDragFeeds) {
      clearPointerTracking();
    }
  }, [canDragFeeds, clearPointerTracking, hasFeeds, isOpen]);

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
    queueSuppressHandleClickReset,
  ]);

  return {
    isPointerTracking,
    pointerDragPreview,
    activeVisualDropTarget,
    activeUnfoldered,
    showUnfolderedDropZone,
    normalizedDraggedFeedId,
    handlePointerDownFeed,
    consumeSuppressedHandleClick,
  };
}
