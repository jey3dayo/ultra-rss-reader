import type { FeedDto } from "@/api/tauri-commands";
import { sumUnreadCounts } from "@/lib/sidebar";
import type { FeedTreeFeedViewModel, FeedTreeFolderViewModel } from "./feed-tree.types";
import type {
  SidebarFeedTreeFolderBuildParams,
  SidebarFeedTreeViewMode,
  SidebarFeedTreeViewModelOptions,
  SidebarFolderFeedVisibilityParams,
  SidebarSortFeeds,
  SidebarUnfolderedFeedVisibilityParams,
  SidebarVisibleFeedTreeParams,
  SidebarVisibleFeedTreeResult,
} from "./sidebar-feed-tree.types";

const EMPTY_STARRED_COUNT_BY_FEED_ID = new Map<string, number>();

export function getVisibleSidebarFeeds(
  feeds: FeedDto[],
  viewMode: SidebarFeedTreeViewMode,
  sortFeeds: SidebarSortFeeds,
  starredCountByFeedId: ReadonlyMap<string, number> = EMPTY_STARRED_COUNT_BY_FEED_ID,
): FeedDto[] {
  const sortedFeeds = sortFeeds(feeds);
  if (viewMode === "unread") {
    return sortedFeeds.filter((feed) => feed.unread_count > 0);
  }
  if (viewMode === "starred") {
    return sortedFeeds.filter((feed) => (starredCountByFeedId.get(feed.id) ?? 0) > 0);
  }
  return sortedFeeds;
}

export function mapFeedsToFeedTreeViewModels(
  feeds: FeedDto[],
  { selectedFeedId, grayscaleFavicons, viewMode, starredCountByFeedId }: SidebarFeedTreeViewModelOptions,
): FeedTreeFeedViewModel[] {
  return feeds.map((feed) => ({
    id: feed.id,
    accountId: feed.account_id,
    folderId: feed.folder_id,
    title: feed.title,
    url: feed.url,
    siteUrl: feed.site_url,
    unreadCount: viewMode === "starred" ? (starredCountByFeedId.get(feed.id) ?? 0) : feed.unread_count,
    readerMode: feed.reader_mode ?? "inherit",
    webPreviewMode: feed.web_preview_mode ?? "inherit",
    isSelected: selectedFeedId === feed.id,
    grayscaleFavicon: grayscaleFavicons,
  }));
}

export function collectFeedIds(feeds: FeedDto[]): string[] {
  return feeds.map((feed) => feed.id);
}

export function getVisibleSidebarFolderFeeds({
  folderId,
  feedsByFolder,
  getVisibleFeeds,
}: SidebarFolderFeedVisibilityParams): FeedDto[] {
  return getVisibleFeeds(feedsByFolder.get(folderId) ?? []);
}

export function getVisibleSidebarUnfolderedFeeds({
  unfolderedFeeds,
  getVisibleFeeds,
}: SidebarUnfolderedFeedVisibilityParams): FeedDto[] {
  return getVisibleFeeds(unfolderedFeeds);
}

export function getVisibleSidebarFeedTreeData({
  sortedFolderList,
  feedsByFolder,
  unfolderedFeeds,
  getVisibleFeeds,
}: SidebarVisibleFeedTreeParams): SidebarVisibleFeedTreeResult {
  const visibleFolderFeedsById = new Map(
    sortedFolderList.map((folder) => [
      folder.id,
      getVisibleSidebarFolderFeeds({
        folderId: folder.id,
        feedsByFolder,
        getVisibleFeeds,
      }),
    ]),
  );

  const visibleUnfolderedFeeds = getVisibleSidebarUnfolderedFeeds({
    unfolderedFeeds,
    getVisibleFeeds,
  });

  const orderedFeedIds = [
    ...sortedFolderList.flatMap((folder) => collectFeedIds(visibleFolderFeedsById.get(folder.id) ?? [])),
    ...collectFeedIds(visibleUnfolderedFeeds),
  ];

  return {
    visibleFolderFeedsById,
    visibleUnfolderedFeeds,
    orderedFeedIds,
  };
}

export function buildSidebarFeedTreeFolders({
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
}: SidebarFeedTreeFolderBuildParams): FeedTreeFolderViewModel[] {
  return sortedFolderList
    .map((folder) => {
      const rawFolderFeeds = feedsByFolder.get(folder.id) ?? [];
      const folderFeeds = visibleFolderFeedsById.get(folder.id) ?? [];
      return {
        id: folder.id,
        name: folder.name,
        accountId: folder.account_id,
        sortOrder: folder.sort_order,
        unreadCount: viewMode === "starred" ? folderFeeds.length : sumUnreadCounts(rawFolderFeeds),
        isExpanded: expandedFolderIds.has(folder.id),
        isSelected: selectedFolderId === folder.id,
        feeds: mapFeedsToFeedTreeViewModels(folderFeeds, {
          selectedFeedId,
          grayscaleFavicons,
          viewMode,
          starredCountByFeedId,
        }),
      };
    })
    .filter((folder) => !hideEmptyFoldersInCurrentView || folder.isSelected || folder.feeds.length > 0);
}
