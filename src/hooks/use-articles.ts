import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Result } from "@praha/byethrow";
import { listArticles, markArticleRead, searchArticles, toggleArticleStar } from "../api/tauri-commands";

export function useArticles(feedId: string | null) {
  return useQuery({
    queryKey: ["articles", feedId],
    queryFn: async () => {
      const result = await listArticles(feedId as string);
      if (Result.isFailure(result)) throw result.error;
      return result.value;
    },
    enabled: !!feedId,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (articleId: string) => {
      const result = await markArticleRead(articleId);
      if (Result.isFailure(result)) throw result.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["feeds"] });
    },
  });
}

export function useSearchArticles(accountId: string | null, query: string) {
  return useQuery({
    queryKey: ["search", accountId, query],
    queryFn: async () => {
      const result = await searchArticles(accountId as string, query);
      if (Result.isFailure(result)) throw result.error;
      return result.value;
    },
    enabled: !!accountId && query.length > 0,
  });
}

export function useToggleStar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, starred }: { id: string; starred: boolean }) => {
      const result = await toggleArticleStar(id, starred);
      if (Result.isFailure(result)) throw result.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
    },
  });
}
