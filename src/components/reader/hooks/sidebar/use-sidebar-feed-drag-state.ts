import { useCallback, useEffect, useState } from "react";
import type { SidebarFeedDragStateParams, SidebarFeedDragStateResult } from "../../sidebar-feed-section.types";

export function useSidebarFeedDragState({
  canDragFeeds,
  isFeedsSectionOpen,
  feedById,
  folderById,
  moveFeedToFolder,
  moveFeedToUnfoldered,
}: SidebarFeedDragStateParams): SidebarFeedDragStateResult {
  const [draggedFeedId, setDraggedFeedId] = useState<string | null>(null);
  const [activeDropTarget, setActiveDropTarget] = useState<SidebarFeedDragStateResult["activeDropTarget"]>(null);

  const clearDragState = useCallback(() => {
    setDraggedFeedId(null);
    setActiveDropTarget(null);
  }, []);

  const handleDragStartFeed = useCallback(
    (feedId: string) => {
      if (!canDragFeeds || !isFeedsSectionOpen || !feedById.has(feedId)) {
        return;
      }

      setDraggedFeedId(feedId);
    },
    [canDragFeeds, feedById, isFeedsSectionOpen],
  );

  const handleDragEnterFolder = useCallback(
    (folderId: string) => {
      if (!draggedFeedId) {
        return;
      }

      setActiveDropTarget({ kind: "folder", folderId });
    },
    [draggedFeedId],
  );

  const handleDragEnterUnfoldered = useCallback(() => {
    if (!draggedFeedId) {
      return;
    }

    setActiveDropTarget({ kind: "unfoldered" });
  }, [draggedFeedId]);

  const handleDropToFolder = useCallback(
    async (folderId: string) => {
      try {
        if (!draggedFeedId) return;
        const draggedFeed = feedById.get(draggedFeedId);
        const targetFolder = folderById.get(folderId);
        if (!draggedFeed || draggedFeed.folder_id === folderId) return;
        if (!targetFolder || targetFolder.account_id !== draggedFeed.account_id) return;
        await moveFeedToFolder(draggedFeedId, folderId);
      } finally {
        clearDragState();
      }
    },
    [clearDragState, draggedFeedId, feedById, folderById, moveFeedToFolder],
  );

  const handleDropToUnfoldered = useCallback(async () => {
    try {
      if (!draggedFeedId) return;
      const draggedFeed = feedById.get(draggedFeedId);
      if (!draggedFeed || draggedFeed.folder_id === null) return;
      await moveFeedToUnfoldered(draggedFeedId);
    } finally {
      clearDragState();
    }
  }, [clearDragState, draggedFeedId, feedById, moveFeedToUnfoldered]);

  useEffect(() => {
    if (!draggedFeedId) {
      return;
    }

    if (!isFeedsSectionOpen || !canDragFeeds || !feedById.has(draggedFeedId)) {
      clearDragState();
    }
  }, [canDragFeeds, clearDragState, draggedFeedId, feedById, isFeedsSectionOpen]);

  return {
    draggedFeedId,
    activeDropTarget,
    clearDragState,
    handleDragStartFeed,
    handleDragEnterFolder,
    handleDragEnterUnfoldered,
    handleDropToFolder,
    handleDropToUnfoldered,
  };
}
