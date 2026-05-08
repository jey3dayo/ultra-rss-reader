import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ArticleDto,
  clearArticleViewHistory,
  countAccountStarredArticles,
  getFeedIntegrityReport,
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
import { invalidateArticleQueries } from "@/lib/query/query-invalidation";
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

  qc.setQueriesData({ queryKey: ["articles"] }, updateArticleArray);
  qc.setQueriesData({ queryKey: ["accountArticles"] }, updateArticleArray);
  qc.setQueriesData({ queryKey: ["starredArticles"] }, updateArticleArray);
  qc.setQueriesData({ queryKey: ["recentArticles"] }, updateArticleArray);
  qc.setQueriesData({ queryKey: ["articlesByTag"] }, updateArticleArray);
  qc.setQueriesData({ queryKey: ["search"] }, updateArticleArray);
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

function findCachedArticle(qc: QueryClient, articleId: string): ArticleDto | null {
  const queryKeys = [
    ["articles"],
    ["accountArticles"],
    ["articlesByTag"],
    ["search"],
    ["starredArticles"],
    ["recentArticles"],
  ] as const;

  for (const queryKey of queryKeys) {
    const matches = qc.getQueriesData<unknown>({ queryKey });
    for (const [, data] of matches) {
      if (!Array.isArray(data)) {
        continue;
      }

      const article = data.find((candidate) => isArticleDto(candidate) && candidate.id === articleId);
      if (article && isArticleDto(article)) {
        return article;
      }
    }
  }

  return null;
}

function resolveAccountIdsForArticle(qc: QueryClient, feedId: string): string[] {
  const accountIds = new Set<string>();

  for (const [, data] of qc.getQueriesData<unknown>({ queryKey: ["feeds"] })) {
    if (!Array.isArray(data)) {
      continue;
    }

    for (const candidate of data) {
      if (
        candidate &&
        typeof candidate === "object" &&
        "id" in candidate &&
        candidate.id === feedId &&
        "account_id" in candidate &&
        typeof candidate.account_id === "string"
      ) {
        accountIds.add(candidate.account_id);
      }
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

function patchCachedArticleStarState(qc: QueryClient, articleId: string, starred: boolean) {
  const cachedArticle = findCachedArticle(qc, articleId);
  if (cachedArticle === null) {
    return;
  }

  const nextArticle = { ...cachedArticle, is_starred: starred };
  const accountIds = resolveAccountIdsForArticle(qc, cachedArticle.feed_id);

  qc.setQueriesData({ queryKey: ["articles"] }, (current) => updateCachedArticleArray(current, nextArticle));
  qc.setQueriesData({ queryKey: ["articlesByTag"] }, (current) => updateCachedArticleArray(current, nextArticle));
  qc.setQueriesData({ queryKey: ["search"] }, (current) => updateCachedArticleArray(current, nextArticle));
  qc.setQueriesData({ queryKey: ["recentArticles"] }, (current) => updateCachedArticleArray(current, nextArticle));

  if (accountIds.length > 0) {
    for (const accountId of accountIds) {
      const accountArticleQueries = qc.getQueriesData<unknown>({ queryKey: ["accountArticles", accountId] });

      if (accountArticleQueries.length === 0) {
        qc.setQueryData(["accountArticles", accountId, { mode: "all" }], [nextArticle]);
      } else {
        for (const [queryKey] of accountArticleQueries) {
          qc.setQueryData(queryKey, (current: unknown) =>
            updateCachedArticleArray(current, nextArticle, { insertIfMissing: true }),
          );
        }
      }

      qc.setQueryData(["starredArticles", accountId], (current: unknown) => {
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

  qc.setQueriesData({ queryKey: ["accountArticles"] }, (current) =>
    updateCachedArticleArray(current, nextArticle, { insertIfMissing: true }),
  );

  qc.setQueriesData({ queryKey: ["starredArticles"] }, (current: unknown) => {
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

  return useQuery({
    queryKey: ["articles", feedId, { mode }],
    queryFn: () => {
      const resolvedFeedId = requireEnabledQueryValue(feedId, "feedId");
      return (
        mode === "starred" ? listFeedStarredArticles(resolvedFeedId) : listArticles(resolvedFeedId, mode === "unread")
      ).then(Result.unwrap());
    },
    enabled: !!feedId,
  });
}

export function useFeedStarredArticles(feedId: string | null) {
  return useArticles(feedId, { mode: "starred" });
}

export function useAccountArticles(accountId: string | null, options?: ArticleQueryOptions) {
  const mode = resolveArticleQueryMode(options);

  return useQuery({
    queryKey: ["accountArticles", accountId, { mode }],
    queryFn: () => {
      const resolvedAccountId = requireEnabledQueryValue(accountId, "accountId");
      return (
        mode === "starred"
          ? listStarredArticles(resolvedAccountId)
          : listAccountArticles(resolvedAccountId, mode === "unread")
      ).then(Result.unwrap());
    },
    enabled: !!accountId,
  });
}

export function useFolderArticles(folderId: string | null, options?: { mode?: ReaderFilter }) {
  const mode = options?.mode ?? "all";

  return useQuery({
    queryKey: ["folderArticles", folderId, { mode }],
    queryFn: () => listFolderArticles(requireEnabledQueryValue(folderId, "folderId"), mode).then(Result.unwrap()),
    enabled: !!folderId,
  });
}

export const useStarredArticles = createQuery("starredArticles", listStarredArticles);

export function useRecentArticles(accountId: string | null, options?: { mode?: ReaderFilter }) {
  const mode = options?.mode ?? "all";

  return useQuery({
    queryKey: ["recentArticles", accountId, { mode }],
    queryFn: () =>
      listRecentArticles(requireEnabledQueryValue(accountId, "accountId"), undefined, undefined, mode).then(
        Result.unwrap(),
      ),
    enabled: !!accountId,
  });
}

export function useFeedIntegrityReport() {
  return useQuery({
    queryKey: ["feedIntegrityReport"],
    queryFn: () => getFeedIntegrityReport().then(Result.unwrap()),
  });
}

export function useAccountStarredCount(accountId: string | null) {
  return useQuery({
    queryKey: ["accountStarredCount", accountId],
    queryFn: () => countAccountStarredArticles(requireEnabledQueryValue(accountId, "accountId")).then(Result.unwrap()),
    enabled: !!accountId,
  });
}

export function useSetRead() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, read }: SetReadMutationInput) => markArticleRead(id, read).then(Result.unwrap()),
    onSuccess: (_data, variables) => {
      patchCachedArticleReadState(qc, variables.id, variables.read);
      invalidateArticleQueries(qc);
    },
  });
}

export const useMarkAllRead = createMutation(
  (articleIds: string[]) => markArticlesRead(articleIds),
  (qc) => invalidateArticleQueries(qc),
);

export const useMarkAccountRead = createMutation(markAccountRead, (qc) => invalidateArticleQueries(qc));

export const useMarkAccountStarredRead = createMutation(markAccountStarredRead, (qc) => invalidateArticleQueries(qc));

export const useMarkOldUnreadRead = createMutation(
  ({ scopeKind, targetId, olderThanDays }: MarkOldUnreadReadMutationInput) =>
    markOldUnreadRead(scopeKind, targetId, olderThanDays),
  (qc) => invalidateArticleQueries(qc),
);

export const useUnstarAccountArticles = createMutation(unstarAccountArticles, (qc) => invalidateArticleQueries(qc));

export function useRecordArticleView() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ accountId, articleId }: RecordArticleViewMutationInput) =>
      recordArticleView(accountId, articleId).then(Result.unwrap),
    onSuccess: () => {
      invalidateArticleQueries(qc, {
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

export const useMarkFeedRead = createMutation(markFeedRead, (qc) => invalidateArticleQueries(qc));

export const useMarkFolderRead = createMutation(markFolderRead, (qc) => invalidateArticleQueries(qc));

export function useSearchArticles(accountId: string | null, query: string) {
  return useQuery({
    queryKey: ["search", accountId, query],
    queryFn: () => searchArticles(requireEnabledQueryValue(accountId, "accountId"), query).then(Result.unwrap()),
    enabled: !!accountId && query.length > 0,
  });
}

export const useToggleStar = createMutation(
  ({ id, starred }: ToggleStarMutationInput) => toggleArticleStar(id, starred),
  (qc, variables) => {
    patchCachedArticleStarState(qc, variables.id, variables.starred);
    invalidateArticleQueries(qc);
  },
);
