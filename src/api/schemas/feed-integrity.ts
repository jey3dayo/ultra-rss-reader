import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { IsoDateTimeStringSchema, NonnegativeIntegerSchema } from "./common";

const FeedIntegrityIssueDtoSchema = s.strictObject({
  missing_feed_id: v.string(),
  article_count: NonnegativeIntegerSchema,
  latest_article_title: v.nullable(v.string()),
  latest_article_published_at: v.nullable(IsoDateTimeStringSchema),
});

export const FeedIntegrityReportDtoSchema = s.strictObject({
  orphaned_article_count: NonnegativeIntegerSchema,
  orphaned_feeds: v.array(FeedIntegrityIssueDtoSchema),
});

export const FeedIntegrityCleanupDtoSchema = v.pipe(
  s.strictObject({
    dry_run: v.boolean(),
    orphaned_article_count: NonnegativeIntegerSchema,
    deleted_article_count: NonnegativeIntegerSchema,
    orphaned_article_ids: v.optional(v.array(v.string())),
  }),
  v.forward(
    v.check((value) => !value.dry_run || value.deleted_article_count === 0, "Dry-run cleanup must not delete articles"),
    ["deleted_article_count"],
  ),
);
export type FeedIntegrityReportDto = v.InferOutput<typeof FeedIntegrityReportDtoSchema>;
export type FeedIntegrityCleanupDto = v.InferOutput<typeof FeedIntegrityCleanupDtoSchema>;

export type FeedIntegrityCleanupWarningKind = "count_mismatch" | "undo_unavailable";

export function getFeedIntegrityCleanupWarningKinds({
  dry_run,
  orphaned_article_count,
  deleted_article_count,
}: FeedIntegrityCleanupDto): FeedIntegrityCleanupWarningKind[] {
  if (dry_run) {
    return [];
  }

  const warnings: FeedIntegrityCleanupWarningKind[] = [];

  if (deleted_article_count !== orphaned_article_count) {
    warnings.push("count_mismatch");
  }
  if (deleted_article_count > 0) {
    warnings.push("undo_unavailable");
  }

  return warnings;
}
