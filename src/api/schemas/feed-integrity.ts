import { z } from "zod";

export const FeedIntegrityIssueDtoSchema = z.object({
  missing_feed_id: z.string(),
  article_count: z.number().int().nonnegative(),
  latest_article_title: z.string().nullable(),
  latest_article_published_at: z.string().nullable(),
});

export const FeedIntegrityReportDtoSchema = z.object({
  orphaned_article_count: z.number().int().nonnegative(),
  orphaned_feeds: z.array(FeedIntegrityIssueDtoSchema),
});

export type FeedIntegrityIssueDto = z.infer<typeof FeedIntegrityIssueDtoSchema>;
export type FeedIntegrityReportDto = z.infer<typeof FeedIntegrityReportDtoSchema>;
