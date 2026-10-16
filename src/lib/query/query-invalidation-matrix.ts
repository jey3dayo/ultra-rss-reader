// Invalidation option types and the feed/article/intent invalidation matrices.
import type { QueryKey } from "@tanstack/react-query";
import type { QueryInvalidationKey } from "./query-keys";
import { queryKeys } from "./query-keys";

export type InvalidateFeedQueriesOptions = {
  includeFeeds?: boolean;
  includeFolders?: boolean;
  includeAccountUnreadCount?: boolean;
  includeLocalFeedSyncStatuses?: boolean;
};

export type InvalidateArticleQueriesOptions = {
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

export type QueryInvalidationActionOwner =
  | "account-deletion"
  | "account-setup"
  | "account-sync-now"
  | "add-feed"
  | "article-mutation"
  | "background-sync-completed"
  | "delete-feed"
  | "feed-display-update"
  | "feed-edit"
  | "feed-folder-move"
  | "feed-sync-retry"
  | "local-account-sync-import"
  | "manual-sync-completed"
  | "mute-keyword-mutation"
  | "opml-import"
  | "tag-mutation"
  | "unknown";
export type QueryInvalidationFailure = {
  actionOwner: QueryInvalidationActionOwner;
  queryKey: QueryKey;
  error: unknown;
};

export type InvalidateQueryKeysLogOnlyOptions = {
  actionOwner?: QueryInvalidationActionOwner;
  throwOnError?: boolean;
};

export type InvalidateFeedMutationQueriesOptions = {
  accountId?: string | null;
};

export type InvalidateSyncCompletedQueriesOptions = {
  actionOwner?: Extract<QueryInvalidationActionOwner, "background-sync-completed" | "manual-sync-completed">;
};

export type FeedMutationInvalidationOwnerMatrixEntry = {
  feedOptions: InvalidateFeedQueriesOptions;
  articleOptions: InvalidateArticleQueriesOptions;
  includeAccountScopedFeedArticleSummaries: boolean;
};

export type ArticleMutationInvalidationKind =
  | "article-read"
  | "article-star"
  | "article-view-recorded"
  | "mute-keyword"
  | "tag-article-assignment"
  | "tag-metadata";

export type ArticleMutationInvalidationMatrixEntry = {
  actionOwner: Extract<QueryInvalidationActionOwner, "article-mutation" | "mute-keyword-mutation" | "tag-mutation">;
  queryKeys: ReadonlyArray<QueryInvalidationKey>;
};

export type QueryInvalidationIntent =
  | "account-deleted-articles"
  | "account-setup-articles"
  | "account-sync-now-articles"
  | "feed-edit-changed"
  | "feed-edit-no-change"
  | "feed-root-updated"
  | "local-account-sync-imported";

export type QueryInvalidationIntentMatrixEntry = {
  actionOwner: QueryInvalidationActionOwner;
  queryKeys: ReadonlyArray<QueryInvalidationKey>;
};
export type InvalidationTarget<TOption extends string> = {
  option: TOption;
  defaultEnabled: boolean;
  queryKeys: ReadonlyArray<QueryInvalidationKey>;
};

export const FEED_INVALIDATION_TARGETS = [
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
  {
    option: "includeLocalFeedSyncStatuses",
    defaultEnabled: false,
    queryKeys: [queryKeys.localFeedSyncStatuses.root],
  },
] as const satisfies ReadonlyArray<InvalidationTarget<keyof InvalidateFeedQueriesOptions>>;

export const ARTICLE_INVALIDATION_TARGETS = [
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

export const FEED_MUTATION_INVALIDATION_OWNER_MATRIX = {
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

export const ARTICLE_MUTATION_INVALIDATION_MATRIX = {
  "article-read": {
    actionOwner: "article-mutation",
    queryKeys: [
      queryKeys.articles.root,
      queryKeys.accountArticles.root,
      queryKeys.folderArticles.root,
      queryKeys.starredArticles.root,
      queryKeys.accountUnreadCount.root,
      queryKeys.feeds.root,
      queryKeys.articlesByTag.root,
      queryKeys.tagArticleCounts.root,
      queryKeys.search.root,
      queryKeys.recentArticles.root,
      queryKeys.feedArticleSummaries.root,
    ],
  },
  "article-star": {
    actionOwner: "article-mutation",
    queryKeys: [
      queryKeys.articles.root,
      queryKeys.accountArticles.root,
      queryKeys.folderArticles.root,
      queryKeys.starredArticles.root,
      queryKeys.accountStarredCount.root,
      queryKeys.articlesByTag.root,
      queryKeys.search.root,
      queryKeys.recentArticles.root,
      queryKeys.feedArticleSummaries.root,
    ],
  },
  "article-view-recorded": {
    actionOwner: "article-mutation",
    queryKeys: [queryKeys.recentArticles.root, queryKeys.feedArticleSummaries.root],
  },
  "mute-keyword": {
    actionOwner: "mute-keyword-mutation",
    queryKeys: [
      queryKeys.articles.root,
      queryKeys.accountArticles.root,
      queryKeys.folderArticles.root,
      queryKeys.starredArticles.root,
      queryKeys.accountUnreadCount.root,
      queryKeys.accountStarredCount.root,
      queryKeys.feeds.root,
      queryKeys.articlesByTag.root,
      queryKeys.tagArticleCounts.root,
      queryKeys.search.root,
      queryKeys.recentArticles.root,
      queryKeys.feedArticleSummaries.root,
    ],
  },
  "tag-article-assignment": {
    actionOwner: "tag-mutation",
    queryKeys: [
      queryKeys.articles.root,
      queryKeys.accountArticles.root,
      queryKeys.folderArticles.root,
      queryKeys.starredArticles.root,
      queryKeys.accountUnreadCount.root,
      queryKeys.accountStarredCount.root,
      queryKeys.feeds.root,
      queryKeys.search.root,
      queryKeys.recentArticles.root,
      queryKeys.feedArticleSummaries.root,
    ],
  },
  "tag-metadata": {
    actionOwner: "tag-mutation",
    queryKeys: [queryKeys.articlesByTag.root, queryKeys.tagArticleCounts.root],
  },
} as const satisfies Record<ArticleMutationInvalidationKind, ArticleMutationInvalidationMatrixEntry>;

export const QUERY_INVALIDATION_INTENT_MATRIX: Record<QueryInvalidationIntent, QueryInvalidationIntentMatrixEntry> = {
  "account-deleted-articles": {
    actionOwner: "account-deletion",
    queryKeys: [
      queryKeys.feeds.root,
      queryKeys.articles.root,
      queryKeys.accountArticles.root,
      queryKeys.folderArticles.root,
      queryKeys.starredArticles.root,
      queryKeys.accountUnreadCount.root,
      queryKeys.accountStarredCount.root,
      queryKeys.articlesByTag.root,
      queryKeys.tagArticleCounts.root,
      queryKeys.search.root,
      queryKeys.recentArticles.root,
      queryKeys.feedArticleSummaries.root,
    ],
  },
  "account-setup-articles": {
    actionOwner: "account-setup",
    queryKeys: [
      queryKeys.feeds.root,
      queryKeys.articles.root,
      queryKeys.accountArticles.root,
      queryKeys.folderArticles.root,
      queryKeys.starredArticles.root,
      queryKeys.accountUnreadCount.root,
      queryKeys.accountStarredCount.root,
      queryKeys.articlesByTag.root,
      queryKeys.search.root,
      queryKeys.recentArticles.root,
      queryKeys.feedArticleSummaries.root,
    ],
  },
  "account-sync-now-articles": {
    actionOwner: "account-sync-now",
    queryKeys: [queryKeys.feeds.root, queryKeys.articles.root, queryKeys.localFeedSyncStatuses.root],
  },
  "feed-edit-changed": {
    actionOwner: "feed-edit",
    queryKeys: [queryKeys.feeds.root, queryKeys.folders.root],
  },
  "feed-edit-no-change": {
    actionOwner: "feed-edit",
    queryKeys: [queryKeys.folders.root],
  },
  "feed-root-updated": {
    actionOwner: "feed-display-update",
    queryKeys: [queryKeys.feeds.root],
  },
  "local-account-sync-imported": {
    actionOwner: "local-account-sync-import",
    queryKeys: [
      queryKeys.articles.root,
      queryKeys.accountArticles.root,
      queryKeys.folderArticles.root,
      queryKeys.starredArticles.root,
      queryKeys.accountUnreadCount.root,
      queryKeys.accountStarredCount.root,
      queryKeys.articlesByTag.root,
      queryKeys.tagArticleCounts.root,
      queryKeys.search.root,
      queryKeys.recentArticles.root,
      queryKeys.feedArticleSummaries.root,
    ],
  },
};
