import { Result } from "@praha/byethrow";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ArticleDto,
  countAccountStarredArticles,
  getFeedIntegrityReport,
  listAccountArticles,
  listArticles,
  listStarredArticles,
  markArticleRead,
  markArticlesRead,
  markFeedRead,
  markFolderRead,
  searchArticles,
  toggleArticleStar,
} from "@/api/tauri-commands";
import { createMutation } from "@/hooks/create-mutation";
import { createQuery } from "@/hooks/create-query";

export type SetReadMutationInput = {
  id: string;
  read: boolean;
};

export type ToggleStarMutationInput = {
  id: string;
  starred: boolean;
};

function invalidateArticleQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["articles"] });
  qc.invalidateQueries({ queryKey: ["accountArticles"] });
  qc.invalidateQueries({ queryKey: ["starredArticles"] });
  qc.invalidateQueries({ queryKey: ["accountUnreadCount"] });
  qc.invalidateQueries({ queryKey: ["accountStarredCount"] });
  qc.invalidateQueries({ queryKey: ["feeds"] });
  qc.invalidateQueries({ queryKey: ["articlesByTag"] });
  qc.invalidateQueries({ queryKey: ["search"] });
}

function patchCachedArticleReadState(qc: QueryClient, articleId: string, read: boolean) {
  const updateArticleArray = (current: unknown) => {
    if (!Array.isArray(current)) {
      return current;
    }

    return current.map((candidate) => {
      if (candidate && typeof candidate === "object" && "id" in candidate && "is_read" in candidate) {
        const article = candidate as ArticleDto;
        return article.id === articleId ? { ...article, is_read: read } : article;
      }

      return candidate;
    });
  };

  qc.setQueriesData({ queryKey: ["articles"] }, updateArticleArray);
  qc.setQueriesData({ queryKey: ["accountArticles"] }, updateArticleArray);
  qc.setQueriesData({ queryKey: ["starredArticles"] }, updateArticleArray);
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
  const queryKeys = [["articles"], ["accountArticles"], ["articlesByTag"], ["search"], ["starredArticles"]] as const;

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

function resolveAccountQueryKeysForArticle(qc: QueryClient, feedId: string): QueryKey[] {
  return qc.getQueriesData<unknown>({ queryKey: ["feeds"] }).flatMap(([queryKey, data]) => {
    if (!Array.isArray(data)) {
      return [];
    }

    const belongsToQuery = data.some(
      (candidate) => candidate && typeof candidate === "object" && "id" in candidate && candidate.id === feedId,
    );

    return belongsToQuery ? [queryKey] : [];
  });
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
  const accountQueryKeys = resolveAccountQueryKeysForArticle(qc, cachedArticle.feed_id);

  qc.setQueriesData({ queryKey: ["articles"] }, (current) => updateCachedArticleArray(current, nextArticle));
  qc.setQueriesData({ queryKey: ["articlesByTag"] }, (current) => updateCachedArticleArray(current, nextArticle));
  qc.setQueriesData({ queryKey: ["search"] }, (current) => updateCachedArticleArray(current, nextArticle));

  if (accountQueryKeys.length > 0) {
    for (const queryKey of accountQueryKeys) {
      const [, accountId] = queryKey;
      qc.setQueryData(["accountArticles", accountId], (current: unknown) =>
        updateCachedArticleArray(current, nextArticle, { insertIfMissing: true }),
      );
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

export const useArticles = createQuery("articles", listArticles);

export const useAccountArticles = createQuery("accountArticles", listAccountArticles);

export const useStarredArticles = createQuery("starredArticles", listStarredArticles);

export function useFeedIntegrityReport() {
  return useQuery({
    queryKey: ["feedIntegrityReport"],
    queryFn: () => getFeedIntegrityReport().then(Result.unwrap()),
  });
}

export function useAccountStarredCount(accountId: string | null) {
  return useQuery({
    queryKey: ["accountStarredCount", accountId],
    queryFn: () => countAccountStarredArticles(accountId as string).then(Result.unwrap()),
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
  invalidateArticleQueries,
);

export const useMarkFeedRead = createMutation(markFeedRead, invalidateArticleQueries);

export const useMarkFolderRead = createMutation(markFolderRead, invalidateArticleQueries);

export function useSearchArticles(accountId: string | null, query: string) {
  return useQuery({
    queryKey: ["search", accountId, query],
    queryFn: () => searchArticles(accountId as string, query).then(Result.unwrap()),
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
