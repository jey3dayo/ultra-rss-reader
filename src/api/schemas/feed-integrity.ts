import { z } from "zod";

export const FeedIntegrityReportDtoSchema = z.object({
  orphaned_article_count: z.number().int().nonnegative(),
});

export type FeedIntegrityReportDto = z.infer<typeof FeedIntegrityReportDtoSchema>;
