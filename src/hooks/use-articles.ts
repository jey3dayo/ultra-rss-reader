import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import {
  getFeedIntegrityReport,
  listAccountArticles,
  listArticles,
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
  qc.invalidateQueries({ queryKey: ["accountUnreadCount"] });
  qc.invalidateQueries({ queryKey: ["feeds"] });
  qc.invalidateQueries({ queryKey: ["articlesByTag"] });
  qc.invalidateQueries({ queryKey: ["search"] });
}

export const useArticles = createQuery("articles", listArticles);

export const useAccountArticles = createQuery("accountArticles", listAccountArticles);

export function useFeedIntegrityReport() {
  return useQuery({
    queryKey: ["feedIntegrityReport"],
    queryFn: () => getFeedIntegrityReport().then(Result.unwrap()),
  });
}

export const useSetRead = createMutation(
  ({ id, read }: SetReadMutationInput) => markArticleRead(id, read),
  invalidateArticleQueries,
);

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
