import { z } from "zod";
import { IsoDateTimeStringSchema, NonnegativeIntegerSchema } from "./common";

export const FeedArticleSummaryDtoSchema = z
  .object({
    feed_id: z.string(),
    latest_article_at: IsoDateTimeStringSchema.nullable(),
    starred_count: NonnegativeIntegerSchema,
  })
  .strict();

export const FeedArticleSummaryDtoListSchema = z.array(FeedArticleSummaryDtoSchema);

export type FeedArticleSummaryDto = z.output<typeof FeedArticleSummaryDtoSchema>;
