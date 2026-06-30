import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import type { SortSubscriptions } from "@/schemas/preference-values";

export type { SortSubscriptions } from "@/schemas/preference-values";

type GroupedFeeds = {
  feedsByFolder: Map<string, FeedDto[]>;
  unfolderedFeeds: FeedDto[];
};

function normalizeFolderId(folderId: string | null): string | null {
  if (folderId === null) {
    return null;
  }

  const trimmedFolderId = folderId.trim();
  return trimmedFolderId.length === 0 ? null : trimmedFolderId;
}

function normalizeFeedId(feedId: string): string | null {
  const trimmedFeedId = feedId.trim();
  return trimmedFeedId.length === 0 ? null : trimmedFeedId;
}

export function groupFeedsByFolder(feeds: FeedDto[]): GroupedFeeds {
  const byFolder = new Map<string, FeedDto[]>();
  const unfoldered: FeedDto[] = [];
  for (const feed of feeds) {
    const folderId = normalizeFolderId(feed.folder_id);
    if (folderId !== null) {
      const existing = byFolder.get(folderId) ?? [];
      existing.push(feed);
      byFolder.set(folderId, existing);
    } else {
      unfoldered.push(feed);
    }
  }
  return { feedsByFolder: byFolder, unfolderedFeeds: unfoldered };
}

export function sortFeedsByPreference(feeds: FeedDto[], _sortPreference?: SortSubscriptions): FeedDto[] {
  const sortedFeeds = feeds.slice();
  sortedFeeds.sort((a, b) => a.title.localeCompare(b.title));
  return sortedFeeds;
}

export function countFeedsInFolder(feeds: FeedDto[] | undefined, folderId: string): number {
  const normalizedFolderId = normalizeFolderId(folderId);
  if (normalizedFolderId === null) {
    return 0;
  }

  return (feeds ?? []).filter((feed) => normalizeFolderId(feed.folder_id) === normalizedFolderId).length;
}

export function sumUnreadCounts(feeds: FeedDto[] | undefined): number {
  return (feeds ?? []).reduce((sum, feed) => sum + feed.unread_count, 0);
}

export function buildStarredCountByFeedId(articles: ArticleDto[] | undefined): Map<string, number> {
  const counts = new Map<string, number>();
  for (const article of articles ?? []) {
    if (!article.is_starred) {
      continue;
    }

    const feedId = normalizeFeedId(article.feed_id);
    if (feedId === null) {
      continue;
    }

    counts.set(feedId, (counts.get(feedId) ?? 0) + 1);
  }

  return counts;
}

export function countUnreadFeedsInFolder(feeds: FeedDto[] | undefined, folderId: string): number {
  const normalizedFolderId = normalizeFolderId(folderId);
  if (normalizedFolderId === null) {
    return 0;
  }

  return (feeds ?? []).reduce(
    (sum, feed) => (normalizeFolderId(feed.folder_id) === normalizedFolderId ? sum + feed.unread_count : sum),
    0,
  );
}
