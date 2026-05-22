import { z } from "zod";
import {
  articleListModeSchema,
  nonBlankTrimmedIdSchema,
  nullableTagColorSchema,
  optionalTagColorSchema,
  paginationLimitSchema,
  paginationOffsetSchema,
  tagNameSchema,
} from "./shared";

export function normalizeTagColorForCommand(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  return nullableTagColorSchema.parse(value) ?? null;
}

export function normalizeTagColorForView(value: string | null | undefined): string | null {
  const result = nullableTagColorSchema.safeParse(value);
  return result.success ? (result.data ?? null) : null;
}

export const createTagArgs = z.object({
  name: tagNameSchema,
  color: optionalTagColorSchema,
});

export const renameTagArgs = z.object({
  tagId: nonBlankTrimmedIdSchema,
  name: tagNameSchema,
  color: nullableTagColorSchema,
});

export const deleteTagArgs = z.object({ tagId: nonBlankTrimmedIdSchema });
export const tagArticleArgs = z.object({
  articleId: nonBlankTrimmedIdSchema,
  tagId: nonBlankTrimmedIdSchema,
});
export const untagArticleArgs = z.object({
  articleId: nonBlankTrimmedIdSchema,
  tagId: nonBlankTrimmedIdSchema,
});
export const getArticleTagsArgs = z.object({ articleId: nonBlankTrimmedIdSchema });
export const listArticlesByTagArgs = z.object({
  tagId: nonBlankTrimmedIdSchema,
  mode: articleListModeSchema.optional(),
  offset: paginationOffsetSchema.optional(),
  limit: paginationLimitSchema.optional(),
  accountId: nonBlankTrimmedIdSchema.optional(),
});
export const getTagArticleCountsArgs = z.object({
  accountId: nonBlankTrimmedIdSchema.optional(),
});
