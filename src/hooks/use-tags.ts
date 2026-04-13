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

export type CreateTagMutationInput = {
  name: string;
  color?: string;
};

export type ArticleTagMutationInput = {
  articleId: string;
  tagId: string;
};

export type RenameTagMutationInput = {
  tagId: string;
  name: string;
  color?: string | null;
};

export type DeleteTagMutationInput = {
  tagId: string;
};

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => listTags().then(Result.unwrap()),
  });
}

export function useTagArticleCounts(accountId: string | null | undefined) {
  return useQuery({
    queryKey: ["tagArticleCounts", accountId],
    queryFn: () => getTagArticleCounts(accountId ?? undefined).then(Result.unwrap()),
  });
}

export const useArticleTags = createQuery("articleTags", getArticleTags);

export function useArticlesByTag(tagId: string | null, accountId?: string | null) {
  return useQuery({
    queryKey: ["articlesByTag", tagId, accountId],
    queryFn: () =>
      listArticlesByTag(tagId as string, undefined, undefined, accountId ?? undefined).then(Result.unwrap()),
    enabled: !!tagId,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color }: CreateTagMutationInput) => createTag(name, color).then(Result.unwrap()),
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
  ({ articleId, tagId }: ArticleTagMutationInput) => tagArticle(articleId, tagId),
  invalidateArticleTagQueries,
);

export const useUntagArticle = createMutation(
  ({ articleId, tagId }: ArticleTagMutationInput) => untagArticle(articleId, tagId),
  invalidateArticleTagQueries,
);

function invalidateTagQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["tags"] });
  qc.invalidateQueries({ queryKey: ["articleTags"] });
  qc.invalidateQueries({ queryKey: ["articlesByTag"] });
  qc.invalidateQueries({ queryKey: ["tagArticleCounts"] });
}

export const useRenameTag = createMutation(
  ({ tagId, name, color }: RenameTagMutationInput) => renameTag(tagId, name, color),
  invalidateTagQueries,
);

export const useDeleteTag = createMutation(
  ({ tagId }: DeleteTagMutationInput) => deleteTag(tagId),
  invalidateTagQueries,
);
