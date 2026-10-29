import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useReducer, useRef } from "react";
import type {
  UseFolderTreeDragParams,
  UseFolderTreeDragResult,
} from "@/components/reader/hooks/feed-tree/folder-tree-drag.types";
import { useFeedTreeHandleClickSuppression } from "@/components/reader/hooks/feed-tree/use-feed-tree-handle-click-suppression";
import { useFolderTreePointerDragEvents } from "@/components/reader/hooks/feed-tree/use-folder-tree-pointer-drag-events";
import { createFolderTreePointerDragSession } from "@/lib/sidebar/folder-tree-drag-session";
import type { FolderReorderDropTarget } from "@/lib/sidebar/folder-tree-drop-target";
import type { FeedTreePresenceFolderViewModel } from "../../feed-tree.types";
import type { FolderTreeDragOverlayPreview } from "./folder-tree-drag.types";

type FolderTreeDragState = {
  isPointerTracking: boolean;
  pointerDragPreview: FolderTreeDragOverlayPreview | null;
  dropTarget: FolderReorderDropTarget;
};

type FolderTreeDragAction =
  | { type: "set-is-pointer-tracking"; value: boolean }
  | { type: "set-pointer-drag-preview"; value: FolderTreeDragOverlayPreview | null }
  | { type: "set-drop-target"; value: FolderReorderDropTarget }
  | { type: "clear-pointer-tracking" };

const initialFolderTreeDragState: FolderTreeDragState = {
  isPointerTracking: false,
  pointerDragPreview: null,
  dropTarget: null,
};

function folderTreeDragReducer(state: FolderTreeDragState, action: FolderTreeDragAction): FolderTreeDragState {
  switch (action.type) {
    case "set-is-pointer-tracking":
      return { ...state, isPointerTracking: action.value };
    case "set-pointer-drag-preview":
      return { ...state, pointerDragPreview: action.value };
    case "set-drop-target":
      return { ...state, dropTarget: action.value };
    case "clear-pointer-tracking":
      return {
        ...state,
        isPointerTracking: false,
        pointerDragPreview: null,
        dropTarget: null,
      };
    default:
      return state;
  }
}

export function useFolderTreeDrag({
  isOpen,
  canDragFolders,
  draggedFolderId,
  scrollContainerRef,
  onDragStartFolder,
  onDragFolderInsertionChange,
  onDropFolderReorder,
  onDragEnd,
}: UseFolderTreeDragParams): UseFolderTreeDragResult {
  const normalizedDraggedFolderId = draggedFolderId ?? null;
  const [state, dispatch] = useReducer(folderTreeDragReducer, initialFolderTreeDragState);
  const { isPointerTracking, pointerDragPreview } = state;
  const pointerDragRef = useRef<ReturnType<typeof createFolderTreePointerDragSession> | null>(null);
  const { consumeSuppressedHandleClick, queueSuppressHandleClickReset } = useFeedTreeHandleClickSuppression();

  const clearPointerTracking = useCallback(() => {
    pointerDragRef.current = null;
    dispatch({ type: "clear-pointer-tracking" });
  }, []);

  const handlePointerDownFolder = useCallback(
    (folder: FeedTreePresenceFolderViewModel, event: ReactPointerEvent<HTMLElement>) => {
      if (!canDragFolders || event.button !== 0 || folder.isLeaving) {
        return;
      }

      pointerDragRef.current = createFolderTreePointerDragSession(
        folder,
        event.pointerId,
        event.clientX,
        event.clientY,
      );
      dispatch({ type: "set-is-pointer-tracking", value: true });
    },
    [canDragFolders],
  );

  const setPointerDragPreview = useCallback((value: FolderTreeDragOverlayPreview | null) => {
    dispatch({ type: "set-pointer-drag-preview", value });
  }, []);

  const setDropTarget = useCallback((value: FolderReorderDropTarget) => {
    dispatch({ type: "set-drop-target", value });
  }, []);

  useEffect(() => {
    if (!isOpen || !canDragFolders) {
      clearPointerTracking();
    }
  }, [canDragFolders, clearPointerTracking, isOpen]);

  useFolderTreePointerDragEvents({
    isPointerTracking,
    pointerDragRef,
    scrollContainerRef,
    setPointerDragPreview,
    setDropTarget,
    queueSuppressHandleClickReset,
    clearPointerTracking,
    onDragStartFolder,
    onDragFolderInsertionChange,
    onDropFolderReorder,
    onDragEnd,
  });

  return {
    isPointerTracking,
    pointerDragPreview,
    normalizedDraggedFolderId,
    handlePointerDownFolder,
    consumeSuppressedHandleClick,
  };
}
