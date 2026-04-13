import { useCallback } from "react";
import type { SidebarFeedTreeProps, SidebarFeedTreePropsParams } from "./sidebar-feed-section.types";

export function useSidebarFeedTreeProps({
  isFeedsSectionOpen,
  feedTreeFolders,
  unfolderedFeedViews,
  toggleFolder,
  selectFolder,
  selectFeed,
  displayFavicons,
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
      void handleDropToFolder(folderId);
    },
    [handleDropToFolder],
  );

  const handleDropToUnfolderedRequest = useCallback(() => {
    void handleDropToUnfoldered();
  }, [handleDropToUnfoldered]);

  return {
    isOpen: isFeedsSectionOpen,
    folders: feedTreeFolders,
    unfolderedFeeds: unfolderedFeedViews,
    onToggleFolder: toggleFolder,
    onSelectFolder: selectFolder,
    onSelectFeed: selectFeed,
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
