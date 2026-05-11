import { useCallback, useEffect, useState } from "react";
import type { SidebarFeedDragStateParams, SidebarFeedDragStateResult } from "../../sidebar-feed-section.types";

type ActiveDropTarget = NonNullable<SidebarFeedDragStateResult["activeDropTarget"]>;

export function useSidebarFeedDragState({
  canDragFeeds,
  isFeedsSectionOpen,
  feedById,
  folderById,
  moveFeedToFolder,
  moveFeedToUnfoldered,
}: SidebarFeedDragStateParams): SidebarFeedDragStateResult {
  const [draggedFeedId, setDraggedFeedId] = useState<string | null>(null);
  const [activeDropTarget, setActiveDropTarget] = useState<ActiveDropTarget | null>(null);

  const clearDragState = useCallback(() => {
    setDraggedFeedId(null);
    setActiveDropTarget(null);
  }, []);

  const canDropFeedToFolder = useCallback(
    (feedId: string, folderId: string) => {
      const draggedFeed = feedById.get(feedId);
      const targetFolder = folderById.get(folderId);
      if (!draggedFeed || draggedFeed.folder_id === folderId) {
        return false;
      }
      if (!targetFolder || targetFolder.account_id !== draggedFeed.account_id) {
        return false;
      }
      return true;
    },
    [feedById, folderById],
  );

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

      if (!canDropFeedToFolder(draggedFeedId, folderId)) {
        setActiveDropTarget(null);
        return;
      }

      setActiveDropTarget({ kind: "folder", folderId });
    },
    [canDropFeedToFolder, draggedFeedId],
  );

  const handleDragEnterUnfoldered = useCallback(() => {
    if (!draggedFeedId) {
      return;
    }

    const draggedFeed = feedById.get(draggedFeedId);
    if (!draggedFeed || draggedFeed.folder_id === null) {
      setActiveDropTarget(null);
      return;
    }

    setActiveDropTarget({ kind: "unfoldered" });
  }, [draggedFeedId, feedById]);

  const handleDropToFolder = useCallback(
    async (folderId: string) => {
      try {
        if (!draggedFeedId) return;
        if (!canDropFeedToFolder(draggedFeedId, folderId)) return;
        await moveFeedToFolder(draggedFeedId, folderId);
      } finally {
        clearDragState();
      }
    },
    [canDropFeedToFolder, clearDragState, draggedFeedId, moveFeedToFolder],
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

  useEffect(() => {
    if (!draggedFeedId || activeDropTarget === null) {
      return;
    }

    if (activeDropTarget.kind === "folder") {
      if (!canDropFeedToFolder(draggedFeedId, activeDropTarget.folderId)) {
        setActiveDropTarget(null);
      }
      return;
    }

    const draggedFeed = feedById.get(draggedFeedId);
    if (!draggedFeed || draggedFeed.folder_id === null) {
      setActiveDropTarget(null);
    }
  }, [activeDropTarget, canDropFeedToFolder, draggedFeedId, feedById]);

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
