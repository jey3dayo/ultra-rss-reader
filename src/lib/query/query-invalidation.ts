import type { QueryClient } from "@tanstack/react-query";

type InvalidateFeedQueriesOptions = {
  includeFeeds?: boolean;
  includeFolders?: boolean;
  includeAccountUnreadCount?: boolean;
};

type InvalidateArticleQueriesOptions = {
  includeAccountArticles?: boolean;
  includeStarredArticles?: boolean;
  includeAccountUnreadCount?: boolean;
  includeAccountStarredCount?: boolean;
  includeFeeds?: boolean;
  includeArticlesByTag?: boolean;
  includeTagArticleCounts?: boolean;
  includeSearch?: boolean;
  includeFeedIntegrityReport?: boolean;
  includeRecentArticles?: boolean;
};

const QUERY_KEYS = {
  feeds: ["feeds"],
  folders: ["folders"],
  articles: ["articles"],
  accountArticles: ["accountArticles"],
  folderArticles: ["folderArticles"],
  starredArticles: ["starredArticles"],
  recentArticles: ["recentArticles"],
  accountUnreadCount: ["accountUnreadCount"],
  accountStarredCount: ["accountStarredCount"],
  articlesByTag: ["articlesByTag"],
  tagArticleCounts: ["tagArticleCounts"],
  search: ["search"],
  feedIntegrityReport: ["feedIntegrityReport"],
} as const;

function invalidateQueryKeys(
  queryClient: QueryClient,
  queryKeys: ReadonlyArray<readonly [string]>,
) {
  for (const queryKey of queryKeys) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

export function invalidateFeedQueries(
  queryClient: QueryClient,
  {
    includeFeeds = true,
    includeFolders = true,
    includeAccountUnreadCount = false,
  }: InvalidateFeedQueriesOptions = {},
) {
  const queryKeys: Array<readonly [string]> = [];

  if (includeFeeds) {
    queryKeys.push(QUERY_KEYS.feeds);
  }

  if (includeFolders) {
    queryKeys.push(QUERY_KEYS.folders);
  }

  if (includeAccountUnreadCount) {
    queryKeys.push(QUERY_KEYS.accountUnreadCount);
  }

  invalidateQueryKeys(queryClient, queryKeys);
}

export function invalidateArticleQueries(
  queryClient: QueryClient,
  {
    includeAccountArticles = true,
    includeStarredArticles = true,
    includeAccountUnreadCount = true,
    includeAccountStarredCount = true,
    includeFeeds = true,
    includeArticlesByTag = true,
    includeTagArticleCounts = false,
    includeSearch = true,
    includeFeedIntegrityReport = false,
    includeRecentArticles = true,
  }: InvalidateArticleQueriesOptions = {},
) {
  const queryKeys: Array<readonly [string]> = [QUERY_KEYS.articles];

  if (includeAccountArticles) {
    queryKeys.push(QUERY_KEYS.accountArticles);
    queryKeys.push(QUERY_KEYS.folderArticles);
  }

  if (includeStarredArticles) {
    queryKeys.push(QUERY_KEYS.starredArticles);
  }

  if (includeAccountUnreadCount) {
    queryKeys.push(QUERY_KEYS.accountUnreadCount);
  }

  if (includeAccountStarredCount) {
    queryKeys.push(QUERY_KEYS.accountStarredCount);
  }

  if (includeFeeds) {
    queryKeys.push(QUERY_KEYS.feeds);
  }

  if (includeArticlesByTag) {
    queryKeys.push(QUERY_KEYS.articlesByTag);
  }

  if (includeTagArticleCounts) {
    queryKeys.push(QUERY_KEYS.tagArticleCounts);
  }

  if (includeSearch) {
    queryKeys.push(QUERY_KEYS.search);
  }

  if (includeFeedIntegrityReport) {
    queryKeys.push(QUERY_KEYS.feedIntegrityReport);
  }

  if (includeRecentArticles) {
    queryKeys.push(QUERY_KEYS.recentArticles);
  }

  invalidateQueryKeys(queryClient, queryKeys);
}

export type { InvalidateArticleQueriesOptions, InvalidateFeedQueriesOptions };
