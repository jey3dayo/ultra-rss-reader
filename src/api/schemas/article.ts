import { z } from "zod";

export const ArticleDtoSchema = z.object({
  id: z.string(),
  feed_id: z.string(),
  title: z.string(),
  content_sanitized: z.string(),
  summary: z.string().nullable(),
  url: z.string().nullable(),
  author: z.string().nullable(),
  published_at: z.string(),
  thumbnail: z.string().nullable(),
  is_read: z.boolean(),
  is_starred: z.boolean(),
  viewed_at: z.string().nullable().optional(),
});

export const ArticleDtoListSchema = z.array(ArticleDtoSchema);

export type ArticleDto = z.infer<typeof ArticleDtoSchema>;
