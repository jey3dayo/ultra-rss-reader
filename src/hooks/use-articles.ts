import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAccountArticles,
  listArticles,
  markArticleRead,
  markArticlesRead,
  markFeedRead,
  markFolderRead,
  searchArticles,
  toggleArticleStar,
} from "../api/tauri-commands";

function invalidateArticleQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["articles"] });
  qc.invalidateQueries({ queryKey: ["accountArticles"] });
  qc.invalidateQueries({ queryKey: ["feeds"] });
  qc.invalidateQueries({ queryKey: ["articlesByTag"] });
  qc.invalidateQueries({ queryKey: ["search"] });
}

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
    onSuccess: () => invalidateArticleQueries(qc),
  });
}

export function useSetRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) => markArticleRead(id, read).then(Result.unwrap()),
    onSuccess: () => invalidateArticleQueries(qc),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (articleIds: string[]) => markArticlesRead(articleIds).then(Result.unwrap()),
    onSuccess: () => invalidateArticleQueries(qc),
  });
}

export function useMarkFeedRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (feedId: string) => markFeedRead(feedId).then(Result.unwrap()),
    onSuccess: () => invalidateArticleQueries(qc),
  });
}

export function useMarkFolderRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (folderId: string) => markFolderRead(folderId).then(Result.unwrap()),
    onSuccess: () => invalidateArticleQueries(qc),
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
    onSuccess: () => invalidateArticleQueries(qc),
  });
}
