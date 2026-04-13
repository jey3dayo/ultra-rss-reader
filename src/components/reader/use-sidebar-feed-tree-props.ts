import { useCallback } from "react";
import type { FeedTreeViewProps } from "./feed-tree-view";

type UseSidebarFeedTreePropsParams = {
  isFeedsSectionOpen: boolean;
  feedTreeFolders: FeedTreeViewProps["folders"];
  unfolderedFeedViews: FeedTreeViewProps["unfolderedFeeds"];
  toggleFolder: FeedTreeViewProps["onToggleFolder"];
  selectFolder: FeedTreeViewProps["onSelectFolder"];
  selectFeed: FeedTreeViewProps["onSelectFeed"];
  displayFavicons: FeedTreeViewProps["displayFavicons"];
  canDragFeeds: boolean;
  draggedFeedId: FeedTreeViewProps["draggedFeedId"];
  activeDropTarget: FeedTreeViewProps["activeDropTarget"];
  handleDragStartFeed: (feedId: string) => void;
  handleDragEnterFolder: NonNullable<FeedTreeViewProps["onDragEnterFolder"]>;
  handleDragEnterUnfoldered: NonNullable<FeedTreeViewProps["onDragEnterUnfoldered"]>;
  handleDropToFolder: (folderId: string) => Promise<unknown>;
  handleDropToUnfoldered: () => Promise<unknown>;
  clearDragState: NonNullable<FeedTreeViewProps["onDragEnd"]>;
  renderFolderContextMenu?: FeedTreeViewProps["renderFolderContextMenu"];
  renderFeedContextMenu?: FeedTreeViewProps["renderFeedContextMenu"];
};

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
}: UseSidebarFeedTreePropsParams): Omit<FeedTreeViewProps, "emptyState" | "unfolderedLabel"> {
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
