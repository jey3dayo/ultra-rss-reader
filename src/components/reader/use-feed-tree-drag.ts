import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  createFeedTreePointerDragSession,
  type FeedTreePointerDragSession,
  shouldStartFeedTreePointerDrag,
  updateFeedTreePointerDragSessionPosition,
} from "./feed-tree-drag-session";
import type { FeedTreeDragOverlayPreview } from "./feed-tree-drag-overlay";
import { getFeedDropTargetFromElement, isSameFeedDropTarget } from "./feed-tree-drop-target";
import type { ActiveDropTarget } from "./feed-tree-folder-section";
import type { FeedTreeFeedViewModel } from "./feed-tree-row";

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
  const suppressHandleClickRef = useRef(false);
  const suppressHandleClickTimeoutRef = useRef<number | null>(null);

  const activeVisualDropTarget = isPointerTracking ? pointerHoverTarget : activeDropTarget;
  const activeUnfoldered = canDragFeeds && activeVisualDropTarget?.kind === "unfoldered";
  const showUnfolderedDropZone = canDragFeeds && (normalizedDraggedFeedId !== null || pointerDragPreview !== null);

  const clearSuppressHandleClickTimer = useCallback(() => {
    if (suppressHandleClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressHandleClickTimeoutRef.current);
      suppressHandleClickTimeoutRef.current = null;
    }
  }, []);

  const clearPointerTracking = useCallback(() => {
    pointerDragRef.current = null;
    setIsPointerTracking(false);
    setPointerDragPreview(null);
    setPointerHoverTarget(null);
  }, []);

  const consumeSuppressedHandleClick = useCallback(() => suppressHandleClickRef.current, []);

  const queueSuppressHandleClickReset = useCallback(() => {
    clearSuppressHandleClickTimer();
    suppressHandleClickRef.current = true;
    suppressHandleClickTimeoutRef.current = window.setTimeout(() => {
      suppressHandleClickRef.current = false;
      suppressHandleClickTimeoutRef.current = null;
    }, 0);
  }, [clearSuppressHandleClickTimer]);

  const getDropTargetAtPoint = useCallback((x: number, y: number): ActiveDropTarget => {
    if (typeof document.elementFromPoint !== "function") {
      return null;
    }
    return getFeedDropTargetFromElement(document.elementFromPoint(x, y));
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

    const notifyHoverTarget = (target: ActiveDropTarget) => {
      setPointerHoverTarget(target);
      if (target?.kind === "folder") {
        onDragEnterFolder?.(target.folderId);
      } else if (target?.kind === "unfoldered") {
        onDragEnterUnfoldered?.();
      }
    };

    const finishPointerDrag = (target: ActiveDropTarget, shouldCancel: boolean) => {
      const session = pointerDragRef.current;
      if (!session) {
        clearPointerTracking();
        return;
      }

      if (!session.isDragging) {
        clearPointerTracking();
        return;
      }

      queueSuppressHandleClickReset();
      if (shouldCancel) {
        onDragEnd?.();
        clearPointerTracking();
        return;
      }

      if (target?.kind === "folder") {
        onDropToFolder?.(target.folderId);
      } else if (target?.kind === "unfoldered") {
        onDropToUnfoldered?.();
      } else {
        onDragEnd?.();
      }
      clearPointerTracking();
    };

    const handlePointerMove = (event: PointerEvent) => {
      const session = pointerDragRef.current;
      if (!session || event.pointerId !== session.pointerId) {
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

      const hoverTarget = getDropTargetAtPoint(event.clientX, event.clientY);
      if (!isSameFeedDropTarget(session.hoverTarget, hoverTarget)) {
        session.hoverTarget = hoverTarget;
        notifyHoverTarget(hoverTarget);
      }

      setPointerDragPreview({
        feed: session.feed,
        x: event.clientX,
        y: event.clientY,
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const session = pointerDragRef.current;
      if (!session || event.pointerId !== session.pointerId) {
        return;
      }
      finishPointerDrag(getDropTargetAtPoint(event.clientX, event.clientY), false);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      const session = pointerDragRef.current;
      if (!session || event.pointerId !== session.pointerId) {
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
    getDropTargetAtPoint,
    isPointerTracking,
    onDragEnd,
    onDragEnterFolder,
    onDragEnterUnfoldered,
    onDragStartFeed,
    onDropToFolder,
    onDropToUnfoldered,
    queueSuppressHandleClickReset,
  ]);

  useEffect(() => {
    return () => {
      clearSuppressHandleClickTimer();
    };
  }, [clearSuppressHandleClickTimer]);

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
