import { Result } from "@praha/byethrow";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import {
  type ArticleDto,
  clearArticleViewHistory,
  countAccountStarredArticles,
  getArticle,
  listAccountArticles,
  listArticles,
  listFeedStarredArticles,
  listFolderArticles,
  listRecentArticles,
  listStarredArticles,
  markAccountRead,
  markAccountStarredRead,
  markArticleRead,
  markArticlesRead,
  markFeedRead,
  markFolderRead,
  markOldUnreadRead,
  type OldUnreadDays,
  type OldUnreadScopeKind,
  recordArticleView,
  searchArticles,
  toggleArticleStar,
  unstarAccountArticles,
} from "@/api/tauri-commands";
import { createMutation } from "@/hooks/create-mutation";
import { createQuery } from "@/hooks/create-query";
import {
  ARTICLE_CACHE_QUERY_ROOTS,
  getReaderArticleQueryMode,
  invalidateArticleMutationQueries,
  invalidateArticleQueries,
  invalidateQueryKeysLogOnly,
  normalizeQueryAccountId,
  queryKeys,
  resolveArticleInvalidationQueryKeys,
} from "@/lib/query/query-invalidation";
import type { ReaderFilter } from "@/lib/reader/reader-query";
import { useUiStore } from "@/stores/ui-store";

export type SetReadMutationInput = {
  id: string;
  read: boolean;
};

export type ToggleStarMutationInput = {
  id: string;
  starred: boolean;
};

export type RecordArticleViewMutationInput = {
  accountId: string;
  articleId: string;
};

export type MarkOldUnreadReadMutationInput = {
  scopeKind: OldUnreadScopeKind;
  targetId: string;
  olderThanDays: OldUnreadDays;
};

type ArticleQueryOptions = {
  mode?: ReaderFilter;
  unreadOnly?: boolean;
};

export type ArticleSearchQueryOwner = {
  accountId: string;
  query: string;
  key: string;
};

type CachedArticleInsertOptions = {
  insertIfMissing: boolean;
};

const ARTICLE_SEARCH_QUERY_MAX_LENGTH = 128;
const ARTICLE_SEARCH_QUERY_WHITESPACE_PATTERN = /\s+/gu;
const READER_FILTERS = ["all", "unread", "starred"] as const satisfies readonly ReaderFilter[];

function resolveArticleQueryMode(options?: ArticleQueryOptions): ReaderFilter {
  if (options?.mode) {
    return options.mode;
  }

  return options?.unreadOnly ? "unread" : "all";
}

function requireEnabledQueryValue(value: string | null, label: string): string {
  if (!value) {
    throw new Error(`${label} is required when the query is enabled.`);
  }

  return value;
}

function normalizeManualArticleQueryId(value: string | null): string | null {
  return normalizeQueryAccountId(value);
}

export function normalizeArticleSearchQuery(query: string): string {
  return Array.from(query.normalize("NFKC").replace(ARTICLE_SEARCH_QUERY_WHITESPACE_PATTERN, " ").trim())
    .slice(0, ARTICLE_SEARCH_QUERY_MAX_LENGTH)
    .join("");
}

export function resolveArticleSearchQueryOwner(
  accountId: string | null,
  query: string,
): ArticleSearchQueryOwner | null {
  const normalizedAccountId = normalizeQueryAccountId(accountId);
  const normalizedQuery = normalizeArticleSearchQuery(query);

  if (normalizedAccountId === null || normalizedQuery.length === 0) {
    return null;
  }

  return {
    accountId: normalizedAccountId,
    query: normalizedQuery,
    key: `${normalizedAccountId}\0${normalizedQuery}`,
  };
}

function patchCachedArticleState(
  qc: QueryClient,
  articleId: string,
  resolveNextArticle: (article: ArticleDto) => ArticleDto,
) {
  const cachedArticle = findCachedArticle(qc, articleId);
  if (cachedArticle === null) {
    return;
  }

  const nextArticle = resolveNextArticle(cachedArticle);
  const accountIds = resolveAccountIdsForArticle(qc, cachedArticle);

  qc.setQueryData(queryKeys.articles.byId(articleId), nextArticle);
  patchArticleListQueries(qc, nextArticle, { insertIfMissing: false });

  if (accountIds.length > 0) {
    for (const accountId of accountIds) {
      patchKnownAccountArticleCaches(qc, accountId, nextArticle);
    }
    return;
  }

  patchUnknownAccountArticleCaches(qc, nextArticle);
}

function patchCachedArticleReadState(qc: QueryClient, articleId: string, read: boolean) {
  patchCachedArticleState(qc, articleId, (cachedArticle) => ({ ...cachedArticle, is_read: read }));
}

export function resolveArticleMutationInvalidationQueryKeys() {
  return resolveArticleInvalidationQueryKeys({ includeTagArticleCounts: true });
}

function isArticleDto(candidate: unknown): candidate is ArticleDto {
  return (
    !!candidate &&
    typeof candidate === "object" &&
    "id" in candidate &&
    "is_read" in candidate &&
    "is_starred" in candidate
  );
}

function indexArticleDtosById(data: unknown): Map<string, ArticleDto> {
  const articlesById = new Map<string, ArticleDto>();
  if (!Array.isArray(data)) {
    return articlesById;
  }

  for (const candidate of data) {
    if (isArticleDto(candidate) && !articlesById.has(candidate.id)) {
      articlesById.set(candidate.id, candidate);
    }
  }

  return articlesById;
}

function findCachedArticle(qc: QueryClient, articleId: string): ArticleDto | null {
  for (const queryKey of ARTICLE_CACHE_QUERY_ROOTS) {
    const matches = qc.getQueriesData<unknown>({ queryKey });
    for (const [, data] of matches) {
      const article = indexArticleDtosById(data).get(articleId);
      if (article) {
        return article;
      }
    }
  }

  return null;
}

function indexFeedAccountIdsByFeedId(data: unknown): Map<string, string> {
  const accountIdsByFeedId = new Map<string, string>();
  if (!Array.isArray(data)) {
    return accountIdsByFeedId;
  }

  for (const candidate of data) {
    if (
      candidate &&
      typeof candidate === "object" &&
      "id" in candidate &&
      typeof candidate.id === "string" &&
      "account_id" in candidate &&
      typeof candidate.account_id === "string" &&
      !accountIdsByFeedId.has(candidate.id)
    ) {
      accountIdsByFeedId.set(candidate.id, candidate.account_id);
    }
  }

  return accountIdsByFeedId;
}

function resolveArticleAccountIdFromScopedQuery(queryKey: QueryKey, data: unknown, articleId: string): string | null {
  const accountId = queryKey[2];
  if (typeof accountId !== "string" || !indexArticleDtosById(data).has(articleId)) {
    return null;
  }

  return accountId;
}

function resolveAccountIdsForArticle(qc: QueryClient, article: ArticleDto): string[] {
  const accountIds = new Set<string>();

  for (const [, data] of qc.getQueriesData<unknown>({
    queryKey: queryKeys.feeds.root,
  })) {
    const accountId = indexFeedAccountIdsByFeedId(data).get(article.feed_id);
    if (accountId) {
      accountIds.add(accountId);
    }
  }

  for (const [queryKey, data] of qc.getQueriesData<unknown>({
    queryKey: queryKeys.accountArticles.root,
  })) {
    const accountId = resolveArticleAccountIdFromScopedQuery(queryKey, data, article.id);
    if (accountId) {
      accountIds.add(accountId);
    }
  }

  for (const [queryKey, data] of qc.getQueriesData<unknown>({
    queryKey: queryKeys.starredArticles.root,
  })) {
    const accountId = resolveArticleAccountIdFromScopedQuery(queryKey, data, article.id);
    if (accountId) {
      accountIds.add(accountId);
    }
  }

  return Array.from(accountIds);
}

function isAccountKnownDeleted(qc: QueryClient, accountId: string): boolean {
  const accounts = qc.getQueryData<unknown>(queryKeys.accounts.root);
  if (!Array.isArray(accounts)) {
    return false;
  }

  return !accounts.some(
    (account): account is { id: string } =>
      typeof account === "object" &&
      account !== null &&
      "id" in account &&
      typeof account.id === "string" &&
      account.id === accountId,
  );
}

function isArticleKnownDeletedFromScopedCache(qc: QueryClient, accountId: string, articleId: string): boolean {
  const scopedArticleQueries = [
    ...qc.getQueriesData<unknown>({ queryKey: queryKeys.accountArticles.byAccountPrefix(accountId) }),
    ...qc.getQueriesData<unknown>({ queryKey: queryKeys.recentArticles.byAccount(accountId, "all").slice(0, 3) }),
    ...qc.getQueriesData<unknown>({ queryKey: queryKeys.starredArticles.byAccount(accountId) }),
  ];

  let sawScopedArticleList = false;
  for (const [, data] of scopedArticleQueries) {
    const articles = indexArticleDtosById(data);
    if (articles.size === 0) {
      continue;
    }
    sawScopedArticleList = true;
    if (articles.has(articleId)) {
      return false;
    }
  }

  return sawScopedArticleList;
}

function shouldInvalidateAfterRecordArticleView(qc: QueryClient, accountId: string, articleId: string): boolean {
  if (isAccountKnownDeleted(qc, accountId)) {
    return false;
  }

  return !isArticleKnownDeletedFromScopedCache(qc, accountId, articleId);
}

function getRecentArticleQueryKeysForAccount(accountId: string) {
  return READER_FILTERS.map((mode) => queryKeys.recentArticles.byAccount(accountId, mode));
}

function shouldKeepArticleInQuery(queryKey: QueryKey, nextArticle: ArticleDto): boolean {
  const mode = getReaderArticleQueryMode(queryKey);

  if (mode === "unread" && nextArticle.is_read) {
    return false;
  }

  if (mode === "starred" && !nextArticle.is_starred) {
    return false;
  }

  return true;
}

function updateCachedArticleArray(
  current: unknown,
  nextArticle: ArticleDto,
  options?: { insertIfMissing?: boolean; queryKey?: QueryKey },
) {
  const shouldKeepArticle = options?.queryKey ? shouldKeepArticleInQuery(options.queryKey, nextArticle) : true;

  if (!Array.isArray(current)) {
    return options?.insertIfMissing && shouldKeepArticle ? [nextArticle] : current;
  }

  let found = false;
  const nextArray = current.flatMap((candidate) => {
    if (isArticleDto(candidate) && candidate.id === nextArticle.id) {
      found = true;
      return shouldKeepArticle ? [nextArticle] : [];
    }

    return [candidate];
  });

  if (!found && options?.insertIfMissing && shouldKeepArticle) {
    return [nextArticle, ...nextArray];
  }

  return nextArray;
}

function shouldInsertMissingAccountArticle(queryKey: QueryKey, nextArticle: ArticleDto): boolean {
  return shouldKeepArticleInQuery(queryKey, nextArticle);
}

function updateCachedStarredArticleArray(
  current: unknown,
  nextArticle: ArticleDto,
  options: CachedArticleInsertOptions,
) {
  if (!Array.isArray(current)) {
    if (nextArticle.is_starred) {
      return options.insertIfMissing ? [nextArticle] : current;
    }

    return options.insertIfMissing ? [] : current;
  }

  const starredArticles = current.filter(isArticleDto);
  const hasArticle = starredArticles.some((article) => article.id === nextArticle.id);

  if (!nextArticle.is_starred) {
    return starredArticles.filter((article) => article.id !== nextArticle.id);
  }

  if (hasArticle) {
    return starredArticles.map((article) => (article.id === nextArticle.id ? nextArticle : article));
  }

  return options.insertIfMissing ? [nextArticle, ...starredArticles] : starredArticles;
}

function patchKnownAccountArticleCaches(qc: QueryClient, accountId: string, nextArticle: ArticleDto) {
  const accountArticleQueries = qc.getQueriesData<unknown>({
    queryKey: queryKeys.accountArticles.byAccountPrefix(accountId),
  });

  if (accountArticleQueries.length === 0) {
    qc.setQueryData(queryKeys.accountArticles.byAccount(accountId, "all"), [nextArticle]);
  } else {
    for (const [queryKey] of accountArticleQueries) {
      qc.setQueryData(queryKey, (current: unknown) =>
        updateCachedArticleArray(current, nextArticle, {
          insertIfMissing: shouldInsertMissingAccountArticle(queryKey, nextArticle),
          queryKey,
        }),
      );
    }
  }

  qc.setQueryData(queryKeys.starredArticles.byAccount(accountId), (current: unknown) =>
    updateCachedStarredArticleArray(current, nextArticle, { insertIfMissing: true }),
  );
}

function patchUnknownAccountArticleCaches(qc: QueryClient, nextArticle: ArticleDto) {
  for (const [queryKey] of qc.getQueriesData<unknown>({ queryKey: queryKeys.accountArticles.root })) {
    qc.setQueryData(queryKey, (current: unknown) =>
      updateCachedArticleArray(current, nextArticle, { insertIfMissing: false, queryKey }),
    );
  }
  qc.setQueriesData({ queryKey: queryKeys.starredArticles.root }, (current: unknown) =>
    updateCachedStarredArticleArray(current, nextArticle, { insertIfMissing: false }),
  );
}

function patchArticleListQueries(qc: QueryClient, nextArticle: ArticleDto, options: CachedArticleInsertOptions) {
  for (const queryRoot of [
    queryKeys.articles.root,
    queryKeys.folderArticles.root,
    queryKeys.articlesByTag.root,
    queryKeys.search.root,
    queryKeys.recentArticles.root,
  ] as const) {
    for (const [queryKey] of qc.getQueriesData<unknown>({ queryKey: queryRoot })) {
      qc.setQueryData(queryKey, (current: unknown) =>
        updateCachedArticleArray(current, nextArticle, {
          insertIfMissing: options.insertIfMissing,
          queryKey,
        }),
      );
    }
  }
}

function patchCachedArticleStarState(qc: QueryClient, articleId: string, starred: boolean) {
  patchCachedArticleState(qc, articleId, (cachedArticle) => ({ ...cachedArticle, is_starred: starred }));
}

export function useArticles(feedId: string | null, options?: ArticleQueryOptions) {
  const mode = resolveArticleQueryMode(options);
  const normalizedFeedId = normalizeManualArticleQueryId(feedId);

  return useQuery({
    queryKey: queryKeys.articles.byFeed(normalizedFeedId, mode),
    queryFn: () => {
      const resolvedFeedId = requireEnabledQueryValue(normalizedFeedId, "feedId");
      return (
        mode === "starred" ? listFeedStarredArticles(resolvedFeedId) : listArticles(resolvedFeedId, mode === "unread")
      ).then(Result.unwrap());
    },
    enabled: !!normalizedFeedId,
  });
}

export function useArticle(articleId: string | null) {
  const normalizedArticleId = normalizeManualArticleQueryId(articleId);

  return useQuery({
    queryKey: queryKeys.articles.byId(normalizedArticleId),
    queryFn: () => getArticle(requireEnabledQueryValue(normalizedArticleId, "articleId")).then(Result.unwrap()),
    enabled: !!normalizedArticleId,
  });
}

export function useAccountArticles(accountId: string | null, options?: ArticleQueryOptions) {
  const mode = resolveArticleQueryMode(options);
  const normalizedAccountId = normalizeManualArticleQueryId(accountId);

  return useQuery({
    queryKey: queryKeys.accountArticles.byAccount(normalizedAccountId, mode),
    queryFn: () => {
      const resolvedAccountId = requireEnabledQueryValue(normalizedAccountId, "accountId");
      return (
        mode === "starred"
          ? listStarredArticles(resolvedAccountId)
          : listAccountArticles(resolvedAccountId, mode === "unread")
      ).then(Result.unwrap());
    },
    enabled: !!normalizedAccountId,
  });
}

export function useFolderArticles(folderId: string | null, options?: { mode?: ReaderFilter }) {
  const mode = options?.mode ?? "all";
  const normalizedFolderId = normalizeManualArticleQueryId(folderId);

  return useQuery({
    queryKey: queryKeys.folderArticles.byFolder(normalizedFolderId, mode),
    queryFn: () =>
      listFolderArticles(requireEnabledQueryValue(normalizedFolderId, "folderId"), mode).then(Result.unwrap()),
    enabled: !!normalizedFolderId,
  });
}

export const useStarredArticles = createQuery(queryKeys.starredArticles.root, listStarredArticles);

export function useRecentArticles(accountId: string | null, options?: { mode?: ReaderFilter }) {
  const mode = options?.mode ?? "all";
  const normalizedAccountId = normalizeManualArticleQueryId(accountId);

  return useQuery({
    queryKey: queryKeys.recentArticles.byAccount(normalizedAccountId, mode),
    queryFn: () =>
      listRecentArticles(requireEnabledQueryValue(normalizedAccountId, "accountId"), undefined, undefined, mode).then(
        Result.unwrap(),
      ),
    enabled: !!normalizedAccountId,
  });
}

export function useAccountStarredCount(accountId: string | null) {
  const normalizedAccountId = normalizeManualArticleQueryId(accountId);

  return useQuery({
    queryKey: queryKeys.accountStarredCount.byAccount(normalizedAccountId),
    queryFn: () =>
      countAccountStarredArticles(requireEnabledQueryValue(normalizedAccountId, "accountId")).then(Result.unwrap()),
    enabled: !!normalizedAccountId,
  });
}

export function useSetRead() {
  const qc = useQueryClient();
  const latestRequestIdsRef = useRef(new Map<string, number>());
  const nextRequestIdRef = useRef(0);

  return useMutation({
    mutationFn: ({ id, read }: SetReadMutationInput) => markArticleRead(id, read).then(Result.unwrap()),
    onMutate: (variables) => {
      const requestId = nextRequestIdRef.current + 1;
      nextRequestIdRef.current = requestId;
      latestRequestIdsRef.current.set(variables.id, requestId);
      return { requestId };
    },
    onSuccess: (_data, variables, context) => {
      if (latestRequestIdsRef.current.get(variables.id) === context.requestId) {
        patchCachedArticleReadState(qc, variables.id, variables.read);
      }
      invalidateArticleMutationQueries(qc, "article-read");
    },
  });
}

export const useMarkAllRead = createMutation(
  (articleIds: string[]) => markArticlesRead(articleIds),
  (qc) => invalidateArticleMutationQueries(qc, "article-read"),
);

export const useMarkAccountRead = createMutation(markAccountRead, (qc) =>
  invalidateArticleMutationQueries(qc, "article-read"),
);

export const useMarkAccountStarredRead = createMutation(markAccountStarredRead, (qc) =>
  invalidateArticleMutationQueries(qc, "article-read"),
);

export const useMarkOldUnreadRead = createMutation(
  ({ scopeKind, targetId, olderThanDays }: MarkOldUnreadReadMutationInput) =>
    markOldUnreadRead(scopeKind, targetId, olderThanDays),
  (qc) => invalidateArticleMutationQueries(qc, "article-read"),
);

export const useUnstarAccountArticles = createMutation(unstarAccountArticles, (qc) =>
  invalidateArticleMutationQueries(qc, "article-star"),
);

export function useRecordArticleView() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ accountId, articleId }: RecordArticleViewMutationInput) => {
      const normalizedAccountId = normalizeManualArticleQueryId(accountId);
      const normalizedArticleId = normalizeManualArticleQueryId(articleId);

      if (!normalizedAccountId || !normalizedArticleId) {
        return Promise.resolve(null);
      }

      return recordArticleView(normalizedAccountId, normalizedArticleId).then((result) => Result.unwrap(result));
    },
    onSuccess: (_data, variables) => {
      const normalizedAccountId = normalizeManualArticleQueryId(variables.accountId);
      const normalizedArticleId = normalizeManualArticleQueryId(variables.articleId);

      if (
        !normalizedAccountId ||
        !normalizedArticleId ||
        !shouldInvalidateAfterRecordArticleView(qc, normalizedAccountId, normalizedArticleId)
      ) {
        return;
      }

      invalidateArticleQueries(qc, {
        actionOwner: "article-mutation",
        includeAccountArticles: false,
        includeStarredArticles: false,
        includeAccountUnreadCount: false,
        includeAccountStarredCount: false,
        includeFeeds: false,
        includeArticles: false,
        includeArticlesByTag: false,
        includeSearch: false,
        includeRecentArticles: true,
      });
    },
  });
}

export function useClearArticleViewHistory() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (accountId: string) => {
      const normalizedAccountId = normalizeManualArticleQueryId(accountId);

      if (!normalizedAccountId || isAccountKnownDeleted(qc, normalizedAccountId)) {
        return Promise.resolve(0);
      }

      return clearArticleViewHistory(normalizedAccountId).then((result) => Result.unwrap(result));
    },
    onMutate: async (accountId) => {
      const normalizedAccountId = normalizeManualArticleQueryId(accountId);
      if (!normalizedAccountId) {
        return;
      }

      const recentArticleQueryKeys = getRecentArticleQueryKeysForAccount(normalizedAccountId);
      await Promise.all(recentArticleQueryKeys.map((queryKey) => qc.cancelQueries({ queryKey })));
      for (const queryKey of recentArticleQueryKeys) {
        qc.setQueryData(queryKey, []);
      }
    },
    onSuccess: (_data, accountId) => {
      const normalizedAccountId = normalizeManualArticleQueryId(accountId);
      if (!normalizedAccountId || isAccountKnownDeleted(qc, normalizedAccountId)) {
        return;
      }

      invalidateQueryKeysLogOnly(qc, getRecentArticleQueryKeysForAccount(normalizedAccountId), {
        actionOwner: "article-mutation",
      });
    },
  });
}

// Single-pass bulk variant of patchCachedArticleReadState: bulk mark-read never
// needs insertIfMissing, so one sweep over the cached list queries stays O(queries
// × articles) instead of O(ids × queries × articles) for large folders.
function patchCachedArticlesMarkedRead(qc: QueryClient, markedArticleIds: ReadonlySet<string>) {
  for (const queryRoot of ARTICLE_CACHE_QUERY_ROOTS) {
    for (const [queryKey, data] of qc.getQueriesData<unknown>({ queryKey: queryRoot })) {
      if (!Array.isArray(data)) {
        continue;
      }

      let changed = false;
      const nextData = data.flatMap((candidate) => {
        if (!isArticleDto(candidate) || !markedArticleIds.has(candidate.id) || candidate.is_read) {
          return [candidate];
        }

        changed = true;
        const nextArticle = { ...candidate, is_read: true };
        return shouldKeepArticleInQuery(queryKey, nextArticle) ? [nextArticle] : [];
      });

      if (changed) {
        qc.setQueryData(queryKey, nextData);
      }
    }
  }

  for (const articleId of markedArticleIds) {
    qc.setQueryData(queryKeys.articles.byId(articleId), (current: ArticleDto | undefined) =>
      current === undefined ? undefined : { ...current, is_read: true },
    );
  }
}

function patchMarkedArticlesReadAndInvalidate(qc: QueryClient, markedArticleIds: readonly string[]) {
  // In the unread view, keep bulk-read rows visible (dot cleared, row retained)
  // to match the single-article read-in-place behavior. The retention snapshot
  // resolves the retained DTOs from the always-mounted "all"-mode list caches,
  // which keep the patched articles after unread-mode caches drop them.
  const { viewMode, retainArticles } = useUiStore.getState();
  if (viewMode === "unread") {
    retainArticles(markedArticleIds);
  }

  // Patch cached lists synchronously so unread dots clear even when the
  // background refetch is slow or fails; invalidation stays the durable sync path.
  patchCachedArticlesMarkedRead(qc, new Set(markedArticleIds));
  invalidateArticleMutationQueries(qc, "article-read");
}

export const useMarkFeedRead = createMutation(markFeedRead, (qc, _feedId, markedArticleIds) =>
  patchMarkedArticlesReadAndInvalidate(qc, markedArticleIds),
);

export const useMarkFolderRead = createMutation(markFolderRead, (qc, _folderId, markedArticleIds) =>
  patchMarkedArticlesReadAndInvalidate(qc, markedArticleIds),
);

export function useSearchArticles(accountId: string | null, query: string) {
  const normalizedAccountId = normalizeQueryAccountId(accountId);
  const normalizedQuery = normalizeArticleSearchQuery(query);
  const searchOwner = resolveArticleSearchQueryOwner(accountId, query);
  const queryResult = useQuery({
    queryKey: queryKeys.search.byAccountAndQuery(normalizedAccountId, normalizedQuery),
    queryFn: () =>
      searchArticles(
        requireEnabledQueryValue(searchOwner?.accountId ?? null, "accountId"),
        searchOwner?.query ?? "",
      ).then(Result.unwrap()),
    enabled: searchOwner !== null,
    placeholderData: undefined,
  });

  return {
    ...queryResult,
    data: queryResult.isPlaceholderData ? undefined : queryResult.data,
    searchOwner,
  };
}

export function useToggleStar() {
  const qc = useQueryClient();
  const latestRequestIdsRef = useRef(new Map<string, number>());
  const nextRequestIdRef = useRef(0);

  return useMutation({
    mutationFn: ({ id, starred }: ToggleStarMutationInput) => toggleArticleStar(id, starred).then(Result.unwrap()),
    onMutate: (variables) => {
      const requestId = nextRequestIdRef.current + 1;
      nextRequestIdRef.current = requestId;
      latestRequestIdsRef.current.set(variables.id, requestId);
      return { requestId };
    },
    onSuccess: (_data, variables, context) => {
      if (latestRequestIdsRef.current.get(variables.id) === context.requestId) {
        patchCachedArticleStarState(qc, variables.id, variables.starred);
      }
      invalidateArticleMutationQueries(qc, "article-star");
    },
  });
}
