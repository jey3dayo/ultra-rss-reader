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
import {
  invalidateArticleMutationQueries,
  invalidateQueryKeysLogOnly,
  normalizeQueryAccountId,
  queryKeys,
} from "@/lib/query/query-invalidation";
import type { ReaderFilter } from "@/lib/reader/reader-query";
import { useUiStore } from "@/stores/ui-store";

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

type TagMutationInvalidationScope = "create" | "articleAssignment" | "metadata";
type TagQueryKey = readonly [string];

const TAG_QUERY_KEYS = {
  tags: ["tags"],
  articleTags: ["articleTags"],
  articlesByTag: queryKeys.articlesByTag.root,
  tagArticleCounts: queryKeys.tagArticleCounts.root,
} as const satisfies Record<string, TagQueryKey>;

export const tagQueryKeys = {
  tags: {
    root: TAG_QUERY_KEYS.tags,
  },
  articleTags: {
    root: TAG_QUERY_KEYS.articleTags,
    byArticle: (articleId: string | null) => [...TAG_QUERY_KEYS.articleTags, articleId] as const,
  },
  articlesByTag: {
    root: TAG_QUERY_KEYS.articlesByTag,
    byTagAndAccount: (tagId: string | null, accountId: string | null | undefined, mode: ReaderFilter) =>
      queryKeys.articlesByTag.byTagAndAccount(tagId, normalizeQueryAccountId(accountId), mode),
  },
  tagArticleCounts: {
    root: TAG_QUERY_KEYS.tagArticleCounts,
    byAccount: (accountId: string | null | undefined) =>
      queryKeys.tagArticleCounts.byAccount(normalizeQueryAccountId(accountId)),
  },
} as const;

export function resolveTagMutationInvalidationQueryKeys(
  scope: TagMutationInvalidationScope,
): ReadonlyArray<TagQueryKey> {
  switch (scope) {
    case "create":
      return [TAG_QUERY_KEYS.tags];
    case "articleAssignment":
      return [TAG_QUERY_KEYS.articleTags, TAG_QUERY_KEYS.articlesByTag, TAG_QUERY_KEYS.tagArticleCounts];
    case "metadata":
      return [
        TAG_QUERY_KEYS.tags,
        TAG_QUERY_KEYS.articleTags,
        TAG_QUERY_KEYS.articlesByTag,
        TAG_QUERY_KEYS.tagArticleCounts,
      ];
  }
}

function invalidateTagQueryKeys(qc: QueryClient, queryKeys: ReadonlyArray<TagQueryKey>) {
  invalidateQueryKeysLogOnly(qc, queryKeys, { actionOwner: "tag-mutation" });
}

export function useTags() {
  return useQuery({
    queryKey: tagQueryKeys.tags.root,
    queryFn: () => listTags().then(Result.unwrap()),
  });
}

export function useTagArticleCounts(accountId: string | null | undefined) {
  const queryAccountId = normalizeQueryAccountId(accountId);

  return useQuery({
    queryKey: tagQueryKeys.tagArticleCounts.byAccount(queryAccountId),
    queryFn: () => getTagArticleCounts(queryAccountId ?? undefined).then(Result.unwrap()),
  });
}

export const useArticleTags = createQuery(TAG_QUERY_KEYS.articleTags[0], getArticleTags);

function normalizeTagId(tagId: string | null): string | null {
  const trimmedTagId = tagId?.trim();

  return trimmedTagId ? trimmedTagId : null;
}

function requireTagId(tagId: string | null): string {
  const normalizedTagId = normalizeTagId(tagId);

  if (!normalizedTagId) {
    throw new Error("tagId is required when the query is enabled.");
  }

  return normalizedTagId;
}

export function useArticlesByTag(tagId: string | null, accountId?: string | null, options?: { mode?: ReaderFilter }) {
  const mode = options?.mode ?? "all";
  const normalizedTagId = normalizeTagId(tagId);
  const normalizedAccountId = normalizeQueryAccountId(accountId);

  return useQuery({
    queryKey: tagQueryKeys.articlesByTag.byTagAndAccount(normalizedTagId, normalizedAccountId, mode),
    queryFn: () =>
      listArticlesByTag(
        requireTagId(normalizedTagId),
        undefined,
        undefined,
        normalizedAccountId ?? undefined,
        mode,
      ).then(Result.unwrap()),
    enabled: normalizedTagId !== null,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color }: CreateTagMutationInput) => createTag(name, color).then(Result.unwrap()),
    onSuccess: () => {
      invalidateTagQueryKeys(qc, resolveTagMutationInvalidationQueryKeys("create"));
    },
  });
}

function invalidateArticleTagQueries(qc: QueryClient) {
  invalidateTagQueryKeys(qc, resolveTagMutationInvalidationQueryKeys("articleAssignment"));
  invalidateArticleMutationQueries(qc, "tag-article-assignment");
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
  invalidateTagQueryKeys(qc, resolveTagMutationInvalidationQueryKeys("metadata"));
}

export const useRenameTag = createMutation(
  ({ tagId, name, color }: RenameTagMutationInput) => renameTag(tagId, name, color),
  (qc, args, tag) => {
    qc.setQueryData(tagQueryKeys.tags.root, (current: unknown) => {
      if (!Array.isArray(current)) {
        return current;
      }

      return current.map((candidate) => {
        if (
          typeof candidate !== "object" ||
          candidate === null ||
          !("id" in candidate) ||
          candidate.id !== args.tagId
        ) {
          return candidate;
        }

        return tag;
      });
    });
    invalidateTagQueries(qc);
  },
);

export const useDeleteTag = createMutation(
  ({ tagId }: DeleteTagMutationInput) => deleteTag(tagId),
  (qc, args) => {
    invalidateTagQueries(qc);
    useUiStore.getState().handleTagDeleted(args.tagId);
  },
);
