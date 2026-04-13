import { useCallback, useMemo } from "react";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import type { FeedTreeViewProps } from "./feed-tree-view";
import { useSidebarFeedDragState } from "./use-sidebar-feed-drag-state";
import { useSidebarFeedNavigation } from "./use-sidebar-feed-navigation";
import { useSidebarFeedTree } from "./use-sidebar-feed-tree";
import { useSidebarStartupFolderExpansion } from "./use-sidebar-startup-folder-expansion";
import { useSidebarVisibilityFallback } from "./use-sidebar-visibility-fallback";

type UseSidebarFeedSectionControllerParams = {
  selectedAccountId: string | null;
  feeds: FeedDto[] | undefined;
  folders: FolderDto[] | undefined;
  selection: Parameters<typeof useSidebarFeedTree>[0]["selection"];
  viewMode: Parameters<typeof useSidebarFeedTree>[0]["viewMode"];
  expandedFolderIds: Set<string>;
  sortSubscriptions: string;
  grayscaleFavicons: boolean;
  isFeedsSectionOpen: boolean;
  startupFolderExpansion: Parameters<typeof useSidebarStartupFolderExpansion>[0]["startupFolderExpansion"];
  showSidebarUnread: boolean;
  showSidebarStarred: boolean;
  showSidebarTags: boolean;
  setExpandedFolders: Parameters<typeof useSidebarStartupFolderExpansion>[0]["setExpandedFolders"];
  selectFeed: (feedId: string) => void;
  selectFolder: (folderId: string) => void;
  selectAll: () => void;
  selectSmartView: (kind: "unread" | "starred") => void;
  setViewMode: (mode: "all" | "unread" | "starred") => void;
  toggleFolder: (folderId: string) => void;
  displayFavicons: boolean;
  moveFeedToFolder: (feedId: string, folderId: string) => Promise<unknown>;
  moveFeedToUnfoldered: (feedId: string) => Promise<unknown>;
  renderFolderContextMenu?: FeedTreeViewProps["renderFolderContextMenu"];
  renderFeedContextMenu?: FeedTreeViewProps["renderFeedContextMenu"];
};

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
}: UseSidebarFeedSectionControllerParams) {
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
    feedTreeProps: {
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
      onDragStartFeed: (feed: { id: string }) => handleDragStartFeed(feed.id),
      onDragEnterFolder: handleDragEnterFolder,
      onDragEnterUnfoldered: handleDragEnterUnfoldered,
      onDropToFolder: handleDropToFolderRequest,
      onDropToUnfoldered: handleDropToUnfolderedRequest,
      onDragEnd: clearDragState,
      renderFolderContextMenu,
      renderFeedContextMenu,
    } satisfies Omit<FeedTreeViewProps, "emptyState" | "unfolderedLabel">,
  };
}
