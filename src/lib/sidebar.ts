import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import type { SortSubscriptions } from "@/lib/preferences-schema";

export type { SortSubscriptions } from "@/lib/preferences-schema";

type GroupedFeeds = {
  feedsByFolder: Map<string, FeedDto[]>;
  unfolderedFeeds: FeedDto[];
};

export function groupFeedsByFolder(feeds: FeedDto[]): GroupedFeeds {
  const byFolder = new Map<string, FeedDto[]>();
  const unfoldered: FeedDto[] = [];
  for (const feed of feeds) {
    if (feed.folder_id !== null) {
      const existing = byFolder.get(feed.folder_id) ?? [];
      existing.push(feed);
      byFolder.set(feed.folder_id, existing);
    } else {
      unfoldered.push(feed);
    }
  }
  return { feedsByFolder: byFolder, unfolderedFeeds: unfoldered };
}

export function sortFeedsByPreference(feeds: FeedDto[], _sortPreference?: SortSubscriptions): FeedDto[] {
  return [...feeds].sort((a, b) => a.title.localeCompare(b.title));
}

export function countFeedsInFolder(feeds: FeedDto[] | undefined, folderId: string): number {
  return (feeds ?? []).filter((feed) => feed.folder_id === folderId).length;
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

    counts.set(article.feed_id, (counts.get(article.feed_id) ?? 0) + 1);
  }

  return counts;
}

export function countUnreadFeedsInFolder(feeds: FeedDto[] | undefined, folderId: string): number {
  return (feeds ?? []).reduce((sum, feed) => (feed.folder_id === folderId ? sum + feed.unread_count : sum), 0);
}
