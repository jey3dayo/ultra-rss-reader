import { type RefObject, useCallback, useEffect, useState } from "react";

type UseSidebarFolderDragStateParams = {
  canDragFolders: boolean;
  isFeedsSectionOpen: boolean;
  visibleOrderedFolderIdsRef: RefObject<readonly string[]>;
  onReorderToVisibleIndex: (folderId: string, targetVisibleIndex: number) => void;
  onDropAnimation?: () => void;
};

export function useSidebarFolderDragState({
  canDragFolders,
  isFeedsSectionOpen,
  visibleOrderedFolderIdsRef,
  onReorderToVisibleIndex,
  onDropAnimation,
}: UseSidebarFolderDragStateParams) {
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [folderDragInsertionIndex, setFolderDragInsertionIndex] = useState<number | null>(null);

  const clearFolderDragState = useCallback(() => {
    setDraggedFolderId(null);
    setFolderDragInsertionIndex(null);
  }, []);

  const handleDragStartFolder = useCallback(
    (folderId: string) => {
      if (!canDragFolders || !isFeedsSectionOpen) {
        return;
      }
      setDraggedFolderId(folderId);
    },
    [canDragFolders, isFeedsSectionOpen],
  );

  const handleDragFolderInsertionChange = useCallback((insertionIndex: number | null) => {
    setFolderDragInsertionIndex(insertionIndex);
  }, []);

  const handleDropFolderReorder = useCallback(
    (folderId: string, insertionIndex: number) => {
      const visibleOrderedFolderIds = visibleOrderedFolderIdsRef.current ?? [];
      const currentIndex = visibleOrderedFolderIds.indexOf(folderId);
      const targetVisibleIndex = insertionIndex;

      if (currentIndex === targetVisibleIndex || (currentIndex >= 0 && insertionIndex === currentIndex + 1)) {
        clearFolderDragState();
        return;
      }

      onReorderToVisibleIndex(folderId, Math.max(0, targetVisibleIndex));
      onDropAnimation?.();
      clearFolderDragState();
    },
    [clearFolderDragState, onDropAnimation, onReorderToVisibleIndex, visibleOrderedFolderIdsRef],
  );

  useEffect(() => {
    if (!draggedFolderId) {
      return;
    }

    const visibleOrderedFolderIds = visibleOrderedFolderIdsRef.current ?? [];
    if (!isFeedsSectionOpen || !canDragFolders || !visibleOrderedFolderIds.includes(draggedFolderId)) {
      clearFolderDragState();
    }
  }, [canDragFolders, clearFolderDragState, draggedFolderId, isFeedsSectionOpen, visibleOrderedFolderIdsRef]);

  return {
    draggedFolderId,
    folderDragInsertionIndex,
    clearFolderDragState,
    handleDragStartFolder,
    handleDragFolderInsertionChange,
    handleDropFolderReorder,
  };
}
