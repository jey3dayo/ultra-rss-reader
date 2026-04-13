import type { FeedDto } from "@/api/tauri-commands";
import type { SidebarFeedTreeViewMode } from "./sidebar-feed-tree.types";
import type { FeedTreeFeedViewModel } from "./feed-tree-row";

type SortFeeds = (candidateFeeds: FeedDto[]) => FeedDto[];

type FeedTreeViewModelOptions = {
  selectedFeedId: string | null;
  grayscaleFavicons: boolean;
};

export function getVisibleSidebarFeeds(
  feeds: FeedDto[],
  viewMode: SidebarFeedTreeViewMode,
  sortFeeds: SortFeeds,
): FeedDto[] {
  const sortedFeeds = sortFeeds(feeds);
  if (viewMode === "unread") {
    return sortedFeeds.filter((feed) => feed.unread_count > 0);
  }
  return sortedFeeds;
}

export function mapFeedsToFeedTreeViewModels(
  feeds: FeedDto[],
  { selectedFeedId, grayscaleFavicons }: FeedTreeViewModelOptions,
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
