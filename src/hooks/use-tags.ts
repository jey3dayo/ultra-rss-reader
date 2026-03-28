import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTag,
  deleteTag,
  getArticleTags,
  getTagArticleCounts,
  listArticlesByTag,
  listTags,
  renameTag,
  tagArticle,
  untagArticle,
} from "@/api/tauri-commands";
import { createMutation } from "@/hooks/create-mutation";
import { createQuery } from "@/hooks/create-query";

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => listTags().then(Result.unwrap()),
  });
}

export function useTagArticleCounts() {
  return useQuery({
    queryKey: ["tagArticleCounts"],
    queryFn: () => getTagArticleCounts().then(Result.unwrap()),
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
  qc.invalidateQueries({ queryKey: ["tagArticleCounts"] });
}

export const useTagArticle = createMutation(
  ({ articleId, tagId }: { articleId: string; tagId: string }) => tagArticle(articleId, tagId),
  invalidateArticleTagQueries,
);

export const useUntagArticle = createMutation(
  ({ articleId, tagId }: { articleId: string; tagId: string }) => untagArticle(articleId, tagId),
  invalidateArticleTagQueries,
);

function invalidateTagQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["tags"] });
  qc.invalidateQueries({ queryKey: ["articleTags"] });
  qc.invalidateQueries({ queryKey: ["articlesByTag"] });
  qc.invalidateQueries({ queryKey: ["tagArticleCounts"] });
}

export const useRenameTag = createMutation(
  ({ tagId, name }: { tagId: string; name: string }) => renameTag(tagId, name),
  invalidateTagQueries,
);

export const useDeleteTag = createMutation(({ tagId }: { tagId: string }) => deleteTag(tagId), invalidateTagQueries);
