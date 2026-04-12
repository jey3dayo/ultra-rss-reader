import { useCallback, useEffect, useState } from "react";
import type { ActiveDropTarget } from "./feed-tree-view";

type FeedDragStateFeed = {
  folder_id: string | null;
};

type UseSidebarFeedDragStateParams = {
  canDragFeeds: boolean;
  isFeedsSectionOpen: boolean;
  feedById: Map<string, FeedDragStateFeed>;
  moveFeedToFolder: (feedId: string, folderId: string) => Promise<unknown>;
  moveFeedToUnfoldered: (feedId: string) => Promise<unknown>;
};

export function useSidebarFeedDragState({
  canDragFeeds,
  isFeedsSectionOpen,
  feedById,
  moveFeedToFolder,
  moveFeedToUnfoldered,
}: UseSidebarFeedDragStateParams) {
  const [draggedFeedId, setDraggedFeedId] = useState<string | null>(null);
  const [activeDropTarget, setActiveDropTarget] = useState<ActiveDropTarget>(null);

  const clearDragState = useCallback(() => {
    setDraggedFeedId(null);
    setActiveDropTarget(null);
  }, []);

  const handleDragStartFeed = useCallback((feedId: string) => {
    setDraggedFeedId(feedId);
  }, []);

  const handleDragEnterFolder = useCallback((folderId: string) => {
    setActiveDropTarget({ kind: "folder", folderId });
  }, []);

  const handleDragEnterUnfoldered = useCallback(() => {
    setActiveDropTarget({ kind: "unfoldered" });
  }, []);

  const handleDropToFolder = useCallback(
    async (folderId: string) => {
      try {
        if (!draggedFeedId) return;
        const draggedFeed = feedById.get(draggedFeedId);
        if (!draggedFeed || draggedFeed.folder_id === folderId) return;
        await moveFeedToFolder(draggedFeedId, folderId);
      } finally {
        clearDragState();
      }
    },
    [clearDragState, draggedFeedId, feedById, moveFeedToFolder],
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
