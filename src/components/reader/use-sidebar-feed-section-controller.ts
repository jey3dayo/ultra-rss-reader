import { useMemo } from "react";
import type { SidebarFeedSectionParams, SidebarFeedSectionResult } from "./sidebar-feed-section.types";
import { useSidebarFeedDragState } from "./use-sidebar-feed-drag-state";
import { useSidebarFeedNavigation } from "./use-sidebar-feed-navigation";
import { useSidebarFeedTree } from "./use-sidebar-feed-tree";
import { useSidebarFeedTreeProps } from "./use-sidebar-feed-tree-props";
import { useSidebarStartupFolderExpansion } from "./use-sidebar-startup-folder-expansion";
import { useSidebarVisibilityFallback } from "./use-sidebar-visibility-fallback";

export function useSidebarFeedSectionController({
  selectedAccountId,
  feeds,
  folders,
  selection,
  viewMode,
  expandedFolderIds,
  sortSubscriptions,
  grayscaleFavicons,
  isFeedsSectionOpen,
  startupFolderExpansion,
  showSidebarUnread,
  showSidebarStarred,
  showSidebarTags,
  setExpandedFolders,
  selectFeed,
  selectFolder,
  selectAll,
  selectSmartView,
  setViewMode,
  toggleFolder,
  displayFavicons,
  moveFeedToFolder,
  moveFeedToUnfoldered,
  renderFolderContextMenu,
  renderFeedContextMenu,
}: SidebarFeedSectionParams): SidebarFeedSectionResult {
  const feedList = feeds ?? [];
  const folderList = folders ?? [];
  const canDragFeeds = folderList.length > 0;
  const initialFeedById = useMemo(() => new Map(feedList.map((feed) => [feed.id, feed])), [feedList]);

  const {
    draggedFeedId,
    activeDropTarget,
    clearDragState,
    handleDragStartFeed,
    handleDragEnterFolder,
    handleDragEnterUnfoldered,
    handleDropToFolder,
    handleDropToUnfoldered,
  } = useSidebarFeedDragState({
    canDragFeeds,
    isFeedsSectionOpen,
    feedById: initialFeedById,
    moveFeedToFolder,
    moveFeedToUnfoldered,
  });

  const { feedById, selectedFeedId, feedTreeFolders, unfolderedFeedViews, orderedFeedIds } = useSidebarFeedTree({
    feeds,
    folders,
    selection,
    viewMode,
    expandedFolderIds,
    sortSubscriptions,
    grayscaleFavicons,
    draggedFeedId,
  });

  useSidebarStartupFolderExpansion({
    selectedAccountId,
    expandedFolderIds,
    feedList,
    folderList,
    startupFolderExpansion,
    feedsReady: feeds !== undefined,
    foldersReady: folders !== undefined,
    setExpandedFolders,
  });

  const firstFeedId = orderedFeedIds[0] ?? null;

  useSidebarVisibilityFallback({
    firstFeedId,
    selection,
    viewMode,
    showSidebarUnread,
    showSidebarStarred,
    showSidebarTags,
    selectFeed,
    selectAll,
    selectSmartView,
    setViewMode,
  });

  useSidebarFeedNavigation({
    orderedFeedIds,
    selectedFeedId,
    expandedFolderIds,
    getFeedFolderId: (feedId) => feedById.get(feedId)?.folder_id,
    setExpandedFolders,
    selectFeed,
  });

  const feedTreeProps = useSidebarFeedTreeProps({
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
  });

  return {
    feedTreeProps,
  };
}
