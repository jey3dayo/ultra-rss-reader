import { Result } from "@praha/byethrow";
import type { QueryKey } from "@tanstack/react-query";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { MAX_IPC_PAGINATION_OFFSET } from "@/api/schemas/commands/shared";
import type { ArticleDto } from "@/api/tauri-commands";
import {
  countAccountStarredArticles,
  getArticle,
  listAccountArticles,
  listArticles,
  listFeedStarredArticles,
  listFolderArticles,
  listRecentArticles,
  listStarredArticles,
  searchArticles,
} from "@/api/tauri-commands";
import {
  createInfiniteArticleQueryData,
  flattenArticleQueryData,
  shareInfiniteArticleQueryData,
} from "@/hooks/article-cache-projection";
import { normalizeQueryAccountId, queryKeys } from "@/lib/query/query-invalidation";
import type { ReaderFilter } from "@/lib/reader/reader-query";
import { requireEnabledQueryValue } from "@/lib/require-enabled-query-value";

import { normalizeManualArticleQueryId } from "./article-mutation-requests";

export type {
  MarkOldUnreadReadMutationInput,
  RecordArticleViewMutationInput,
  SetReadMutationInput,
  ToggleStarMutationInput,
} from "./article-mutation-requests";
export {
  useClearArticleViewHistory,
  useMarkAccountRead,
  useMarkAccountStarredRead,
  useMarkAllRead,
  useMarkFeedRead,
  useMarkFolderRead,
  useMarkOldUnreadRead,
  useRecordArticleView,
  useSetRead,
  useToggleStar,
  useUnstarAccountArticles,
} from "./use-article-mutations";

type ArticleQueryOptions = {
  mode?: ReaderFilter;
  unreadOnly?: boolean;
};

// Keep these values aligned with DEFAULT_ARTICLE_LIST_LIMIT and
// DEFAULT_RECENT_ARTICLE_LIST_LIMIT in src-tauri/src/commands/article_commands/queries.rs.
export const READER_ARTICLE_PAGE_SIZE = 50;
export const READER_RECENT_PAGE_SIZE = 20;

export type ArticleSearchQueryOwner = {
  accountId: string;
  query: string;
  key: string;
};

export { flattenArticleQueryData };

const ARTICLE_SEARCH_QUERY_MAX_LENGTH = 128;
const ARTICLE_SEARCH_QUERY_WHITESPACE_PATTERN = /\s+/gu;

function resolveArticleQueryMode(options?: ArticleQueryOptions): ReaderFilter {
  if (options?.mode) {
    return options.mode;
  }

  return options?.unreadOnly ? "unread" : "all";
}

export function getNextArticlePageParam(
  lastPage: ArticleDto[] | undefined,
  allPages: Array<ArticleDto[] | undefined>,
  pageSize: number,
): number | undefined {
  if (!Array.isArray(lastPage) || lastPage.length < pageSize) {
    return undefined;
  }

  const nextOffset = allPages.reduce((articleCount, page) => articleCount + (Array.isArray(page) ? page.length : 0), 0);
  if (nextOffset > MAX_IPC_PAGINATION_OFFSET) {
    return undefined;
  }

  return nextOffset;
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

function useInfiniteArticleQuery(
  queryKey: QueryKey,
  queryFn: (pageParam: number) => Promise<ArticleDto[]>,
  pageSize: number,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const cachedData = queryClient.getQueryData(queryKey);
  if (Array.isArray(cachedData)) {
    queryClient.setQueryData(queryKey, createInfiniteArticleQueryData(cachedData));
  }

  const queryResult = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => queryFn(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => getNextArticlePageParam(lastPage, allPages, pageSize),
    structuralSharing: shareInfiniteArticleQueryData,
    enabled,
  });

  const data = useMemo(
    () => (queryResult.data ? flattenArticleQueryData(queryResult.data) : undefined),
    [queryResult.data],
  );
  return { ...queryResult, data };
}

export function useArticles(feedId: string | null, options?: ArticleQueryOptions) {
  const mode = resolveArticleQueryMode(options);
  const normalizedFeedId = normalizeManualArticleQueryId(feedId);

  return useInfiniteArticleQuery(
    queryKeys.articles.byFeed(normalizedFeedId, mode),
    (pageParam) => {
      const resolvedFeedId = requireEnabledQueryValue(normalizedFeedId, "feedId");
      return (
        mode === "starred"
          ? listFeedStarredArticles(resolvedFeedId, pageParam, READER_ARTICLE_PAGE_SIZE)
          : listArticles(resolvedFeedId, mode === "unread", pageParam, READER_ARTICLE_PAGE_SIZE)
      ).then(Result.unwrap());
    },
    READER_ARTICLE_PAGE_SIZE,
    !!normalizedFeedId,
  );
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

  return useInfiniteArticleQuery(
    queryKeys.accountArticles.byAccount(normalizedAccountId, mode),
    (pageParam) => {
      const resolvedAccountId = requireEnabledQueryValue(normalizedAccountId, "accountId");
      return (
        mode === "starred"
          ? listStarredArticles(resolvedAccountId, pageParam, READER_ARTICLE_PAGE_SIZE)
          : listAccountArticles(resolvedAccountId, mode === "unread", pageParam, READER_ARTICLE_PAGE_SIZE)
      ).then(Result.unwrap());
    },
    READER_ARTICLE_PAGE_SIZE,
    !!normalizedAccountId,
  );
}

export function useFolderArticles(folderId: string | null, options?: { mode?: ReaderFilter }) {
  const mode = options?.mode ?? "all";
  const normalizedFolderId = normalizeManualArticleQueryId(folderId);

  return useInfiniteArticleQuery(
    queryKeys.folderArticles.byFolder(normalizedFolderId, mode),
    (pageParam) =>
      listFolderArticles(
        requireEnabledQueryValue(normalizedFolderId, "folderId"),
        mode,
        pageParam,
        READER_ARTICLE_PAGE_SIZE,
      ).then(Result.unwrap()),
    READER_ARTICLE_PAGE_SIZE,
    !!normalizedFolderId,
  );
}

export function useRecentArticles(accountId: string | null, options?: { mode?: ReaderFilter }) {
  const mode = options?.mode ?? "all";
  const normalizedAccountId = normalizeManualArticleQueryId(accountId);

  return useInfiniteArticleQuery(
    queryKeys.recentArticles.byAccount(normalizedAccountId, mode),
    (pageParam) =>
      listRecentArticles(
        requireEnabledQueryValue(normalizedAccountId, "accountId"),
        pageParam,
        READER_RECENT_PAGE_SIZE,
        mode,
      ).then(Result.unwrap()),
    READER_RECENT_PAGE_SIZE,
    !!normalizedAccountId,
  );
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
