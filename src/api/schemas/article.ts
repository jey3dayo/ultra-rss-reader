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
});

export type ArticleDto = z.infer<typeof ArticleDtoSchema>;
