import { Result } from "@praha/byethrow";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTag,
  deleteTag,
  getArticleTags,
  listArticlesByTag,
  listTags,
  tagArticle,
  untagArticle,
} from "../api/tauri-commands";

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => listTags().then(Result.unwrap()),
  });
}

export function useArticleTags(articleId: string | null) {
  return useQuery({
    queryKey: ["articleTags", articleId],
    queryFn: () => getArticleTags(articleId as string).then(Result.unwrap()),
    enabled: !!articleId,
  });
}

export function useArticlesByTag(tagId: string | null) {
  return useQuery({
    queryKey: ["articlesByTag", tagId],
    queryFn: () => listArticlesByTag(tagId as string).then(Result.unwrap()),
    enabled: !!tagId,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color }: { name: string; color?: string }) => createTag(name, color).then(Result.unwrap()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => deleteTag(tagId).then(Result.unwrap()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["articleTags"] });
      qc.invalidateQueries({ queryKey: ["articlesByTag"] });
    },
  });
}

function useInvalidateArticleTagQueries() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["articleTags"] });
    qc.invalidateQueries({ queryKey: ["articlesByTag"] });
  };
}

export function useTagArticle() {
  const onSuccess = useInvalidateArticleTagQueries();
  return useMutation({
    mutationFn: ({ articleId, tagId }: { articleId: string; tagId: string }) =>
      tagArticle(articleId, tagId).then(Result.unwrap()),
    onSuccess,
  });
}

export function useUntagArticle() {
  const onSuccess = useInvalidateArticleTagQueries();
  return useMutation({
    mutationFn: ({ articleId, tagId }: { articleId: string; tagId: string }) =>
      untagArticle(articleId, tagId).then(Result.unwrap()),
    onSuccess,
  });
}
