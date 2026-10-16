import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { logRuntimeDiagnostic } from "@/lib/runtime/diagnostics";
import type {
  ArticleMutationInvalidationKind,
  InvalidateArticleQueriesOptions,
  InvalidateFeedMutationQueriesOptions,
  InvalidateFeedQueriesOptions,
  InvalidateQueryKeysLogOnlyOptions,
  InvalidateSyncCompletedQueriesOptions,
  InvalidationTarget,
  QueryInvalidationActionOwner,
  QueryInvalidationFailure,
  QueryInvalidationIntent,
} from "./query-invalidation-matrix";
import {
  ARTICLE_INVALIDATION_TARGETS,
  ARTICLE_MUTATION_INVALIDATION_MATRIX,
  FEED_INVALIDATION_TARGETS,
  FEED_MUTATION_INVALIDATION_OWNER_MATRIX,
  QUERY_INVALIDATION_INTENT_MATRIX,
} from "./query-invalidation-matrix";
import type { QueryInvalidationKey } from "./query-keys";
import { queryKeys } from "./query-keys";

export {
  ARTICLE_CACHE_QUERY_ROOTS,
  getQueryKeyRootName,
  getQueryKeyScopeValue,
  getReaderArticleQueryMode,
  normalizeQueryAccountId,
  QUERY_KEY_ROOTS,
  queryKeys,
} from "./query-keys";

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
  return ARTICLE_MUTATION_INVALIDATION_MATRIX[kind].queryKeys;
}

function resolveQueryInvalidationIntentQueryKeys(intent: QueryInvalidationIntent): ReadonlyArray<QueryInvalidationKey> {
  return QUERY_INVALIDATION_INTENT_MATRIX[intent].queryKeys;
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

  invalidateQueryKeysLogOnly(queryClient, matrixEntry.queryKeys, {
    actionOwner: matrixEntry.actionOwner,
  });
}

export function invalidateQueryKeysLogOnly(
  queryClient: QueryClient,
  queryKeys: ReadonlyArray<QueryKey>,
  options: InvalidateQueryKeysLogOnlyOptions = {},
): Promise<boolean> {
  const actionOwner = options.actionOwner ?? "unknown";

  return Promise.all(
    queryKeys.map((queryKey) =>
      (options.throwOnError
        ? queryClient.invalidateQueries({ queryKey }, { throwOnError: true })
        : queryClient.invalidateQueries({ queryKey })
      )
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
    return failures.length === 0;
  });
}

export function invalidateFeedRetryQueries(queryClient: QueryClient, accountId: string, feedId: string) {
  return invalidateQueryKeysLogOnly(
    queryClient,
    [
      queryKeys.localFeedSyncStatuses.byAccount(accountId),
      queryKeys.feeds.byAccount(accountId),
      queryKeys.feedArticleSummaries.byAccount(accountId),
      queryKeys.accountArticles.byAccountPrefix(accountId),
      queryKeys.articles.byFeed(feedId, "all"),
    ],
    { actionOwner: "feed-sync-retry", throwOnError: true },
  );
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

function invalidateQueryIntent(queryClient: QueryClient, intent: QueryInvalidationIntent) {
  const matrixEntry = QUERY_INVALIDATION_INTENT_MATRIX[intent];

  invalidateQueryKeysLogOnly(queryClient, resolveQueryInvalidationIntentQueryKeys(intent), {
    actionOwner: matrixEntry.actionOwner,
  });
}

export function invalidateFeedRootQueries(
  queryClient: QueryClient,
  actionOwner: Extract<QueryInvalidationActionOwner, "feed-display-update" | "feed-folder-move">,
) {
  const matrixEntry = QUERY_INVALIDATION_INTENT_MATRIX["feed-root-updated"];

  invalidateQueryKeysLogOnly(queryClient, matrixEntry.queryKeys, { actionOwner });
}

export function invalidateFeedEditQueries(queryClient: QueryClient, feedsChanged: boolean) {
  invalidateQueryIntent(queryClient, feedsChanged ? "feed-edit-changed" : "feed-edit-no-change");
}

export function invalidateAccountSetupQueries(queryClient: QueryClient) {
  invalidateQueryIntent(queryClient, "account-setup-articles");
}

export function invalidateAccountSyncNowQueries(queryClient: QueryClient) {
  invalidateQueryIntent(queryClient, "account-sync-now-articles");
}

export function invalidateLocalAccountSyncImportArticleQueries(queryClient: QueryClient) {
  invalidateQueryIntent(queryClient, "local-account-sync-imported");
}

export function invalidateAccountDeletionQueries(queryClient: QueryClient) {
  invalidateQueryIntent(queryClient, "account-deleted-articles");
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

export function invalidateOpmlImportQueries(queryClient: QueryClient) {
  invalidateFeedQueries(queryClient, { actionOwner: "opml-import" });
}

export function invalidateSyncCompletedQueries(
  queryClient: QueryClient,
  options: InvalidateSyncCompletedQueriesOptions = {},
) {
  const actionOwner = options.actionOwner ?? "background-sync-completed";

  invalidateFeedQueries(queryClient, {
    actionOwner,
    includeAccountUnreadCount: true,
    includeLocalFeedSyncStatuses: true,
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
