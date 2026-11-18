import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { IsoDateTimeStringSchema, NonnegativeIntegerSchema } from "./common";

export const FeedArticleSummaryDtoSchema = s.strictObject({
  feed_id: v.string(),
  latest_article_at: v.nullable(IsoDateTimeStringSchema),
  // Newest article publication time ever observed for the feed, tracked on
  // the feed itself so it survives retention purges of read articles.
  // Null until any sync has observed an article for the feed.
  last_seen_article_at: v.nullable(IsoDateTimeStringSchema),
  starred_count: NonnegativeIntegerSchema,
  // Count of visible articles published in the recent activity window (last 30 days,
  // future-dated rows excluded). Backend source of truth: RECENT_ARTICLE_ACTIVITY_WINDOW_DAYS.
  // Pace and frequent-criteria resolution lives in src/lib/subscriptions/subscription-update-frequency.ts.
  recent_article_count: NonnegativeIntegerSchema,
});

export const FeedArticleSummaryDtoListSchema = v.array(FeedArticleSummaryDtoSchema);

export type FeedArticleSummaryDto = v.InferOutput<typeof FeedArticleSummaryDtoSchema>;
