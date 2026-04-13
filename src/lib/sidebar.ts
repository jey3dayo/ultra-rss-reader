import type { FeedDto } from "@/api/tauri-commands";
import type { SortSubscriptions } from "@/stores/preferences-store";

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

export function sortFeedsByPreference(feeds: FeedDto[], sortPreference: SortSubscriptions): FeedDto[] {
  switch (sortPreference) {
    case "alphabetical":
      return [...feeds].sort((a, b) => a.title.localeCompare(b.title));
    case "newest_first":
      return [...feeds].reverse();
    case "oldest_first":
      return [...feeds];
    default:
      return feeds;
  }
}
