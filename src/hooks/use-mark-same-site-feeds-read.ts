import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { FeedDto } from "@/api/tauri-commands";
import { markFeedRead } from "@/api/tauri-commands";
import { shouldRetainBulkMarkedRead } from "@/lib/articles/article-read-projection";
import { extractNormalizedSiteHost } from "@/lib/feed/feed";
import { invalidateArticleMutationQueries } from "@/lib/query/query-invalidation";
import { useUiStore } from "@/stores/ui-store";
import { patchCachedArticlesMarkedRead } from "./article-cache-projection";

type MarkSameSiteFeedsReadParams = {
  targetFeed: FeedDto;
  allAccountFeeds: FeedDto[];
};

type MarkSameSiteFeedsReadResult = {
  succeededFeedIds: string[];
  failedFeedIds: string[];
  markedArticleIds: string[];
};

/**
 * Get all feeds that share the same site as the target feed.
 *
 * Site matching:
 * - Use the feed's site_url host if available, otherwise fall back to the feed URL host
 * - Normalize by lowercasing and stripping leading "www."
 * - Only feeds with a determinable host are matched; feeds with no valid host only match themselves
 * - Only matches feeds within the same account
 */
function getSameSiteFeeds(targetFeed: FeedDto, allAccountFeeds: FeedDto[]): FeedDto[] {
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
  });
}

/**
 * Mark all articles as read in every feed that shares the same site as the target feed.
 *
 * Follows the same retention policy as bulk mark-read: articles stay visible in unread view
 * until navigation.
 */
export function useMarkSameSiteFeedsRead() {
  const queryClient = useQueryClient();

  return useCallback(
    async ({ targetFeed, allAccountFeeds }: MarkSameSiteFeedsReadParams): Promise<MarkSameSiteFeedsReadResult> => {
      const matchingFeeds = getSameSiteFeeds(targetFeed, allAccountFeeds);

      const succeededFeedIds: string[] = [];
      const failedFeedIds: string[] = [];
      const allMarkedArticleIds: string[] = [];

      for (const feed of matchingFeeds) {
        const result = await markFeedRead(feed.id);
        if (Result.isSuccess(result)) {
          const markedArticleIds = Result.unwrap(result);
          allMarkedArticleIds.push(...markedArticleIds);
          succeededFeedIds.push(feed.id);
        } else {
          failedFeedIds.push(feed.id);
        }
      }

      // Apply the same retention policy as bulk mark-read
      const { viewMode, retainArticles } = useUiStore.getState();
      if (shouldRetainBulkMarkedRead(viewMode)) {
        retainArticles(allMarkedArticleIds);
      }

      patchCachedArticlesMarkedRead(queryClient, new Set(allMarkedArticleIds));
      invalidateArticleMutationQueries(queryClient, "article-read");

      return {
        succeededFeedIds,
        failedFeedIds,
        markedArticleIds: allMarkedArticleIds,
      };
    },
    [queryClient],
  );
}
