import { useCallback } from "react";
import type { SidebarFeedTreeProps, SidebarFeedTreePropsParams } from "../../sidebar-feed-section.types";

export function useSidebarFeedTreeProps({
  isFeedsSectionOpen,
  scopeKey,
  feedTreeScrollContainerRef,
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
  canDragFolders,
  draggedFeedId,
  draggedFolderId,
  folderDragInsertionIndex,
  activeDropTarget,
  handleDragStartFeed,
  handleDragEnterFolder,
  handleDragEnterUnfoldered,
  handleDropToFolder,
  handleDropToUnfoldered,
  clearDragState,
  clearFolderDragState,
  handleDragStartFolder,
  handleDragFolderInsertionChange,
  handleDropFolderReorder,
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

  const handleDragEnd = useCallback(() => {
    clearDragState();
    clearFolderDragState();
  }, [clearDragState, clearFolderDragState]);

  return {
    isOpen: isFeedsSectionOpen,
    scopeKey,
    sidebarDensity,
    feedTreeScrollContainerRef,
    folders: feedTreeFolders,
    unfolderedFeeds: unfolderedFeedViews,
    onToggleFolder: toggleFolder,
    onSelectFolder: selectFolder,
    onSelectFeed: selectFeed,
    onMarkFeedRead: markFeedRead,
    onMarkFolderRead: markFolderRead,
    displayFavicons,
    canDragFeeds,
    canDragFolders,
    draggedFeedId,
    draggedFolderId,
    folderDragInsertionIndex,
    activeDropTarget,
    onDragStartFeed: (feed) => handleDragStartFeed(feed.id),
    onDragStartFolder: (folder) => handleDragStartFolder(folder.id),
    onDragFolderInsertionChange: handleDragFolderInsertionChange,
    onDropFolderReorder: handleDropFolderReorder,
    onDragEnterFolder: handleDragEnterFolder,
    onDragEnterUnfoldered: handleDragEnterUnfoldered,
    onDropToFolder: handleDropToFolderRequest,
    onDropToUnfoldered: handleDropToUnfolderedRequest,
    onDragEnd: handleDragEnd,
    renderFolderContextMenu,
    renderFeedContextMenu,
  };
}
