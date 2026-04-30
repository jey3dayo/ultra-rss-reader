import { useCallback, useMemo } from "react";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { groupFeedsByFolder, sortFeedsByPreference } from "@/lib/sidebar";
import type { FeedTreeFeedViewModel, FeedTreeFolderViewModel } from "./feed-tree.types";
import type { UseSidebarFeedTreeParams, UseSidebarFeedTreeResult } from "./sidebar-feed-tree.types";
import {
  buildSidebarFeedTreeFolders,
  getVisibleSidebarFeeds,
  getVisibleSidebarFeedTreeData,
  mapFeedsToFeedTreeViewModels,
} from "./sidebar-feed-tree-helpers";

export function useSidebarFeedTree({
  feeds,
  folders,
  selection,
  viewMode,
  expandedFolderIds,
  sortSubscriptions: _sortSubscriptions,
  grayscaleFavicons,
  draggedFeedId,
}: UseSidebarFeedTreeParams): UseSidebarFeedTreeResult {
  const feedList: FeedDto[] = feeds ?? [];
  const folderList: FolderDto[] = folders ?? [];

  const feedById = useMemo(() => new Map(feedList.map((feed) => [feed.id, feed])), [feedList]);

  const { feedsByFolder, unfolderedFeeds: rawUnfolderedFeeds } = useMemo(
    () => groupFeedsByFolder(feedList),
    [feedList],
  );

  const sortedFolderList = useMemo(() => {
    return [...folderList].sort((a, b) => a.name.localeCompare(b.name));
  }, [folderList]);

  const sortFeeds = useCallback((candidateFeeds: FeedDto[]): FeedDto[] => sortFeedsByPreference(candidateFeeds), []);

  const unfolderedFeeds = useMemo(() => sortFeeds(rawUnfolderedFeeds), [rawUnfolderedFeeds, sortFeeds]);

  const selectedFeedId = selection.type === "feed" ? selection.feedId : null;
  const selectedFolderId = selection.type === "folder" ? selection.folderId : null;

  const getVisibleFeeds = useCallback(
    (candidateFeeds: FeedDto[]) => getVisibleSidebarFeeds(candidateFeeds, viewMode, sortFeeds),
    [sortFeeds, viewMode],
  );

  const { visibleFolderFeedsById, visibleUnfolderedFeeds, orderedFeedIds } = useMemo(
    () =>
      getVisibleSidebarFeedTreeData({
        sortedFolderList,
        feedsByFolder,
        unfolderedFeeds,
        getVisibleFeeds,
      }),
    [feedsByFolder, getVisibleFeeds, sortedFolderList, unfolderedFeeds],
  );

  const hideEmptyFoldersInCurrentView = viewMode === "unread" && draggedFeedId === null;

  const feedTreeFolders = useMemo<FeedTreeFolderViewModel[]>(
    () =>
      buildSidebarFeedTreeFolders({
        sortedFolderList,
        feedsByFolder,
        visibleFolderFeedsById,
        expandedFolderIds,
        selectedFolderId,
        selectedFeedId,
        grayscaleFavicons,
        hideEmptyFoldersInCurrentView,
      }),
    [
      expandedFolderIds,
      feedsByFolder,
      grayscaleFavicons,
      hideEmptyFoldersInCurrentView,
      selectedFeedId,
      selectedFolderId,
      sortedFolderList,
      visibleFolderFeedsById,
    ],
  );

  const unfolderedFeedViews = useMemo<FeedTreeFeedViewModel[]>(
    () =>
      mapFeedsToFeedTreeViewModels(visibleUnfolderedFeeds, {
        selectedFeedId,
        grayscaleFavicons,
      }),
    [grayscaleFavicons, selectedFeedId, visibleUnfolderedFeeds],
  );

  return {
    feedById,
    feedList,
    folderList,
    sortedFolderList,
    selectedFeedId,
    selectedFolderId,
    feedTreeFolders,
    unfolderedFeedViews,
    orderedFeedIds,
  };
}
