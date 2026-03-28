import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTag, getArticleTags, listArticlesByTag, listTags, tagArticle, untagArticle } from "@/api/tauri-commands";
import { createMutation } from "@/hooks/create-mutation";
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

function invalidateArticleTagQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["articleTags"] });
  qc.invalidateQueries({ queryKey: ["articlesByTag"] });
}

export const useTagArticle = createMutation(
  ({ articleId, tagId }: { articleId: string; tagId: string }) => tagArticle(articleId, tagId),
  invalidateArticleTagQueries,
);

export const useUntagArticle = createMutation(
  ({ articleId, tagId }: { articleId: string; tagId: string }) => untagArticle(articleId, tagId),
  invalidateArticleTagQueries,
);
