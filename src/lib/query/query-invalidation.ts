import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { ReaderFilter } from "@/lib/reader/reader-query";

type InvalidateFeedQueriesOptions = {
  includeFeeds?: boolean;
  includeFolders?: boolean;
  includeAccountUnreadCount?: boolean;
};

type InvalidateArticleQueriesOptions = {
  includeArticles?: boolean;
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
  includeFeedArticleSummaries?: boolean;
};

type QueryInvalidationKey = readonly [string];
type ReaderArticleModeOptions = Readonly<{ mode: ReaderFilter }>;
type QueryInvalidationFailure = {
  queryKey: QueryKey;
  error: unknown;
};

let queryInvalidationFailureReporter: (failures: readonly QueryInvalidationFailure[]) => void =
  reportQueryInvalidationFailures;

function reportQueryInvalidationFailures(failures: readonly QueryInvalidationFailure[]) {
  for (const failure of failures) {
    console.warn("Query invalidation failed:", failure);
  }
}

export function setQueryInvalidationFailureReporterForDiagnostics(
  reporter: (failures: readonly QueryInvalidationFailure[]) => void,
) {
  queryInvalidationFailureReporter = reporter;
  return () => {
    queryInvalidationFailureReporter = reportQueryInvalidationFailures;
  };
}

function readerArticleModeOptions(mode: ReaderFilter): ReaderArticleModeOptions {
  return { mode };
}

export const QUERY_KEY_ROOTS = {
  accounts: ["accounts"],
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
  feedArticleSummaries: ["feedArticleSummaries"],
} as const satisfies Record<string, QueryInvalidationKey>;

export const queryKeys = {
  accounts: {
    root: QUERY_KEY_ROOTS.accounts,
  },
  feeds: {
    root: QUERY_KEY_ROOTS.feeds,
    byAccount: (accountId: string) => [QUERY_KEY_ROOTS.feeds[0], accountId] as const,
  },
  articles: {
    root: QUERY_KEY_ROOTS.articles,
    byFeed: (feedId: string | null, mode: ReaderFilter) =>
      [QUERY_KEY_ROOTS.articles[0], feedId, readerArticleModeOptions(mode)] as const,
  },
  accountArticles: {
    root: QUERY_KEY_ROOTS.accountArticles,
    byAccountPrefix: (accountId: string) => [QUERY_KEY_ROOTS.accountArticles[0], accountId] as const,
    byAccount: (accountId: string | null, mode: ReaderFilter) =>
      [QUERY_KEY_ROOTS.accountArticles[0], accountId, readerArticleModeOptions(mode)] as const,
  },
  folderArticles: {
    root: QUERY_KEY_ROOTS.folderArticles,
    byFolder: (folderId: string | null, mode: ReaderFilter) =>
      [QUERY_KEY_ROOTS.folderArticles[0], folderId, readerArticleModeOptions(mode)] as const,
  },
  starredArticles: {
    root: QUERY_KEY_ROOTS.starredArticles,
    byAccount: (accountId: string) => [QUERY_KEY_ROOTS.starredArticles[0], accountId] as const,
  },
  recentArticles: {
    root: QUERY_KEY_ROOTS.recentArticles,
    byAccount: (accountId: string | null, mode: ReaderFilter) =>
      [QUERY_KEY_ROOTS.recentArticles[0], accountId, readerArticleModeOptions(mode)] as const,
  },
  accountUnreadCount: {
    root: QUERY_KEY_ROOTS.accountUnreadCount,
    byAccount: (accountId: string | null) => [QUERY_KEY_ROOTS.accountUnreadCount[0], accountId] as const,
  },
  accountStarredCount: {
    root: QUERY_KEY_ROOTS.accountStarredCount,
    byAccount: (accountId: string | null) => [QUERY_KEY_ROOTS.accountStarredCount[0], accountId] as const,
  },
  articlesByTag: {
    root: QUERY_KEY_ROOTS.articlesByTag,
    byTagAndAccount: (tagId: string | null, accountId: string | null, mode: ReaderFilter) =>
      [QUERY_KEY_ROOTS.articlesByTag[0], tagId, accountId, readerArticleModeOptions(mode)] as const,
  },
  tagArticleCounts: {
    root: QUERY_KEY_ROOTS.tagArticleCounts,
    byAccount: (accountId: string | null) => [QUERY_KEY_ROOTS.tagArticleCounts[0], accountId] as const,
  },
  search: {
    root: QUERY_KEY_ROOTS.search,
    byAccountAndQuery: (accountId: string | null, query: string) =>
      [QUERY_KEY_ROOTS.search[0], accountId, query] as const,
  },
  feedIntegrityReport: {
    root: QUERY_KEY_ROOTS.feedIntegrityReport,
  },
  feedArticleSummaries: {
    root: QUERY_KEY_ROOTS.feedArticleSummaries,
    byAccount: (accountId: string | null) => [QUERY_KEY_ROOTS.feedArticleSummaries[0], accountId] as const,
    subscriptionsIndex: (accountId: string | null) =>
      [QUERY_KEY_ROOTS.feedArticleSummaries[0], normalizeQueryAccountId(accountId)] as const,
  },
} as const;

export function normalizeQueryAccountId(accountId: string | null | undefined): string | null {
  const normalizedAccountId = accountId?.trim();

  return normalizedAccountId ? normalizedAccountId : null;
}

export const ARTICLE_CACHE_QUERY_ROOTS = [
  queryKeys.articles.root,
  queryKeys.accountArticles.root,
  queryKeys.articlesByTag.root,
  queryKeys.search.root,
  queryKeys.starredArticles.root,
  queryKeys.recentArticles.root,
] as const satisfies ReadonlyArray<QueryInvalidationKey>;

export function getReaderArticleQueryMode(queryKey: QueryKey): ReaderFilter | null {
  const options = queryKey[2];
  if (options && typeof options === "object" && "mode" in options) {
    const mode = Reflect.get(options, "mode");
    if (mode === "all" || mode === "unread" || mode === "starred") {
      return mode;
    }
  }

  return null;
}

type InvalidationTarget<TOption extends string> = {
  option: TOption;
  defaultEnabled: boolean;
  queryKeys: ReadonlyArray<QueryInvalidationKey>;
};

const FEED_INVALIDATION_TARGETS = [
  {
    option: "includeFeeds",
    defaultEnabled: true,
    queryKeys: [queryKeys.feeds.root],
  },
  {
    option: "includeFolders",
    defaultEnabled: true,
    queryKeys: [QUERY_KEY_ROOTS.folders],
  },
  {
    option: "includeAccountUnreadCount",
    defaultEnabled: false,
    queryKeys: [queryKeys.accountUnreadCount.root],
  },
] as const satisfies ReadonlyArray<InvalidationTarget<keyof InvalidateFeedQueriesOptions>>;

const ARTICLE_INVALIDATION_TARGETS = [
  {
    option: "includeArticles",
    defaultEnabled: true,
    queryKeys: [queryKeys.articles.root],
  },
  {
    option: "includeAccountArticles",
    defaultEnabled: true,
    queryKeys: [queryKeys.accountArticles.root, queryKeys.folderArticles.root],
  },
  {
    option: "includeStarredArticles",
    defaultEnabled: true,
    queryKeys: [queryKeys.starredArticles.root],
  },
  {
    option: "includeAccountUnreadCount",
    defaultEnabled: true,
    queryKeys: [queryKeys.accountUnreadCount.root],
  },
  {
    option: "includeAccountStarredCount",
    defaultEnabled: true,
    queryKeys: [queryKeys.accountStarredCount.root],
  },
  {
    option: "includeFeeds",
    defaultEnabled: true,
    queryKeys: [queryKeys.feeds.root],
  },
  {
    option: "includeArticlesByTag",
    defaultEnabled: true,
    queryKeys: [queryKeys.articlesByTag.root],
  },
  {
    option: "includeTagArticleCounts",
    defaultEnabled: false,
    queryKeys: [queryKeys.tagArticleCounts.root],
  },
  {
    option: "includeSearch",
    defaultEnabled: true,
    queryKeys: [queryKeys.search.root],
  },
  {
    option: "includeFeedIntegrityReport",
    defaultEnabled: false,
    queryKeys: [queryKeys.feedIntegrityReport.root],
  },
  {
    option: "includeRecentArticles",
    defaultEnabled: true,
    queryKeys: [queryKeys.recentArticles.root],
  },
  {
    option: "includeFeedArticleSummaries",
    defaultEnabled: true,
    queryKeys: [queryKeys.feedArticleSummaries.root],
  },
] as const satisfies ReadonlyArray<InvalidationTarget<keyof InvalidateArticleQueriesOptions>>;

function resolveInvalidationQueryKeys<TOption extends string>(
  targets: ReadonlyArray<InvalidationTarget<TOption>>,
  options: Partial<Record<TOption, boolean>>,
): QueryInvalidationKey[] {
  const queryKeys: QueryInvalidationKey[] = [];

  for (const target of targets) {
    if (options[target.option] ?? target.defaultEnabled) {
      queryKeys.push(...target.queryKeys);
    }
  }

  return queryKeys;
}

export function resolveFeedInvalidationQueryKeys(
  options: InvalidateFeedQueriesOptions = {},
): ReadonlyArray<QueryInvalidationKey> {
  return resolveInvalidationQueryKeys(FEED_INVALIDATION_TARGETS, options);
}

export function resolveArticleInvalidationQueryKeys(
  options: InvalidateArticleQueriesOptions = {},
): ReadonlyArray<QueryInvalidationKey> {
  return resolveInvalidationQueryKeys(ARTICLE_INVALIDATION_TARGETS, options);
}

export function invalidateQueryKeysLogOnly(queryClient: QueryClient, queryKeys: ReadonlyArray<QueryKey>) {
  void Promise.all(
    queryKeys.map((queryKey) =>
      queryClient
        .invalidateQueries({ queryKey })
        .then(() => null)
        .catch((error: unknown): QueryInvalidationFailure => ({ queryKey, error })),
    ),
  ).then((results) => {
    const failures = results.filter((result): result is QueryInvalidationFailure => result !== null);
    if (failures.length > 0) {
      queryInvalidationFailureReporter(failures);
    }
  });
}

export function invalidateFeedQueries(queryClient: QueryClient, options: InvalidateFeedQueriesOptions = {}) {
  invalidateQueryKeysLogOnly(queryClient, resolveFeedInvalidationQueryKeys(options));
}

export function invalidateArticleQueries(queryClient: QueryClient, options: InvalidateArticleQueriesOptions = {}) {
  invalidateQueryKeysLogOnly(queryClient, resolveArticleInvalidationQueryKeys(options));
}

export function invalidateSyncCompletedQueries(queryClient: QueryClient) {
  invalidateFeedQueries(queryClient, { includeAccountUnreadCount: true });
  invalidateArticleQueries(queryClient, {
    includeAccountUnreadCount: false,
    includeFeeds: false,
    includeFeedIntegrityReport: true,
    includeTagArticleCounts: true,
  });
}

export type { InvalidateArticleQueriesOptions, InvalidateFeedQueriesOptions };
