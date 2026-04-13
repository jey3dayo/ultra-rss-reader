import type { FeedDto } from "@/api/tauri-commands";
import type { FeedTreeFeedViewModel } from "./feed-tree.types";
import type {
  SidebarFeedTreeViewMode,
  SidebarFeedTreeViewModelOptions,
  SidebarFolderFeedVisibilityParams,
  SidebarSortFeeds,
  SidebarUnfolderedFeedVisibilityParams,
  SidebarVisibleFeedTreeParams,
  SidebarVisibleFeedTreeResult,
} from "./sidebar-feed-tree.types";

export function getVisibleSidebarFeeds(
  feeds: FeedDto[],
  viewMode: SidebarFeedTreeViewMode,
  sortFeeds: SidebarSortFeeds,
): FeedDto[] {
  const sortedFeeds = sortFeeds(feeds);
  if (viewMode === "unread") {
    return sortedFeeds.filter((feed) => feed.unread_count > 0);
  }
  return sortedFeeds;
}

export function mapFeedsToFeedTreeViewModels(
  feeds: FeedDto[],
  { selectedFeedId, grayscaleFavicons }: SidebarFeedTreeViewModelOptions,
): FeedTreeFeedViewModel[] {
  return feeds.map((feed) => ({
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
  }));
}

export function collectFeedIds(feeds: FeedDto[]): string[] {
  return feeds.map((feed) => feed.id);
}

export function getVisibleSidebarFolderFeeds({
  folderId,
  selectedFolderId,
  feedsByFolder,
  getVisibleFeeds,
}: SidebarFolderFeedVisibilityParams): FeedDto[] {
  if (selectedFolderId !== null && folderId !== selectedFolderId) {
    return [];
  }

  return getVisibleFeeds(feedsByFolder.get(folderId) ?? []);
}

export function getVisibleSidebarUnfolderedFeeds({
  selectedFolderId,
  unfolderedFeeds,
  getVisibleFeeds,
}: SidebarUnfolderedFeedVisibilityParams): FeedDto[] {
  if (selectedFolderId !== null) {
    return [];
  }

  return getVisibleFeeds(unfolderedFeeds);
}

export function getVisibleSidebarFeedTreeData({
  sortedFolderList,
  selectedFolderId,
  feedsByFolder,
  unfolderedFeeds,
  getVisibleFeeds,
}: SidebarVisibleFeedTreeParams): SidebarVisibleFeedTreeResult {
  const visibleFolderFeedsById = new Map(
    sortedFolderList.map((folder) => [
      folder.id,
      getVisibleSidebarFolderFeeds({
        folderId: folder.id,
        selectedFolderId,
        feedsByFolder,
        getVisibleFeeds,
      }),
    ]),
  );

  const visibleUnfolderedFeeds = getVisibleSidebarUnfolderedFeeds({
    selectedFolderId,
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
