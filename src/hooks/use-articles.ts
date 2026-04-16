import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
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
  invalidateArticleQueries,
);
