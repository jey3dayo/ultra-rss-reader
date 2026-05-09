import { z } from "zod";
import { IsoDateTimeStringSchema, NonnegativeIntegerSchema } from "./common";

const FeedIntegrityIssueDtoSchema = z
  .object({
    missing_feed_id: z.string(),
    article_count: NonnegativeIntegerSchema,
    latest_article_title: z.string().nullable(),
    latest_article_published_at: IsoDateTimeStringSchema.nullable(),
  })
  .strict();

export const FeedIntegrityReportDtoSchema = z
  .object({
    orphaned_article_count: NonnegativeIntegerSchema,
    orphaned_feeds: z.array(FeedIntegrityIssueDtoSchema),
  })
  .strict();

export const FeedIntegrityCleanupDtoSchema = z
  .object({
    dry_run: z.boolean(),
    orphaned_article_count: NonnegativeIntegerSchema,
    deleted_article_count: NonnegativeIntegerSchema,
  })
  .strict();

export type FeedIntegrityReportDto = z.output<typeof FeedIntegrityReportDtoSchema>;
export type FeedIntegrityCleanupDto = z.output<typeof FeedIntegrityCleanupDtoSchema>;
