import { Result } from "@praha/byethrow";
import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef } from "react";
import { FolderContextMenuContent } from "@/components/reader/folder-context-menu";
import { getFeedLandingFailureMessage } from "@/components/reader/hooks/command-palette/use-command-palette-handlers";
import { useSidebarFeedDragState } from "@/components/reader/hooks/sidebar/use-sidebar-feed-drag-state";
import { useSidebarFeedNavigation } from "@/components/reader/hooks/sidebar/use-sidebar-feed-navigation";
import { useSidebarFeedTree } from "@/components/reader/hooks/sidebar/use-sidebar-feed-tree";
import { useSidebarFeedTreeProps } from "@/components/reader/hooks/sidebar/use-sidebar-feed-tree-props";
import { useSidebarFolderDragState } from "@/components/reader/hooks/sidebar/use-sidebar-folder-drag-state";
import { useSidebarFolderReorderActions } from "@/components/reader/hooks/sidebar/use-sidebar-folder-reorder-actions";
import { useSidebarStartupFolderExpansion } from "@/components/reader/hooks/sidebar/use-sidebar-startup-folder-expansion";
import { useSidebarVisibilityFallback } from "@/components/reader/hooks/sidebar/use-sidebar-visibility-fallback";
import { useMarkFeedRead, useMarkFolderRead } from "@/hooks/use-articles";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import { useFeedLanding } from "@/hooks/use-feed-landing";
import { SIDEBAR_FOLDER_NAVIGATION_TARGET_ATTRIBUTE } from "@/lib/reader-focus";
import {
  FOLDER_REORDER_FOLDER_ID_ATTRIBUTE,
  FOLDER_REORDER_TARGET_ATTRIBUTE,
} from "@/lib/sidebar/folder-tree-drop-target";
import { captureFolderReorderSnapshot, watchFolderReorderAnimation } from "@/lib/sidebar/folder-tree-reorder-animation";
import { resolvePreferenceValue } from "@/schemas/preference-values";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { buildFeedMarkAllReadConfirmation } from "../../feed-mark-all-read";
import type { FeedTreeFolderViewModel } from "../../feed-tree.types";
import type { SidebarFeedSectionParams, SidebarFeedSectionResult } from "../../sidebar-feed-section.types";

export function useSidebarFeedSectionController({
  selectedAccountId,
  folderOrderMode,
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
  renderFeedContextMenu,
  feedTreeScrollContainerRef,
}: SidebarFeedSectionParams): SidebarFeedSectionResult {
  const openFeedLanding = useFeedLanding();
  const showToast = useUiStore((state) => state.showToast);
  const confirmMarkAllRead = useConfirmMarkAllRead();
  const { mutate: markFeedRead } = useMarkFeedRead();
  const { mutate: markFolderRead } = useMarkFolderRead();
  const openFirstArticleOnFeedSelection =
    usePreferencesStore((state) => resolvePreferenceValue(state.prefs, "open_first_article_on_feed_selection")) ===
    "true";
  // Memoised rather than a bare `?? []`: while the queries have no data the literal allocated a
  // new array every render. folderList is the load-bearing one — it is a dependency of the
  // expansion persistence effect, which writes localStorage without comparing content, so the
  // churn made that write run on every render.
  const feedList = useMemo(() => feeds ?? [], [feeds]);
  const folderList = useMemo(() => folders ?? [], [folders]);
  const canDragFeeds = folderList.length > 0;
  const canDragFolders = folderList.length > 1;
  const feedTreeContainerRef = useRef<HTMLElement | null>(null);
  const resolvedFeedTreeScrollContainerRef = feedTreeScrollContainerRef ?? feedTreeContainerRef;
  const visibleOrderedFolderIdsRef = useRef<readonly string[]>([]);
  const reorderToVisibleIndexRef = useRef<(folderId: string, targetVisibleIndex: number) => void>(() => undefined);
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const initialFeedById = useMemo(() => new Map(feedList.map((feed) => [feed.id, feed])), [feedList]);
  const initialFolderById = useMemo(() => new Map(folderList.map((folder) => [folder.id, folder])), [folderList]);
  const isStarredTreeContext = selection.type === "smart" && selection.kind === "starred";
  const feedTreeViewMode = isStarredTreeContext ? "starred" : viewMode;
  // Identifies the logical scope useFeedTreePresence retains rows within:
  // account + the view mode that actually drives which feeds are visible
  // here. Switching either discards any in-flight exit animation from the
  // previous scope immediately, instead of carrying a stale account's
  // leaving row into the next one.
  const feedTreeScopeKey = `${selectedAccountId ?? ""}:${feedTreeViewMode}`;

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
    folderById: initialFolderById,
    moveFeedToFolder,
    moveFeedToUnfoldered,
  });

  const stopFolderReorderWatchRef = useRef<(() => void) | null>(null);
  const watchFolderReorderForAnimation = useCallback(() => {
    stopFolderReorderWatchRef.current?.();
    stopFolderReorderWatchRef.current = null;
    const container = resolvedFeedTreeScrollContainerRef.current;
    const snapshot = captureFolderReorderSnapshot({
      container,
      targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
      idAttribute: FOLDER_REORDER_FOLDER_ID_ATTRIBUTE,
      now: Date.now(),
    });
    if (!snapshot) {
      return;
    }
    const reducedMotion =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;
    stopFolderReorderWatchRef.current = watchFolderReorderAnimation({
      container,
      targetAttribute: FOLDER_REORDER_TARGET_ATTRIBUTE,
      idAttribute: FOLDER_REORDER_FOLDER_ID_ATTRIBUTE,
      snapshot,
      reducedMotion,
    });
  }, [resolvedFeedTreeScrollContainerRef]);
  useEffect(() => () => stopFolderReorderWatchRef.current?.(), []);

  const {
    draggedFolderId,
    folderDragInsertionIndex,
    clearFolderDragState,
    handleDragStartFolder,
    handleDragFolderInsertionChange,
    handleDropFolderReorder,
  } = useSidebarFolderDragState({
    canDragFolders,
    isFeedsSectionOpen,
    visibleOrderedFolderIdsRef,
    onReorderToVisibleIndex: (folderId, targetVisibleIndex) => {
      reorderToVisibleIndexRef.current(folderId, targetVisibleIndex);
    },
    onDropAnimation: watchFolderReorderForAnimation,
  });

  const { feedById, selectedFeedId, feedTreeFolders, unfolderedFeedViews, orderedFeedIds, visibleOrderedFolderIds } =
    useSidebarFeedTree({
      feeds,
      folders,
      selection,
      viewMode: feedTreeViewMode,
      expandedFolderIds,
      sortSubscriptions,
      grayscaleFavicons,
      draggedFeedId,
      draggedFolderId,
      folderOrderMode,
      starredCountByFeedId,
    });

  visibleOrderedFolderIdsRef.current = visibleOrderedFolderIds;

  const {
    liveRegionMessage,
    moveFolderByDirection,
    reorderFolderToVisibleIndex,
    resetFolderOrder,
    resolvedFolderOrderMode,
  } = useSidebarFolderReorderActions({
    accountId: selectedAccountId,
    folderOrderMode,
    folders,
    visibleOrderedFolderIds,
  });

  reorderToVisibleIndexRef.current = reorderFolderToVisibleIndex;

  const renderFolderContextMenu = useCallback(
    (folder: FeedTreeFolderViewModel) => {
      return (
        <FolderContextMenuContent
          folder={{
            id: folder.id,
            account_id: folder.accountId,
            name: folder.name,
            sort_order: folder.sortOrder,
          }}
          folderUnread={folder.unreadCount}
          feeds={folder.feeds.map((feed) => ({
            id: feed.id,
            account_id: feed.accountId,
            folder_id: feed.folderId,
            remote_id: null,
            title: feed.title,
            url: feed.url,
            site_url: feed.siteUrl,
            icon_url: null,
            unread_count: feed.unreadCount,
            reader_mode: feed.readerMode,
            web_preview_mode: feed.webPreviewMode,
          }))}
          folderOrderMode={resolvedFolderOrderMode}
          onResetFolderOrder={resetFolderOrder}
        />
      );
    },
    [resetFolderOrder, resolvedFolderOrderMode],
  );

  const onFolderReorderKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.defaultPrevented || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) {
        return false;
      }

      const target = event.target instanceof Element ? event.target : null;
      const folderTarget = target?.closest<HTMLButtonElement>(`[${SIDEBAR_FOLDER_NAVIGATION_TARGET_ATTRIBUTE}="true"]`);
      if (!folderTarget) {
        return false;
      }

      const usesMacChord = platformKind === "macos" && event.metaKey && event.altKey && !event.shiftKey;
      const usesWindowsChord =
        platformKind !== "macos" && event.altKey && event.shiftKey && !event.metaKey && !event.ctrlKey;
      if (!usesMacChord && !usesWindowsChord) {
        return false;
      }

      const folderId = folderTarget.getAttribute("data-folder-id");
      if (!folderId) {
        return false;
      }

      const moved = moveFolderByDirection(folderId, event.key === "ArrowUp" ? "up" : "down");
      if (!moved) {
        return true;
      }

      event.preventDefault();
      event.stopPropagation();
      return true;
    },
    [moveFolderByDirection, platformKind],
  );

  const handleSelectFeed = useCallback(
    (feedId: string) => {
      if (feedTreeViewMode === "starred") {
        selectFeed(feedId);
        return;
      }

      if (openFirstArticleOnFeedSelection) {
        void openFeedLanding(feedId)
          .then((result) => {
            if (Result.isFailure(result)) {
              showToast(getFeedLandingFailureMessage(Result.unwrapError(result)));
            }
          })
          .catch((error: unknown) => {
            showToast(error instanceof Error ? error.message : "Unknown error");
          });
        return;
      }

      selectFeed(feedId);
    },
    [feedTreeViewMode, openFeedLanding, openFirstArticleOnFeedSelection, selectFeed, showToast],
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
        scope: "folder",
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
    feedsReady: feeds !== undefined,
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
    scopeKey: feedTreeScopeKey,
    feedTreeScrollContainerRef: resolvedFeedTreeScrollContainerRef,
    feedTreeFolders,
    unfolderedFeedViews,
    toggleFolder,
    selectFolder: handleSelectFolder,
    selectFeed: handleSelectFeed,
    markFeedRead: handleMarkFeedRead,
    markFolderRead: handleMarkFolderRead,
    displayFavicons,
    sidebarDensity,
    canDragFeeds: canDragFeeds && draggedFolderId === null,
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
  });

  return {
    feedTreeProps,
    folderReorderKeyboard: {
      liveRegionMessage,
      onFolderReorderKeyDown,
    },
  };
}
