import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { normalizeArticleRemoteImageUrl } from "@/lib/articles/article-view";
import { IsoDateTimeStringSchema } from "./common";

const nullableNonBlankStringSchema = v.nullable(v.pipe(v.string(), v.trim(), v.minLength(1)));

const nullableRemoteImageUrlSchema = v.nullable(
  v.pipe(
    v.string(),
    v.transform((value: string) => normalizeArticleRemoteImageUrl(value) ?? ""),
    v.minLength(1),
  ),
);

const sanitizedArticleHtmlDtoShape = {
  content_sanitized: v.string(),
} as const;

export const SanitizedArticleHtmlDtoSchema = s.object(sanitizedArticleHtmlDtoShape);

export const ArticleDtoSchema = s.strictObject({
  id: v.string(),
  feed_id: v.string(),
  title: v.string(),
  ...sanitizedArticleHtmlDtoShape,
  summary: v.nullable(v.string()),
  url: nullableNonBlankStringSchema,
  author: v.nullable(v.string()),
  published_at: IsoDateTimeStringSchema,
  thumbnail: nullableRemoteImageUrlSchema,
  is_read: v.boolean(),
  is_starred: v.boolean(),
  viewed_at: v.optional(v.nullable(IsoDateTimeStringSchema)),
});

export const ArticleDtoListSchema = v.array(ArticleDtoSchema);

export const ArticleIdListResponseSchema = v.array(v.pipe(v.string(), v.minLength(1)));

export type SanitizedArticleHtmlDto = v.InferOutput<typeof SanitizedArticleHtmlDtoSchema>;
export type ArticleDto = v.InferOutput<typeof ArticleDtoSchema>;
