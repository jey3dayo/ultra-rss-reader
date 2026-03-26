import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listArticles, markArticleRead, toggleArticleStar } from "../api/tauri-commands";

export function useArticles(feedId: string | null) {
  return useQuery({
    queryKey: ["articles", feedId],
    queryFn: () => listArticles(feedId as string),
    enabled: !!feedId,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markArticleRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["feeds"] });
    },
  });
}

export function useToggleStar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, starred }: { id: string; starred: boolean }) => toggleArticleStar(id, starred),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
    },
  });
}
