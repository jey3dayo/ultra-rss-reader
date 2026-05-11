import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { createSchemaVersionedQueryKey } from "@/api/schemas/runtime-contracts";
import type { ReaderFilter } from "@/lib/reader/reader-query";
import { logRuntimeDiagnostic } from "@/lib/runtime/diagnostics";

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

type QueryInvalidationActionOwner =
  | "add-feed"
  | "article-mutation"
  | "background-sync-completed"
  | "delete-feed"
  | "manual-sync-completed"
  | "mute-keyword-mutation"
  | "tag-mutation"
  | "unknown";
type QueryInvalidationKey = ReturnType<typeof createSchemaVersionedQueryKey<string>>;
type ReaderArticleModeOptions = Readonly<{ mode: ReaderFilter }>;
type QueryInvalidationFailure = {
  actionOwner: QueryInvalidationActionOwner;
  queryKey: QueryKey;
  error: unknown;
};

type InvalidateQueryKeysLogOnlyOptions = {
  actionOwner?: QueryInvalidationActionOwner;
};

type InvalidateFeedMutationQueriesOptions = {
  accountId?: string | null;
};

type InvalidateSyncCompletedQueriesOptions = {
  actionOwner?: Extract<QueryInvalidationActionOwner, "background-sync-completed" | "manual-sync-completed">;
};

type FeedMutationInvalidationOwnerMatrixEntry = {
  feedOptions: InvalidateFeedQueriesOptions;
  articleOptions: InvalidateArticleQueriesOptions;
  includeAccountScopedFeedArticleSummaries: boolean;
};

type ArticleMutationInvalidationKind = "article-read-star" | "mute-keyword" | "tag-article-assignment" | "tag-metadata";

type ArticleMutationInvalidationMatrixEntry = {
  actionOwner: Extract<QueryInvalidationActionOwner, "article-mutation" | "mute-keyword-mutation" | "tag-mutation">;
  articleOptions: InvalidateArticleQueriesOptions;
};

let queryInvalidationFailureReporter: (failures: readonly QueryInvalidationFailure[]) => void =
  reportQueryInvalidationFailures;

function reportQueryInvalidationFailures(failures: readonly QueryInvalidationFailure[]) {
  logRuntimeDiagnostic("mutation-invalidation", "Query invalidation failed:", { failures });
}

export function setQueryInvalidationFailureReporterForDiagnostics(
  reporter: (failures: readonly QueryInvalidationFailure[]) => void,
) {
  queryInvalidationFailureReporter = reporter;
  return () => {
    resetQueryInvalidationFailureReporterForTests();
  };
}

export function resetQueryInvalidationFailureReporterForTests(): void {
  queryInvalidationFailureReporter = reportQueryInvalidationFailures;
}

function readerArticleModeOptions(mode: ReaderFilter): ReaderArticleModeOptions {
  return { mode };
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
    queryKeys: [queryKeys.folders.root],
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

const FEED_MUTATION_INVALIDATION_OWNER_MATRIX = {
  "add-feed": {
    feedOptions: {
      includeFolders: true,
      includeAccountUnreadCount: true,
    },
    articleOptions: {
      includeAccountUnreadCount: false,
      includeFeeds: false,
      includeTagArticleCounts: true,
    },
    includeAccountScopedFeedArticleSummaries: true,
  },
  "delete-feed": {
    feedOptions: {
      includeFolders: true,
      includeAccountUnreadCount: true,
    },
    articleOptions: {
      includeAccountUnreadCount: false,
      includeFeeds: false,
      includeTagArticleCounts: true,
    },
    includeAccountScopedFeedArticleSummaries: true,
  },
} as const satisfies Record<
  Extract<QueryInvalidationActionOwner, "add-feed" | "delete-feed">,
  FeedMutationInvalidationOwnerMatrixEntry
>;

const ARTICLE_MUTATION_INVALIDATION_MATRIX = {
  "article-read-star": {
    actionOwner: "article-mutation",
    articleOptions: {
      includeTagArticleCounts: true,
    },
  },
  "mute-keyword": {
    actionOwner: "mute-keyword-mutation",
    articleOptions: {
      includeTagArticleCounts: true,
    },
  },
  "tag-article-assignment": {
    actionOwner: "tag-mutation",
    articleOptions: {
      includeArticlesByTag: false,
      includeTagArticleCounts: false,
    },
  },
  "tag-metadata": {
    actionOwner: "tag-mutation",
    articleOptions: {
      includeArticles: false,
      includeAccountArticles: false,
      includeStarredArticles: false,
      includeAccountUnreadCount: false,
      includeAccountStarredCount: false,
      includeFeeds: false,
      includeArticlesByTag: true,
      includeTagArticleCounts: true,
      includeSearch: false,
      includeFeedArticleSummaries: false,
      includeRecentArticles: false,
    },
  },
} as const satisfies Record<ArticleMutationInvalidationKind, ArticleMutationInvalidationMatrixEntry>;

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

export function resolveArticleMutationInvalidationQueryKeys(kind: ArticleMutationInvalidationKind) {
  return resolveArticleInvalidationQueryKeys(ARTICLE_MUTATION_INVALIDATION_MATRIX[kind].articleOptions);
}

function resolveFeedMutationInvalidationQueryKeys(
  actionOwner: Extract<QueryInvalidationActionOwner, "add-feed" | "delete-feed">,
  options: InvalidateFeedMutationQueriesOptions = {},
): ReadonlyArray<QueryKey> {
  const matrixEntry = FEED_MUTATION_INVALIDATION_OWNER_MATRIX[actionOwner];
  const invalidationQueryKeys: QueryKey[] = [
    ...resolveFeedInvalidationQueryKeys(matrixEntry.feedOptions),
    ...resolveArticleInvalidationQueryKeys(matrixEntry.articleOptions),
  ];

  if (matrixEntry.includeAccountScopedFeedArticleSummaries && options.accountId !== undefined) {
    invalidationQueryKeys.push(queryKeys.feedArticleSummaries.subscriptionsIndex(options.accountId));
  }

  return invalidationQueryKeys;
}

export function resolveAddFeedInvalidationQueryKeys(options: InvalidateFeedMutationQueriesOptions = {}) {
  return resolveFeedMutationInvalidationQueryKeys("add-feed", options);
}

export function resolveDeleteFeedInvalidationQueryKeys(options: InvalidateFeedMutationQueriesOptions = {}) {
  return resolveFeedMutationInvalidationQueryKeys("delete-feed", options);
}

export function invalidateArticleMutationQueries(queryClient: QueryClient, kind: ArticleMutationInvalidationKind) {
  const matrixEntry = ARTICLE_MUTATION_INVALIDATION_MATRIX[kind];

  invalidateQueryKeysLogOnly(queryClient, resolveArticleInvalidationQueryKeys(matrixEntry.articleOptions), {
    actionOwner: matrixEntry.actionOwner,
  });
}

export function invalidateQueryKeysLogOnly(
  queryClient: QueryClient,
  queryKeys: ReadonlyArray<QueryKey>,
  options: InvalidateQueryKeysLogOnlyOptions = {},
) {
  const actionOwner = options.actionOwner ?? "unknown";

  void Promise.all(
    queryKeys.map((queryKey) =>
      queryClient
        .invalidateQueries({ queryKey })
        .then(() => null)
        .catch(
          (error: unknown): QueryInvalidationFailure => ({
            actionOwner,
            queryKey,
            error,
          }),
        ),
    ),
  ).then((results) => {
    const failures = results.filter((result): result is QueryInvalidationFailure => result !== null);
    if (failures.length > 0) {
      queryInvalidationFailureReporter(failures);
    }
  });
}

export function invalidateFeedQueries(
  queryClient: QueryClient,
  options: InvalidateFeedQueriesOptions & InvalidateQueryKeysLogOnlyOptions = {},
) {
  invalidateQueryKeysLogOnly(queryClient, resolveFeedInvalidationQueryKeys(options), options);
}

export function invalidateArticleQueries(
  queryClient: QueryClient,
  options: InvalidateArticleQueriesOptions & InvalidateQueryKeysLogOnlyOptions = {},
) {
  invalidateQueryKeysLogOnly(queryClient, resolveArticleInvalidationQueryKeys(options), options);
}

function invalidateFeedMutationQueries(
  queryClient: QueryClient,
  actionOwner: Extract<QueryInvalidationActionOwner, "add-feed" | "delete-feed">,
  options: InvalidateFeedMutationQueriesOptions = {},
) {
  invalidateQueryKeysLogOnly(queryClient, resolveFeedMutationInvalidationQueryKeys(actionOwner, options), {
    actionOwner,
  });
}

export function invalidateAddFeedQueries(queryClient: QueryClient, options: InvalidateFeedMutationQueriesOptions = {}) {
  invalidateFeedMutationQueries(queryClient, "add-feed", options);
}

export function invalidateDeleteFeedQueries(
  queryClient: QueryClient,
  options: InvalidateFeedMutationQueriesOptions = {},
) {
  invalidateFeedMutationQueries(queryClient, "delete-feed", options);
}

export function invalidateSyncCompletedQueries(
  queryClient: QueryClient,
  options: InvalidateSyncCompletedQueriesOptions = {},
) {
  const actionOwner = options.actionOwner ?? "background-sync-completed";

  invalidateFeedQueries(queryClient, {
    actionOwner,
    includeAccountUnreadCount: true,
  });
  invalidateArticleQueries(queryClient, {
    actionOwner,
    includeAccountUnreadCount: false,
    includeFeeds: false,
    includeFeedIntegrityReport: true,
    includeTagArticleCounts: true,
  });
}

export type {
  InvalidateArticleQueriesOptions,
  InvalidateFeedQueriesOptions,
  QueryInvalidationActionOwner,
  QueryInvalidationFailure,
};
