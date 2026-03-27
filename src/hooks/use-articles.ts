import { Result } from "@praha/byethrow";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAccountArticles,
  listArticles,
  markArticleRead,
  markArticlesRead,
  searchArticles,
  toggleArticleStar,
} from "../api/tauri-commands";

export function useArticles(feedId: string | null) {
  return useQuery({
    queryKey: ["articles", feedId],
    queryFn: () => listArticles(feedId as string).then(Result.unwrap()),
    enabled: !!feedId,
  });
}

export function useAccountArticles(accountId: string | null) {
  return useQuery({
    queryKey: ["accountArticles", accountId],
    queryFn: () => listAccountArticles(accountId as string).then(Result.unwrap()),
    enabled: !!accountId,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (articleId: string) => markArticleRead(articleId, true).then(Result.unwrap()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["accountArticles"] });
      qc.invalidateQueries({ queryKey: ["feeds"] });
    },
  });
}

export function useSetRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) => markArticleRead(id, read).then(Result.unwrap()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["accountArticles"] });
      qc.invalidateQueries({ queryKey: ["feeds"] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (articleIds: string[]) => markArticlesRead(articleIds).then(Result.unwrap()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["accountArticles"] });
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
      qc.invalidateQueries({ queryKey: ["accountArticles"] });
    },
  });
}
