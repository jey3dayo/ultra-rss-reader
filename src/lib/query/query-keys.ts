// Query key roots, scoped key factories, and query-key inspection helpers.
import type { QueryKey } from "@tanstack/react-query";
import { createSchemaVersionedQueryKey } from "@/api/schemas/runtime-contracts";
import type { ReaderFilter } from "@/lib/reader/reader-query";

export type QueryInvalidationKey = ReturnType<typeof createSchemaVersionedQueryKey<string>>;
export type ReaderArticleModeOptions = Readonly<{ mode: ReaderFilter }>;
export function readerArticleModeOptions(mode: ReaderFilter): ReaderArticleModeOptions {
  return { mode };
}

export function getQueryKeyRootName(queryKey: QueryKey): string | null {
  const rootName = queryKey[1];
  return typeof rootName === "string" ? rootName : null;
}

export function getQueryKeyScopeValue(queryKey: QueryKey, scopeIndex: number): unknown {
  return queryKey[scopeIndex + 2];
}

export const QUERY_KEY_ROOTS = {
  accounts: createSchemaVersionedQueryKey("accounts"),
  feeds: createSchemaVersionedQueryKey("feeds"),
  folders: createSchemaVersionedQueryKey("folders"),
  articles: createSchemaVersionedQueryKey("articles"),
  accountArticles: createSchemaVersionedQueryKey("accountArticles"),
  folderArticles: createSchemaVersionedQueryKey("folderArticles"),
  starredArticles: createSchemaVersionedQueryKey("starredArticles"),
  recentArticles: createSchemaVersionedQueryKey("recentArticles"),
  accountUnreadCount: createSchemaVersionedQueryKey("accountUnreadCount"),
  accountStarredCount: createSchemaVersionedQueryKey("accountStarredCount"),
  articlesByTag: createSchemaVersionedQueryKey("articlesByTag"),
  tagArticleCounts: createSchemaVersionedQueryKey("tagArticleCounts"),
  search: createSchemaVersionedQueryKey("search"),
  feedIntegrityReport: createSchemaVersionedQueryKey("feedIntegrityReport"),
  feedArticleSummaries: createSchemaVersionedQueryKey("feedArticleSummaries"),
  localFeedSyncStatuses: createSchemaVersionedQueryKey("localFeedSyncStatuses"),
} as const satisfies Record<string, QueryInvalidationKey>;

export const queryKeys = {
  accounts: {
    root: QUERY_KEY_ROOTS.accounts,
  },
  feeds: {
    root: QUERY_KEY_ROOTS.feeds,
    byAccount: (accountId: string | null) => [...QUERY_KEY_ROOTS.feeds, normalizeQueryAccountId(accountId)] as const,
  },
  folders: {
    root: QUERY_KEY_ROOTS.folders,
  },
  articles: {
    root: QUERY_KEY_ROOTS.articles,
    byId: (articleId: string | null) => [...QUERY_KEY_ROOTS.articles, "byId", articleId] as const,
    byFeed: (feedId: string | null, mode: ReaderFilter) =>
      [...QUERY_KEY_ROOTS.articles, feedId, readerArticleModeOptions(mode)] as const,
  },
  accountArticles: {
    root: QUERY_KEY_ROOTS.accountArticles,
    byAccountPrefix: (accountId: string | null) =>
      [...QUERY_KEY_ROOTS.accountArticles, normalizeQueryAccountId(accountId)] as const,
    byAccount: (accountId: string | null, mode: ReaderFilter) =>
      [...QUERY_KEY_ROOTS.accountArticles, normalizeQueryAccountId(accountId), readerArticleModeOptions(mode)] as const,
  },
  folderArticles: {
    root: QUERY_KEY_ROOTS.folderArticles,
    byFolder: (folderId: string | null, mode: ReaderFilter) =>
      [...QUERY_KEY_ROOTS.folderArticles, folderId, readerArticleModeOptions(mode)] as const,
  },
  starredArticles: {
    root: QUERY_KEY_ROOTS.starredArticles,
    byAccount: (accountId: string | null) =>
      [...QUERY_KEY_ROOTS.starredArticles, normalizeQueryAccountId(accountId)] as const,
  },
  recentArticles: {
    root: QUERY_KEY_ROOTS.recentArticles,
    byAccount: (accountId: string | null, mode: ReaderFilter) =>
      [...QUERY_KEY_ROOTS.recentArticles, normalizeQueryAccountId(accountId), readerArticleModeOptions(mode)] as const,
  },
  accountUnreadCount: {
    root: QUERY_KEY_ROOTS.accountUnreadCount,
    byAccount: (accountId: string | null) =>
      [...QUERY_KEY_ROOTS.accountUnreadCount, normalizeQueryAccountId(accountId)] as const,
  },
  accountStarredCount: {
    root: QUERY_KEY_ROOTS.accountStarredCount,
    byAccount: (accountId: string | null) =>
      [...QUERY_KEY_ROOTS.accountStarredCount, normalizeQueryAccountId(accountId)] as const,
  },
  articlesByTag: {
    root: QUERY_KEY_ROOTS.articlesByTag,
    byTagAndAccount: (tagId: string | null, accountId: string | null, mode: ReaderFilter) =>
      [
        ...QUERY_KEY_ROOTS.articlesByTag,
        tagId,
        normalizeQueryAccountId(accountId),
        readerArticleModeOptions(mode),
      ] as const,
  },
  tagArticleCounts: {
    root: QUERY_KEY_ROOTS.tagArticleCounts,
    byAccount: (accountId: string | null) =>
      [...QUERY_KEY_ROOTS.tagArticleCounts, normalizeQueryAccountId(accountId)] as const,
  },
  search: {
    root: QUERY_KEY_ROOTS.search,
    byAccountAndQuery: (accountId: string | null, query: string) =>
      [...QUERY_KEY_ROOTS.search, normalizeQueryAccountId(accountId), query] as const,
  },
  feedIntegrityReport: {
    root: QUERY_KEY_ROOTS.feedIntegrityReport,
  },
  feedArticleSummaries: {
    root: QUERY_KEY_ROOTS.feedArticleSummaries,
    byAccount: (accountId: string | null) =>
      [...QUERY_KEY_ROOTS.feedArticleSummaries, normalizeQueryAccountId(accountId)] as const,
    subscriptionsIndex: (accountId: string | null) =>
      [...QUERY_KEY_ROOTS.feedArticleSummaries, normalizeQueryAccountId(accountId)] as const,
  },
  localFeedSyncStatuses: {
    root: QUERY_KEY_ROOTS.localFeedSyncStatuses,
    byAccount: (accountId: string | null) =>
      [...QUERY_KEY_ROOTS.localFeedSyncStatuses, normalizeQueryAccountId(accountId)] as const,
  },
} as const;

export function normalizeQueryAccountId(accountId: string | null | undefined): string | null {
  const normalizedAccountId = accountId?.trim();

  return normalizedAccountId ? normalizedAccountId : null;
}

export const ARTICLE_CACHE_QUERY_ROOTS = [
  queryKeys.articles.root,
  queryKeys.accountArticles.root,
  queryKeys.folderArticles.root,
  queryKeys.articlesByTag.root,
  queryKeys.search.root,
  queryKeys.starredArticles.root,
  queryKeys.recentArticles.root,
] as const satisfies ReadonlyArray<QueryInvalidationKey>;

export function getReaderArticleQueryMode(queryKey: QueryKey): ReaderFilter | null {
  for (const item of queryKey) {
    if (item && typeof item === "object" && "mode" in item) {
      const mode = Reflect.get(item, "mode");
      if (mode === "all" || mode === "unread" || mode === "starred") {
        return mode;
      }
    }
  }

  return null;
}
