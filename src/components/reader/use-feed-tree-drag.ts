import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import type { FeedTreeDragOverlayPreview } from "./feed-tree-drag-overlay";
import type { ActiveDropTarget } from "./feed-tree-folder-section";
import type { FeedTreeFeedViewModel } from "./feed-tree-row";

const DROP_TARGET_KIND_ATTRIBUTE = "data-feed-drop-kind";
const DROP_TARGET_ID_ATTRIBUTE = "data-feed-drop-target";
const POINTER_DRAG_THRESHOLD = 6;

type PointerDragSession = {
  feed: FeedTreeFeedViewModel;
  pointerId: number;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
  hoverTarget: ActiveDropTarget;
};

function isSameDropTarget(left: ActiveDropTarget, right: ActiveDropTarget): boolean {
  if (left?.kind !== right?.kind) {
    return false;
  }
  if (left?.kind === "folder" && right?.kind === "folder") {
    return left.folderId === right.folderId;
  }
  return left === right;
}

function getDropTargetFromElement(element: Element | null): ActiveDropTarget {
  const dropTarget = element?.closest<HTMLElement>(`[${DROP_TARGET_KIND_ATTRIBUTE}]`);
  if (!dropTarget) {
    return null;
  }

  const kind = dropTarget.getAttribute(DROP_TARGET_KIND_ATTRIBUTE);
  if (kind === "folder") {
    const folderId = dropTarget.getAttribute(DROP_TARGET_ID_ATTRIBUTE);
    return folderId ? { kind: "folder", folderId } : null;
  }

  if (kind === "unfoldered") {
    return { kind: "unfoldered" };
  }

  return null;
}

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
  const pointerDragRef = useRef<PointerDragSession | null>(null);
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
    return getDropTargetFromElement(document.elementFromPoint(x, y));
  }, []);

  const handlePointerDownFeed = useCallback(
    (feed: FeedTreeFeedViewModel, event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!canDragFeeds || event.button !== 0) {
        return;
      }

      pointerDragRef.current = {
        feed,
        pointerId: event.pointerId,
        originX: event.clientX,
        originY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
        isDragging: false,
        hoverTarget: null,
      };
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

      session.currentX = event.clientX;
      session.currentY = event.clientY;

      if (!session.isDragging) {
        const distance = Math.hypot(event.clientX - session.originX, event.clientY - session.originY);
        if (distance < POINTER_DRAG_THRESHOLD) {
          return;
        }

        session.isDragging = true;
        onDragStartFeed?.(session.feed);
      }

      const hoverTarget = getDropTargetAtPoint(event.clientX, event.clientY);
      if (!isSameDropTarget(session.hoverTarget, hoverTarget)) {
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
