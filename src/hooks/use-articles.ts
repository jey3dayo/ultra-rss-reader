import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Result } from "@praha/byethrow";
import { listArticles, markArticleRead, searchArticles, toggleArticleStar } from "../api/tauri-commands";

export function useArticles(feedId: string | null) {
  return useQuery({
    queryKey: ["articles", feedId],
    queryFn: () => listArticles(feedId as string).then(Result.unwrap()),
    enabled: !!feedId,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (articleId: string) => markArticleRead(articleId).then(Result.unwrap()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["feeds"] });
    },
  });
}

export function useSearchArticles(accountId: string | null, query: string) {
  return useQuery({
    queryKey: ["search", accountId, query],
    queryFn: () => searchArticles(accountId as string, query).then(Result.unwrap()),
    enabled: !!accountId && query.length > 0,
  });
}

export function useToggleStar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, starred }: { id: string; starred: boolean }) =>
      toggleArticleStar(id, starred).then(Result.unwrap()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
    },
  });
}
