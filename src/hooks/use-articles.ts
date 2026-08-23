import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import {
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
import {
  getRecentArticleQueryKeysForAccount,
  isAccountKnownDeleted,
  patchCachedArticleReadState,
  patchCachedArticleStarState,
  patchCachedArticlesMarkedRead,
  shouldInvalidateAfterRecordArticleView,
} from "@/hooks/article-cache-projection";
import { createMutation } from "@/hooks/create-mutation";
import { shouldRetainBulkMarkedRead } from "@/lib/articles/article-read-projection";
import {
  invalidateArticleMutationQueries,
  invalidateArticleQueries,
  invalidateQueryKeysLogOnly,
  normalizeQueryAccountId,
  queryKeys,
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

function patchMarkedArticlesReadAndInvalidate(qc: QueryClient, markedArticleIds: readonly string[]) {
  // Bulk mark-read retention policy contract: see article-read-projection.ts.
  const { viewMode, retainArticles } = useUiStore.getState();
  if (shouldRetainBulkMarkedRead(viewMode)) {
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
