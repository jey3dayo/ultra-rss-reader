import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useReducer, useRef } from "react";
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

type FeedTreeDragState = {
  isPointerTracking: boolean;
  pointerDragPreview: FeedTreeDragOverlayPreview | null;
  pointerHoverTarget: ActiveDropTarget;
};

type FeedTreeDragAction =
  | { type: "set-is-pointer-tracking"; value: boolean }
  | { type: "set-pointer-drag-preview"; value: FeedTreeDragOverlayPreview | null }
  | { type: "set-pointer-hover-target"; value: ActiveDropTarget }
  | { type: "clear-pointer-tracking" };

const initialFeedTreeDragState: FeedTreeDragState = {
  isPointerTracking: false,
  pointerDragPreview: null,
  pointerHoverTarget: null,
};

function feedTreeDragReducer(state: FeedTreeDragState, action: FeedTreeDragAction): FeedTreeDragState {
  switch (action.type) {
    case "set-is-pointer-tracking":
      return { ...state, isPointerTracking: action.value };
    case "set-pointer-drag-preview":
      return { ...state, pointerDragPreview: action.value };
    case "set-pointer-hover-target":
      return { ...state, pointerHoverTarget: action.value };
    case "clear-pointer-tracking":
      return { ...state, isPointerTracking: false, pointerDragPreview: null, pointerHoverTarget: null };
    default:
      return state;
  }
}

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
  const [state, dispatch] = useReducer(feedTreeDragReducer, initialFeedTreeDragState);
  const { isPointerTracking, pointerDragPreview, pointerHoverTarget } = state;
  const pointerDragRef = useRef<FeedTreePointerDragSession | null>(null);
  const { consumeSuppressedHandleClick, queueSuppressHandleClickReset } = useFeedTreeHandleClickSuppression();

  const activeVisualDropTarget = isPointerTracking ? pointerHoverTarget : activeDropTarget;
  const activeUnfoldered = canDragFeeds && activeVisualDropTarget?.kind === "unfoldered";
  const showUnfolderedDropZone = canDragFeeds && (normalizedDraggedFeedId !== null || pointerDragPreview !== null);

  const clearPointerTracking = useCallback(() => {
    pointerDragRef.current = null;
    dispatch({ type: "clear-pointer-tracking" });
  }, []);

  const handlePointerDownFeed = useCallback(
    (feed: FeedTreeFeedViewModel, event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!canDragFeeds || event.button !== 0) {
        return;
      }

      pointerDragRef.current = createFeedTreePointerDragSession(feed, event.pointerId, event.clientX, event.clientY);
      dispatch({ type: "set-is-pointer-tracking", value: true });
    },
    [canDragFeeds],
  );

  const setPointerDragPreview: UseFeedTreeDragResult extends never
    ? never
    : (
        value:
          | FeedTreeDragOverlayPreview
          | null
          | ((currentValue: FeedTreeDragOverlayPreview | null) => FeedTreeDragOverlayPreview | null),
      ) => void = useCallback(
    (value) => {
      dispatch({
        type: "set-pointer-drag-preview",
        value: typeof value === "function" ? value(pointerDragPreview) : value,
      });
    },
    [pointerDragPreview],
  );

  const setPointerHoverTarget: (
    value: ActiveDropTarget | ((currentValue: ActiveDropTarget) => ActiveDropTarget),
  ) => void = useCallback(
    (value) => {
      dispatch({
        type: "set-pointer-hover-target",
        value: typeof value === "function" ? value(pointerHoverTarget) : value,
      });
    },
    [pointerHoverTarget],
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
