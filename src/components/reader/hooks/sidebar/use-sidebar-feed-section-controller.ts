import { useCallback, useMemo } from "react";
import { useSidebarFeedDragState } from "@/components/reader/hooks/sidebar/use-sidebar-feed-drag-state";
import { useSidebarFeedNavigation } from "@/components/reader/hooks/sidebar/use-sidebar-feed-navigation";
import { useSidebarFeedTree } from "@/components/reader/hooks/sidebar/use-sidebar-feed-tree";
import { useSidebarFeedTreeProps } from "@/components/reader/hooks/sidebar/use-sidebar-feed-tree-props";
import { useSidebarStartupFolderExpansion } from "@/components/reader/hooks/sidebar/use-sidebar-startup-folder-expansion";
import { useSidebarVisibilityFallback } from "@/components/reader/hooks/sidebar/use-sidebar-visibility-fallback";
import { useMarkFeedRead, useMarkFolderRead } from "@/hooks/use-articles";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import { useFeedLanding } from "@/hooks/use-feed-landing";
import { resolvePreferenceValue } from "@/schemas/preferences";
import { usePreferencesStore } from "@/stores/preferences-store";
import { buildFeedMarkAllReadConfirmation } from "../../feed-mark-all-read";
import type { SidebarFeedSectionParams, SidebarFeedSectionResult } from "../../sidebar-feed-section.types";

export function useSidebarFeedSectionController({
  selectedAccountId,
  feeds,
  folders,
  starredCountByFeedId,
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
  showSidebarRecentArticles,
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
  const { mutate: markFolderRead } = useMarkFolderRead();
  const openFirstArticleOnFeedSelection =
    usePreferencesStore((state) => resolvePreferenceValue(state.prefs, "open_first_article_on_feed_selection")) ===
    "true";
  const feedList = feeds ?? [];
  const folderList = folders ?? [];
  const canDragFeeds = folderList.length > 0;
  const initialFeedById = useMemo(() => new Map(feedList.map((feed) => [feed.id, feed])), [feedList]);
  const isStarredTreeContext = selection.type === "smart" && selection.kind === "starred";
  const feedTreeViewMode = isStarredTreeContext ? "starred" : viewMode;

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
    viewMode: feedTreeViewMode,
    expandedFolderIds,
    sortSubscriptions,
    grayscaleFavicons,
    draggedFeedId,
    starredCountByFeedId,
  });

  const handleSelectFeed = useCallback(
    (feedId: string) => {
      if (feedTreeViewMode === "starred") {
        selectFeed(feedId);
        return;
      }

      if (openFirstArticleOnFeedSelection) {
        void openFeedLanding(feedId);
        return;
      }

      selectFeed(feedId);
    },
    [feedTreeViewMode, openFeedLanding, openFirstArticleOnFeedSelection, selectFeed],
  );
  const handleSelectFolder = useCallback(
    (folderId: string) => {
      selectFolder(folderId);
    },
    [selectFolder],
  );
  const handleMarkFeedRead = useCallback(
    (feed: { id: string; unreadCount: number }) => {
      confirmMarkAllRead(
        buildFeedMarkAllReadConfirmation({
          feedId: feed.id,
          unreadCount: feed.unreadCount,
          onConfirmRead: markFeedRead,
        }),
      );
    },
    [confirmMarkAllRead, markFeedRead],
  );
  const handleMarkFolderRead = useCallback(
    (folder: { id: string; unreadCount: number }) => {
      confirmMarkAllRead({
        count: folder.unreadCount,
        onConfirm: () => markFolderRead(folder.id),
      });
    },
    [confirmMarkAllRead, markFolderRead],
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
    showSidebarRecentArticles,
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
    selectFolder: handleSelectFolder,
    selectFeed: handleSelectFeed,
    markFeedRead: handleMarkFeedRead,
    markFolderRead: handleMarkFolderRead,
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
