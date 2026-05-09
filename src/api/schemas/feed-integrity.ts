import { z } from "zod";

const FeedIntegrityIssueDtoSchema = z.object({
  missing_feed_id: z.string(),
  article_count: z.number().int().nonnegative(),
  latest_article_title: z.string().nullable(),
  latest_article_published_at: z.string().nullable(),
});

export const FeedIntegrityReportDtoSchema = z.object({
  orphaned_article_count: z.number().int().nonnegative(),
  orphaned_feeds: z.array(FeedIntegrityIssueDtoSchema),
});

export const FeedIntegrityCleanupDtoSchema = z.object({
  dry_run: z.boolean(),
  orphaned_article_count: z.number().int().nonnegative(),
  deleted_article_count: z.number().int().nonnegative(),
});

export type FeedIntegrityReportDto = z.output<typeof FeedIntegrityReportDtoSchema>;
export type FeedIntegrityCleanupDto = z.output<typeof FeedIntegrityCleanupDtoSchema>;
