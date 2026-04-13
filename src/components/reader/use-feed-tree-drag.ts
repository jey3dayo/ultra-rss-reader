import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import type {
  ActiveDropTarget,
  FeedTreeFeedViewModel,
  UseFeedTreeDragParams,
  UseFeedTreeDragResult,
} from "./feed-tree.types";
import type { FeedTreeDragOverlayPreview } from "./feed-tree-drag-overlay";
import { createFeedTreePointerDragSession, type FeedTreePointerDragSession } from "./feed-tree-drag-session";
import { useFeedTreeHandleClickSuppression } from "./use-feed-tree-handle-click-suppression";
import { useFeedTreePointerDragEvents } from "./use-feed-tree-pointer-drag-events";

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

  useFeedTreePointerDragEvents({
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
  });

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
