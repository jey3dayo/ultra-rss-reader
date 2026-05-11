import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import type { TriStateDisplayMode } from "@/lib/articles/article-display";
import type { ViewMode } from "@/lib/reader/view-mode.types";
import type { SortSubscriptions } from "@/schemas/preferences";
import { sortFeedsByPreference, sumUnreadCounts } from "./sidebar";

export type FeedTreeFeedViewModel = {
  id: string;
  accountId: string;
  folderId: string | null;
  title: string;
  url: string;
  siteUrl: string;
  unreadCount: number;
  readerMode: TriStateDisplayMode;
  webPreviewMode: TriStateDisplayMode;
  isSelected: boolean;
  grayscaleFavicon: boolean;
};

export type FeedTreeFolderViewModel = {
  id: string;
  name: string;
  accountId: string;
  sortOrder: number;
  unreadCount: number;
  isExpanded: boolean;
  isSelected: boolean;
  feeds: FeedTreeFeedViewModel[];
};

export type SidebarFeedTreeViewMode = ViewMode;

export type SidebarSortFeeds = (candidateFeeds: FeedDto[]) => FeedDto[];

export type SidebarFeedTreeViewModelOptions = {
  selectedFeedId: string | null;
  grayscaleFavicons: boolean;
  viewMode: SidebarFeedTreeViewMode;
  starredCountByFeedId: ReadonlyMap<string, number>;
};

export type SidebarFolderFeedVisibilityParams = {
  folderId: string;
  feedsByFolder: Map<string, FeedDto[]>;
  getVisibleFeeds: SidebarSortFeeds;
};

export type SidebarUnfolderedFeedVisibilityParams = {
  unfolderedFeeds: FeedDto[];
  getVisibleFeeds: SidebarSortFeeds;
};

export type SidebarVisibleFeedTreeParams = {
  sortedFolderList: FolderDto[];
  feedsByFolder: Map<string, FeedDto[]>;
  unfolderedFeeds: FeedDto[];
  getVisibleFeeds: SidebarSortFeeds;
};

export type SidebarVisibleFeedTreeResult = {
  visibleFolderFeedsById: Map<string, FeedDto[]>;
  visibleUnfolderedFeeds: FeedDto[];
  orderedFeedIds: string[];
};

export type SidebarFeedTreeFolderBuildParams = {
  sortedFolderList: FolderDto[];
  feedsByFolder: Map<string, FeedDto[]>;
  visibleFolderFeedsById: Map<string, FeedDto[]>;
  expandedFolderIds: ReadonlySet<string>;
  selectedFolderId: string | null;
  selectedFeedId: string | null;
  grayscaleFavicons: boolean;
  viewMode: SidebarFeedTreeViewMode;
  starredCountByFeedId: ReadonlyMap<string, number>;
  hideEmptyFoldersInCurrentView: boolean;
};

const EMPTY_STARRED_COUNT_BY_FEED_ID = new Map<string, number>();

export function sortSidebarSubscriptionFeeds(feeds: FeedDto[], sortSubscriptions: SortSubscriptions): FeedDto[] {
  if (sortSubscriptions === "newest_first") {
    return [...feeds];
  }

  if (sortSubscriptions === "oldest_first") {
    return [...feeds].reverse();
  }

  return sortFeedsByPreference(feeds, "alphabetical");
}

function buildVisibleSidebarFeedTreeFolder(
  folder: SidebarFeedTreeFolderBuildParams["sortedFolderList"][number],
  {
    feedsByFolder,
    visibleFolderFeedsById,
    expandedFolderIds,
    selectedFolderId,
    selectedFeedId,
    grayscaleFavicons,
    viewMode,
    starredCountByFeedId,
    hideEmptyFoldersInCurrentView,
  }: Omit<SidebarFeedTreeFolderBuildParams, "sortedFolderList">,
): FeedTreeFolderViewModel | null {
  const rawFolderFeeds = feedsByFolder.get(folder.id) ?? [];
  const folderFeeds = visibleFolderFeedsById.get(folder.id) ?? [];
  const isSelected = selectedFolderId === folder.id;

  if (hideEmptyFoldersInCurrentView && !isSelected && folderFeeds.length === 0) {
    return null;
  }

  return {
    id: folder.id,
    name: folder.name,
    accountId: folder.account_id,
    sortOrder: folder.sort_order,
    unreadCount: viewMode === "starred" ? folderFeeds.length : sumUnreadCounts(rawFolderFeeds),
    isExpanded: expandedFolderIds.has(folder.id),
    isSelected,
    feeds: mapFeedsToFeedTreeViewModels(folderFeeds, {
      selectedFeedId,
      grayscaleFavicons,
      viewMode,
      starredCountByFeedId,
    }),
  };
}

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

function collectFeedIds(feeds: FeedDto[]): string[] {
  return feeds.map((feed) => feed.id);
}

function getVisibleSidebarFolderFeeds({
  folderId,
  feedsByFolder,
  getVisibleFeeds,
}: SidebarFolderFeedVisibilityParams): FeedDto[] {
  return getVisibleFeeds(feedsByFolder.get(folderId) ?? []);
}

function getVisibleSidebarUnfolderedFeeds({
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
  const folderModels: FeedTreeFolderViewModel[] = [];
  const folderBuildParams = {
    feedsByFolder,
    visibleFolderFeedsById,
    expandedFolderIds,
    selectedFolderId,
    selectedFeedId,
    grayscaleFavicons,
    viewMode,
    starredCountByFeedId,
    hideEmptyFoldersInCurrentView,
  };

  for (const folder of sortedFolderList) {
    const folderModel = buildVisibleSidebarFeedTreeFolder(folder, folderBuildParams);
    if (folderModel !== null) {
      folderModels.push(folderModel);
    }
  }

  return folderModels;
}
