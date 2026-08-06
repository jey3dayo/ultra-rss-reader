import * as v from "valibot";
import * as s from "@/api/schemas/validation";
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

  return v.parse(nullableTagColorSchema, value) ?? null;
}

export function normalizeTagColorForView(value: string | null | undefined): string | null {
  const result = v.safeParse(nullableTagColorSchema, value);
  return result.success ? (result.output ?? null) : null;
}

export const createTagArgs = s.object({
  name: tagNameSchema,
  color: optionalTagColorSchema,
});

export const renameTagArgs = s.object({
  tagId: nonBlankTrimmedIdSchema,
  name: tagNameSchema,
  color: nullableTagColorSchema,
});

export const deleteTagArgs = s.object({ tagId: nonBlankTrimmedIdSchema });
export const tagArticleArgs = s.object({
  articleId: nonBlankTrimmedIdSchema,
  tagId: nonBlankTrimmedIdSchema,
});
export const untagArticleArgs = s.object({
  articleId: nonBlankTrimmedIdSchema,
  tagId: nonBlankTrimmedIdSchema,
});
export const getArticleTagsArgs = s.object({ articleId: nonBlankTrimmedIdSchema });
export const listArticlesByTagArgs = s.object({
  tagId: nonBlankTrimmedIdSchema,
  mode: v.optional(articleListModeSchema),
  offset: v.optional(paginationOffsetSchema),
  limit: v.optional(paginationLimitSchema),
  accountId: v.optional(nonBlankTrimmedIdSchema),
});
export const getTagArticleCountsArgs = s.object({
  accountId: v.optional(nonBlankTrimmedIdSchema),
});
