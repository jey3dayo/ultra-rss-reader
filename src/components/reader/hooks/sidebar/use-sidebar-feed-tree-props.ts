import { useCallback } from "react";
import type { SidebarFeedTreeProps, SidebarFeedTreePropsParams } from "../../sidebar-feed-section.types";

export function useSidebarFeedTreeProps({
  isFeedsSectionOpen,
  feedTreeFolders,
  unfolderedFeedViews,
  toggleFolder,
  selectFolder,
  selectFeed,
  markFeedRead,
  markFolderRead,
  displayFavicons,
  sidebarDensity,
  canDragFeeds,
  draggedFeedId,
  activeDropTarget,
  handleDragStartFeed,
  handleDragEnterFolder,
  handleDragEnterUnfoldered,
  handleDropToFolder,
  handleDropToUnfoldered,
  clearDragState,
  renderFolderContextMenu,
  renderFeedContextMenu,
}: SidebarFeedTreePropsParams): SidebarFeedTreeProps {
  const handleDropToFolderRequest = useCallback(
    (folderId: string) => {
      void handleDropToFolder(folderId).catch((error: unknown) => {
        console.error("Failed to move feed to folder:", error);
      });
    },
    [handleDropToFolder],
  );

  const handleDropToUnfolderedRequest = useCallback(() => {
    void handleDropToUnfoldered().catch((error: unknown) => {
      console.error("Failed to move feed to unfoldered:", error);
    });
  }, [handleDropToUnfoldered]);

  return {
    isOpen: isFeedsSectionOpen,
    sidebarDensity,
    folders: feedTreeFolders,
    unfolderedFeeds: unfolderedFeedViews,
    onToggleFolder: toggleFolder,
    onSelectFolder: selectFolder,
    onSelectFeed: selectFeed,
    onMarkFeedRead: markFeedRead,
    onMarkFolderRead: markFolderRead,
    displayFavicons,
    canDragFeeds,
    draggedFeedId,
    activeDropTarget,
    onDragStartFeed: (feed) => handleDragStartFeed(feed.id),
    onDragEnterFolder: handleDragEnterFolder,
    onDragEnterUnfoldered: handleDragEnterUnfoldered,
    onDropToFolder: handleDropToFolderRequest,
    onDropToUnfoldered: handleDropToUnfolderedRequest,
    onDragEnd: clearDragState,
    renderFolderContextMenu,
    renderFeedContextMenu,
  };
}
