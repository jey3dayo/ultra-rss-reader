import { useCallback, useMemo } from "react";
import { useMarkFeedRead } from "@/hooks/use-articles";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import { useFeedLanding } from "@/hooks/use-feed-landing";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
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
  sidebarDensity,
  showSidebarUnread,
  showSidebarStarred,
  showSidebarTags,
  tags,
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
  const openFeedLanding = useFeedLanding();
  const confirmMarkAllRead = useConfirmMarkAllRead();
  const { mutate: markFeedRead } = useMarkFeedRead();
  const openFirstArticleOnFeedSelection =
    usePreferencesStore((state) => resolvePreferenceValue(state.prefs, "open_first_article_on_feed_selection")) ===
    "true";
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

  const handleSelectFeed = useCallback(
    (feedId: string) => {
      if (openFirstArticleOnFeedSelection) {
        void openFeedLanding(feedId);
        return;
      }

      selectFeed(feedId);
    },
    [openFeedLanding, openFirstArticleOnFeedSelection, selectFeed],
  );
  const handleMarkFeedRead = useCallback(
    (feed: { id: string; unreadCount: number }) => {
      confirmMarkAllRead({
        count: feed.unreadCount,
        onConfirm: () => markFeedRead(feed.id),
      });
    },
    [confirmMarkAllRead, markFeedRead],
  );

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
    tags,
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
    selectFeed: handleSelectFeed,
  });

  const feedTreeProps = useSidebarFeedTreeProps({
    isFeedsSectionOpen,
    feedTreeFolders,
    unfolderedFeedViews,
    toggleFolder,
    selectFolder,
    selectFeed: handleSelectFeed,
    markFeedRead: handleMarkFeedRead,
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
  });

  return {
    feedTreeProps,
  };
}
