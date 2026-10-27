import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { FeedDto } from "@/api/tauri-commands";
import { markFeedRead } from "@/api/tauri-commands";
import { extractNormalizedSiteHost } from "@/lib/feed/feed";
import { invalidateArticleMutationQueries } from "@/lib/query/query-invalidation";
import { patchCachedArticlesMarkedRead } from "./article-cache-projection";

type MarkSameSiteFeedsReadParams = {
  targetFeed: FeedDto;
  allAccountFeeds: FeedDto[];
};

/**
 * Mark all articles as read in every feed that shares the same site as the target feed.
 *
 * Site matching:
 * - Use the feed's site_url host if available, otherwise fall back to the feed URL host
 * - Normalize by lowercasing and stripping leading "www."
 * - Only feeds with a determinable host are matched; feeds with no valid host only match themselves
 */
export function useMarkSameSiteFeedsRead() {
  const queryClient = useQueryClient();

  return useCallback(
    async ({ targetFeed, allAccountFeeds }: MarkSameSiteFeedsReadParams): Promise<string[]> => {
      const targetHost = extractNormalizedSiteHost(targetFeed.site_url, targetFeed.url);

      const matchingFeeds = allAccountFeeds.filter((feed) => {
        if (feed.account_id !== targetFeed.account_id) {
          return false;
        }

        const feedHost = extractNormalizedSiteHost(feed.site_url, feed.url);
        if (!feedHost || !targetHost) {
          return feed.id === targetFeed.id;
        }

        return feedHost === targetHost;
      });

      const allMarkedArticleIds: string[] = [];

      for (const feed of matchingFeeds) {
        const result = await markFeedRead(feed.id);
        if (Result.isSuccess(result)) {
          const markedArticleIds = Result.unwrap(result);
          allMarkedArticleIds.push(...markedArticleIds);
        }
      }

      patchCachedArticlesMarkedRead(queryClient, new Set(allMarkedArticleIds));
      invalidateArticleMutationQueries(queryClient, "article-read");

      return matchingFeeds.map((feed) => feed.id);
    },
    [queryClient],
  );
}

/**
 * Count how many other feeds in the same account share the target feed's site.
 *
 * Returns the total count of matching feeds (including the target feed itself).
 */
export function countSameSiteFeeds(targetFeed: FeedDto, allAccountFeeds: FeedDto[]): number {
  const targetHost = extractNormalizedSiteHost(targetFeed.site_url, targetFeed.url);

  return allAccountFeeds.filter((feed) => {
    if (feed.account_id !== targetFeed.account_id) {
      return false;
    }

    const feedHost = extractNormalizedSiteHost(feed.site_url, feed.url);
    if (!feedHost || !targetHost) {
      return feed.id === targetFeed.id;
    }

    return feedHost === targetHost;
  }).length;
}
