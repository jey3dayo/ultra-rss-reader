import { z } from "zod";
import { IsoDateTimeStringSchema } from "./common";

const nullableNonBlankStringSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1))
  .nullable();

export const ArticleDtoSchema = z
  .object({
    id: z.string(),
    feed_id: z.string(),
    title: z.string(),
    content_sanitized: z.string(),
    summary: z.string().nullable(),
    url: nullableNonBlankStringSchema,
    author: z.string().nullable(),
    published_at: IsoDateTimeStringSchema,
    thumbnail: nullableNonBlankStringSchema,
    is_read: z.boolean(),
    is_starred: z.boolean(),
    viewed_at: IsoDateTimeStringSchema.nullable().optional(),
  })
  .strict();

export const ArticleDtoListSchema = z.array(ArticleDtoSchema);

export type ArticleDto = z.output<typeof ArticleDtoSchema>;
