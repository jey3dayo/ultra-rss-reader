import { z } from "zod";
import { IsoDateTimeStringSchema, NonnegativeIntegerSchema } from "./common";

export const FeedArticleSummaryDtoSchema = z.strictObject({
  feed_id: z.string(),
  latest_article_at: IsoDateTimeStringSchema.nullable(),
  starred_count: NonnegativeIntegerSchema,
  // Count of visible articles published in the recent activity window (last 30 days,
  // future-dated rows excluded). Backend source of truth: RECENT_ARTICLE_ACTIVITY_WINDOW_DAYS.
  // Tier classification lives in src/lib/subscriptions/subscription-update-frequency.ts.
  recent_article_count: NonnegativeIntegerSchema,
});

export const FeedArticleSummaryDtoListSchema = z.array(FeedArticleSummaryDtoSchema);

export type FeedArticleSummaryDto = z.output<typeof FeedArticleSummaryDtoSchema>;
