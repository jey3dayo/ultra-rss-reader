import { Result } from "@praha/byethrow";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import {
  type ArticleDto,
  clearArticleViewHistory,
  countAccountStarredArticles,
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
  invalidateArticleQueries,
  normalizeQueryAccountId,
  queryKeys,
  resolveArticleInvalidationQueryKeys,
} from "@/lib/query/query-invalidation";
import type { ReaderFilter } from "@/lib/reader/reader-query";

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

const ARTICLE_SEARCH_QUERY_MAX_LENGTH = 128;
const ARTICLE_SEARCH_QUERY_WHITESPACE_PATTERN = /\s+/gu;

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
  const normalizedValue = normalizeQueryAccountId(value);
  if (normalizedValue === null) {
    return null;
  }

  return normalizedValue;
}

export function normalizeArticleSearchQuery(query: string): string {
  return Array.from(query.normalize("NFKC").replace(ARTICLE_SEARCH_QUERY_WHITESPACE_PATTERN, " ").trim())
    .slice(0, ARTICLE_SEARCH_QUERY_MAX_LENGTH)
    .join("");
}

function patchCachedArticleReadState(qc: QueryClient, articleId: string, read: boolean) {
  const updateArticleArray = (current: unknown) => {
    if (!Array.isArray(current)) {
      return current;
    }

    return current.map((candidate) => {
      if (isArticleDto(candidate)) {
        return candidate.id === articleId ? { ...candidate, is_read: read } : candidate;
      }

      return candidate;
    });
  };

  qc.setQueriesData({ queryKey: queryKeys.articles.root }, updateArticleArray);
  qc.setQueriesData({ queryKey: queryKeys.accountArticles.root }, updateArticleArray);
  qc.setQueriesData({ queryKey: queryKeys.starredArticles.root }, updateArticleArray);
  qc.setQueriesData({ queryKey: queryKeys.recentArticles.root }, updateArticleArray);
  qc.setQueriesData({ queryKey: queryKeys.articlesByTag.root }, updateArticleArray);
  qc.setQueriesData({ queryKey: queryKeys.search.root }, updateArticleArray);
}

export function resolveArticleMutationInvalidationQueryKeys() {
  return resolveArticleInvalidationQueryKeys({ includeTagArticleCounts: true });
}

function invalidateArticleMutationQueries(qc: QueryClient) {
  invalidateArticleQueries(qc, {
    actionOwner: "article-mutation",
    includeTagArticleCounts: true,
  });
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
  const accountId = queryKey[1];
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

function updateCachedArticleArray(current: unknown, nextArticle: ArticleDto, options?: { insertIfMissing?: boolean }) {
  if (!Array.isArray(current)) {
    return options?.insertIfMissing ? [nextArticle] : current;
  }

  let found = false;
  const nextArray = current.map((candidate) => {
    if (isArticleDto(candidate) && candidate.id === nextArticle.id) {
      found = true;
      return nextArticle;
    }

    return candidate;
  });

  if (!found && options?.insertIfMissing) {
    return [nextArticle, ...nextArray];
  }

  return nextArray;
}

function shouldInsertMissingAccountArticle(queryKey: QueryKey, nextArticle: ArticleDto): boolean {
  const mode = getReaderArticleQueryMode(queryKey);

  if (mode === "unread" && nextArticle.is_read) {
    return false;
  }

  if (mode === "starred" && !nextArticle.is_starred) {
    return false;
  }

  return true;
}

function patchCachedArticleStarState(qc: QueryClient, articleId: string, starred: boolean) {
  const cachedArticle = findCachedArticle(qc, articleId);
  if (cachedArticle === null) {
    return;
  }

  const nextArticle = { ...cachedArticle, is_starred: starred };
  const accountIds = resolveAccountIdsForArticle(qc, cachedArticle);

  qc.setQueriesData({ queryKey: queryKeys.articles.root }, (current) => updateCachedArticleArray(current, nextArticle));
  qc.setQueriesData({ queryKey: queryKeys.articlesByTag.root }, (current) =>
    updateCachedArticleArray(current, nextArticle),
  );
  qc.setQueriesData({ queryKey: queryKeys.search.root }, (current) => updateCachedArticleArray(current, nextArticle));
  qc.setQueriesData({ queryKey: queryKeys.recentArticles.root }, (current) =>
    updateCachedArticleArray(current, nextArticle),
  );

  if (accountIds.length > 0) {
    for (const accountId of accountIds) {
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
            }),
          );
        }
      }

      qc.setQueryData(queryKeys.starredArticles.byAccount(accountId), (current: unknown) => {
        if (!Array.isArray(current)) {
          return starred ? [nextArticle] : [];
        }

        const starredArticles = current.filter(isArticleDto);
        const hasArticle = starredArticles.some((article) => article.id === articleId);

        if (!starred) {
          return starredArticles.filter((article) => article.id !== articleId);
        }

        if (hasArticle) {
          return starredArticles.map((article) => (article.id === articleId ? nextArticle : article));
        }

        return [nextArticle, ...starredArticles];
      });
    }
    return;
  }

  for (const [queryKey] of qc.getQueriesData<unknown>({
    queryKey: queryKeys.accountArticles.root,
  })) {
    qc.setQueryData(queryKey, (current: unknown) =>
      updateCachedArticleArray(current, nextArticle, {
        insertIfMissing: shouldInsertMissingAccountArticle(queryKey, nextArticle),
      }),
    );
  }

  qc.setQueriesData({ queryKey: queryKeys.starredArticles.root }, (current: unknown) => {
    if (!Array.isArray(current)) {
      return starred ? [nextArticle] : [];
    }

    const starredArticles = current.filter(isArticleDto);
    const hasArticle = starredArticles.some((article) => article.id === articleId);

    if (!starred) {
      return starredArticles.filter((article) => article.id !== articleId);
    }

    if (hasArticle) {
      return starredArticles.map((article) => (article.id === articleId ? nextArticle : article));
    }

    return [nextArticle, ...starredArticles];
  });
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

export const useStarredArticles = createQuery("starredArticles", listStarredArticles);

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
      invalidateArticleMutationQueries(qc);
    },
  });
}

export const useMarkAllRead = createMutation(
  (articleIds: string[]) => markArticlesRead(articleIds),
  invalidateArticleMutationQueries,
);

export const useMarkAccountRead = createMutation(markAccountRead, invalidateArticleMutationQueries);

export const useMarkAccountStarredRead = createMutation(markAccountStarredRead, invalidateArticleMutationQueries);

export const useMarkOldUnreadRead = createMutation(
  ({ scopeKind, targetId, olderThanDays }: MarkOldUnreadReadMutationInput) =>
    markOldUnreadRead(scopeKind, targetId, olderThanDays),
  invalidateArticleMutationQueries,
);

export const useUnstarAccountArticles = createMutation(unstarAccountArticles, invalidateArticleMutationQueries);

export function useRecordArticleView() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ accountId, articleId }: RecordArticleViewMutationInput) => {
      const normalizedAccountId = normalizeManualArticleQueryId(accountId);
      const normalizedArticleId = normalizeManualArticleQueryId(articleId);

      if (!normalizedAccountId || !normalizedArticleId) {
        return Promise.resolve(null);
      }

      return recordArticleView(normalizedAccountId, normalizedArticleId).then(Result.unwrap);
    },
    onSuccess: (_data, variables) => {
      if (!normalizeManualArticleQueryId(variables.accountId) || !normalizeManualArticleQueryId(variables.articleId)) {
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

export const useClearArticleViewHistory = createMutation(clearArticleViewHistory, (qc) =>
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
  }),
);

export const useMarkFeedRead = createMutation(markFeedRead, invalidateArticleMutationQueries);

export const useMarkFolderRead = createMutation(markFolderRead, invalidateArticleMutationQueries);

export function useSearchArticles(accountId: string | null, query: string) {
  const normalizedAccountId = normalizeQueryAccountId(accountId);
  const normalizedQuery = normalizeArticleSearchQuery(query);

  return useQuery({
    queryKey: queryKeys.search.byAccountAndQuery(normalizedAccountId, normalizedQuery),
    queryFn: () =>
      searchArticles(requireEnabledQueryValue(normalizedAccountId, "accountId"), normalizedQuery).then(Result.unwrap()),
    enabled: normalizedAccountId !== null && normalizedQuery.length > 0,
  });
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
      invalidateArticleMutationQueries(qc);
    },
  });
}
