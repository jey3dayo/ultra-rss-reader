import { useCallback, useMemo } from "react";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { groupFeedsByFolder, sortFeedsByPreference } from "@/lib/sidebar";
import type { FeedTreeFeedViewModel, FeedTreeFolderViewModel } from "./feed-tree.types";
import type { UseSidebarFeedTreeParams, UseSidebarFeedTreeResult } from "./sidebar-feed-tree.types";
import {
  collectFeedIds,
  getVisibleSidebarFeeds,
  getVisibleSidebarFolderFeeds,
  getVisibleSidebarUnfolderedFeeds,
  mapFeedsToFeedTreeViewModels,
} from "./sidebar-feed-tree-helpers";

export function useSidebarFeedTree({
  feeds,
  folders,
  selection,
  viewMode,
  expandedFolderIds,
  sortSubscriptions,
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
    if (sortSubscriptions === "alphabetical") {
      return [...folderList].sort((a, b) => a.name.localeCompare(b.name));
    }
    return folderList;
  }, [folderList, sortSubscriptions]);

  const sortFeeds = useCallback(
    (candidateFeeds: FeedDto[]): FeedDto[] => sortFeedsByPreference(candidateFeeds, sortSubscriptions),
    [sortSubscriptions],
  );

  const unfolderedFeeds = useMemo(() => sortFeeds(rawUnfolderedFeeds), [rawUnfolderedFeeds, sortFeeds]);

  const selectedFeedId = selection.type === "feed" ? selection.feedId : null;
  const selectedFolderId = selection.type === "folder" ? selection.folderId : null;

  const getVisibleFeeds = useCallback(
    (candidateFeeds: FeedDto[]) => getVisibleSidebarFeeds(candidateFeeds, viewMode, sortFeeds),
    [sortFeeds, viewMode],
  );

  const hideEmptyFoldersInCurrentView = viewMode === "unread" && draggedFeedId === null;

  const feedTreeFolders = useMemo<FeedTreeFolderViewModel[]>(
    () =>
      sortedFolderList
        .map((folder) => {
          const rawFolderFeeds = feedsByFolder.get(folder.id) ?? [];
          const folderFeeds = getVisibleSidebarFolderFeeds({
            folderId: folder.id,
            selectedFolderId,
            feedsByFolder,
            getVisibleFeeds,
          });
          const folderUnread = rawFolderFeeds.reduce((sum, feed) => sum + feed.unread_count, 0);
          return {
            id: folder.id,
            name: folder.name,
            accountId: folder.account_id,
            sortOrder: folder.sort_order,
            unreadCount: folderUnread,
            isExpanded: expandedFolderIds.has(folder.id),
            isSelected: selectedFolderId === folder.id,
            feeds: mapFeedsToFeedTreeViewModels(folderFeeds, { selectedFeedId, grayscaleFavicons }),
          };
        })
        .filter((folder) => !hideEmptyFoldersInCurrentView || folder.isSelected || folder.feeds.length > 0),
    [
      expandedFolderIds,
      feedsByFolder,
      getVisibleFeeds,
      grayscaleFavicons,
      hideEmptyFoldersInCurrentView,
      selectedFeedId,
      selectedFolderId,
      sortedFolderList,
    ],
  );

  const unfolderedFeedViews = useMemo<FeedTreeFeedViewModel[]>(
    () =>
      mapFeedsToFeedTreeViewModels(
        getVisibleSidebarUnfolderedFeeds({
          selectedFolderId,
          unfolderedFeeds,
          getVisibleFeeds,
        }),
        {
          selectedFeedId,
          grayscaleFavicons,
        },
      ),
    [getVisibleFeeds, grayscaleFavicons, selectedFeedId, selectedFolderId, unfolderedFeeds],
  );

  const orderedFeedIds = useMemo(() => {
    const ids: string[] = [];

    for (const folder of sortedFolderList) {
      const folderFeeds = getVisibleSidebarFolderFeeds({
        folderId: folder.id,
        selectedFolderId,
        feedsByFolder,
        getVisibleFeeds,
      });
      ids.push(...collectFeedIds(folderFeeds));
    }

    ids.push(
      ...collectFeedIds(
        getVisibleSidebarUnfolderedFeeds({
          selectedFolderId,
          unfolderedFeeds,
          getVisibleFeeds,
        }),
      ),
    );

    return ids;
  }, [feedsByFolder, getVisibleFeeds, selectedFolderId, sortedFolderList, unfolderedFeeds]);

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
