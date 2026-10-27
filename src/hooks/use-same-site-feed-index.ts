import { useMemo } from "react";
import type { FeedDto } from "@/api/tauri-commands";
import { extractNormalizedSiteHost } from "@/lib/feed/feed";

export type SameSiteFeedStats = {
  feedIds: string[];
  unreadCount: number;
};

/**
 * Build a memoized index of feeds grouped by normalized site host.
 *
 * Avoids N² URL reparsing by computing the normalized host once per feed
 * and building a lookup map.
 *
 * Feeds with no determinable host (null) are excluded from the index entirely,
 * so the mark-same-site action is hidden for such feeds.
 */
export function useSameSiteFeedIndex(feeds: FeedDto[] | undefined): Map<string, SameSiteFeedStats> {
  return useMemo(() => {
    if (!feeds) {
      return new Map();
    }

    const index = new Map<string, SameSiteFeedStats>();

    for (const feed of feeds) {
      const host = extractNormalizedSiteHost(feed.site_url, feed.url);

      // Exclude feeds with no determinable host
      if (!host) {
        continue;
      }

      const stats = index.get(host);
      if (stats) {
        stats.feedIds.push(feed.id);
        stats.unreadCount += feed.unread_count;
      } else {
        index.set(host, {
          feedIds: [feed.id],
          unreadCount: feed.unread_count,
        });
      }
    }

    return index;
  }, [feeds]);
}
