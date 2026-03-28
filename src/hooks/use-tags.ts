import { Result } from "@praha/byethrow";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTag, getArticleTags, listArticlesByTag, listTags, tagArticle, untagArticle } from "@/api/tauri-commands";
import { createQuery } from "@/hooks/create-query";

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => listTags().then(Result.unwrap()),
  });
}

export const useArticleTags = createQuery("articleTags", getArticleTags);

export const useArticlesByTag = createQuery("articlesByTag", listArticlesByTag);

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color }: { name: string; color?: string }) => createTag(name, color).then(Result.unwrap()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
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
