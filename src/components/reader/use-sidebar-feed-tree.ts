import { useCallback, useMemo } from "react";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { groupFeedsByFolder, sortFeedsByPreference } from "@/lib/sidebar";
import type { FeedTreeFeedViewModel, FeedTreeFolderViewModel } from "./feed-tree-view";
import type { UseSidebarFeedTreeParams, UseSidebarFeedTreeResult } from "./sidebar-feed-tree.types";

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

  const filterFolderFeedsForSidebar = useCallback(
    (folderFeeds: FeedDto[]) => {
      const sortedFeeds = sortFeeds(folderFeeds);
      if (viewMode === "unread") {
        return sortedFeeds.filter((feed) => feed.unread_count > 0);
      }
      return sortedFeeds;
    },
    [sortFeeds, viewMode],
  );

  const hideEmptyFoldersInCurrentView = viewMode === "unread" && draggedFeedId === null;

  const feedTreeFolders = useMemo<FeedTreeFolderViewModel[]>(
    () =>
      sortedFolderList
        .map((folder) => {
          const rawFolderFeeds = sortFeeds(feedsByFolder.get(folder.id) ?? []);
          const folderFeeds =
            selectedFolderId !== null && folder.id !== selectedFolderId
              ? []
              : filterFolderFeedsForSidebar(rawFolderFeeds);
          const folderUnread = rawFolderFeeds.reduce((sum, feed) => sum + feed.unread_count, 0);
          return {
            id: folder.id,
            name: folder.name,
            accountId: folder.account_id,
            sortOrder: folder.sort_order,
            unreadCount: folderUnread,
            isExpanded: expandedFolderIds.has(folder.id),
            isSelected: selectedFolderId === folder.id,
            feeds: folderFeeds.map((feed) => ({
              id: feed.id,
              accountId: feed.account_id,
              folderId: feed.folder_id,
              title: feed.title,
              url: feed.url,
              siteUrl: feed.site_url,
              unreadCount: feed.unread_count,
              readerMode: feed.reader_mode ?? "inherit",
              webPreviewMode: feed.web_preview_mode ?? "inherit",
              isSelected: selectedFeedId === feed.id,
              grayscaleFavicon: grayscaleFavicons,
            })),
          };
        })
        .filter((folder) => !hideEmptyFoldersInCurrentView || folder.isSelected || folder.feeds.length > 0),
    [
      expandedFolderIds,
      feedsByFolder,
      filterFolderFeedsForSidebar,
      grayscaleFavicons,
      hideEmptyFoldersInCurrentView,
      selectedFeedId,
      selectedFolderId,
      sortFeeds,
      sortedFolderList,
    ],
  );

  const unfolderedFeedViews = useMemo<FeedTreeFeedViewModel[]>(
    () =>
      (selectedFolderId === null ? filterFolderFeedsForSidebar(unfolderedFeeds) : []).map((feed) => ({
        id: feed.id,
        accountId: feed.account_id,
        folderId: feed.folder_id,
        title: feed.title,
        url: feed.url,
        siteUrl: feed.site_url,
        unreadCount: feed.unread_count,
        readerMode: feed.reader_mode ?? "inherit",
        webPreviewMode: feed.web_preview_mode ?? "inherit",
        isSelected: selectedFeedId === feed.id,
        grayscaleFavicon: grayscaleFavicons,
      })),
    [filterFolderFeedsForSidebar, grayscaleFavicons, selectedFeedId, selectedFolderId, unfolderedFeeds],
  );

  const orderedFeedIds = useMemo(() => {
    const ids: string[] = [];

    for (const folder of sortedFolderList) {
      const rawFolderFeeds = sortFeeds(feedsByFolder.get(folder.id) ?? []);
      const folderFeeds =
        selectedFolderId !== null && folder.id !== selectedFolderId ? [] : filterFolderFeedsForSidebar(rawFolderFeeds);
      for (const feed of folderFeeds) {
        ids.push(feed.id);
      }
    }

    for (const feed of selectedFolderId === null ? filterFolderFeedsForSidebar(unfolderedFeeds) : []) {
      ids.push(feed.id);
    }

    return ids;
  }, [filterFolderFeedsForSidebar, feedsByFolder, selectedFolderId, sortFeeds, sortedFolderList, unfolderedFeeds]);

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
