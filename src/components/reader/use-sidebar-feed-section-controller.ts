import { Result } from "@praha/byethrow";
import { useCallback, useMemo } from "react";
import { openInBrowser } from "@/api/tauri-commands";
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
  const handleOpenFeedSite = useCallback((feed: { siteUrl: string; url: string }) => {
    const url = feed.siteUrl || feed.url;
    if (!url) {
      return;
    }

    const background = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
    openInBrowser(url, background).then((result) =>
      Result.pipe(
        result,
        Result.inspectError((error) => console.error("Failed to open site:", error)),
      ),
    );
  }, []);
  const handleSelectFolder = useCallback(
    (folderId: string) => {
      selectFolder(folderId);
    },
    [selectFolder],
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
    openFeedSite: handleOpenFeedSite,
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
