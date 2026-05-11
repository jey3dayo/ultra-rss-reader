import { useCallback, useMemo } from "react";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { groupFeedsByFolder } from "@/lib/sidebar/sidebar";
import {
  buildSidebarFeedTreeFolders,
  getVisibleSidebarFeeds,
  getVisibleSidebarFeedTreeData,
  mapFeedsToFeedTreeViewModels,
  sortSidebarSubscriptionFeeds,
} from "@/lib/sidebar/sidebar-feed-tree";
import type { FeedTreeFeedViewModel, FeedTreeFolderViewModel } from "../../feed-tree.types";
import type { UseSidebarFeedTreeParams, UseSidebarFeedTreeResult } from "../../sidebar-feed-tree.types";

const EMPTY_STARRED_COUNT_BY_FEED_ID = new Map<string, number>();

export function useSidebarFeedTree({
  feeds,
  folders,
  selection,
  viewMode,
  expandedFolderIds,
  sortSubscriptions,
  grayscaleFavicons,
  draggedFeedId,
  starredCountByFeedId = EMPTY_STARRED_COUNT_BY_FEED_ID,
}: UseSidebarFeedTreeParams): UseSidebarFeedTreeResult {
  const feedList: FeedDto[] = feeds ?? [];
  const folderList: FolderDto[] = folders ?? [];

  const feedById = useMemo(() => new Map(feedList.map((feed) => [feed.id, feed])), [feedList]);

  const { feedsByFolder, unfolderedFeeds: rawUnfolderedFeeds } = useMemo(
    () => groupFeedsByFolder(feedList),
    [feedList],
  );

  const sortedFolderList = useMemo(() => {
    const sortedFolders = folderList.slice();
    sortedFolders.sort((a, b) => a.name.localeCompare(b.name));
    return sortedFolders;
  }, [folderList]);

  const sortFeeds = useCallback(
    (candidateFeeds: FeedDto[]): FeedDto[] => sortSidebarSubscriptionFeeds(candidateFeeds, sortSubscriptions),
    [sortSubscriptions],
  );

  const unfolderedFeeds = useMemo(() => sortFeeds(rawUnfolderedFeeds), [rawUnfolderedFeeds, sortFeeds]);

  const selectedFeedId = selection.type === "feed" ? selection.feedId : null;
  const selectedFolderId = selection.type === "folder" ? selection.folderId : null;

  const getVisibleFeeds = useCallback(
    (candidateFeeds: FeedDto[]) => getVisibleSidebarFeeds(candidateFeeds, viewMode, sortFeeds, starredCountByFeedId),
    [sortFeeds, starredCountByFeedId, viewMode],
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

  const hideEmptyFoldersInCurrentView = viewMode !== "all" && draggedFeedId === null;

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
        viewMode,
        starredCountByFeedId,
        hideEmptyFoldersInCurrentView,
      }),
    [
      expandedFolderIds,
      feedsByFolder,
      grayscaleFavicons,
      hideEmptyFoldersInCurrentView,
      selectedFeedId,
      selectedFolderId,
      starredCountByFeedId,
      sortedFolderList,
      visibleFolderFeedsById,
      viewMode,
    ],
  );

  const unfolderedFeedViews = useMemo<FeedTreeFeedViewModel[]>(
    () =>
      mapFeedsToFeedTreeViewModels(visibleUnfolderedFeeds, {
        selectedFeedId,
        grayscaleFavicons,
        viewMode,
        starredCountByFeedId,
      }),
    [grayscaleFavicons, selectedFeedId, starredCountByFeedId, viewMode, visibleUnfolderedFeeds],
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
