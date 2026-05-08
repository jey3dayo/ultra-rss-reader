import { z } from "zod";
import { NonnegativeIntegerSchema } from "./common";

export const FeedArticleSummaryDtoSchema = z.object({
  feed_id: z.string(),
  latest_article_at: z.string().nullable(),
  starred_count: NonnegativeIntegerSchema,
});

export const FeedArticleSummaryDtoListSchema = z.array(FeedArticleSummaryDtoSchema);

export type FeedArticleSummaryDto = z.infer<typeof FeedArticleSummaryDtoSchema>;
