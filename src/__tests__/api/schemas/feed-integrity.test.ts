import { describe, expect, it } from "vitest";
import {
  type FeedIntegrityCleanupDto,
  FeedIntegrityCleanupDtoSchema,
  type FeedIntegrityReportDto,
  FeedIntegrityReportDtoSchema,
  getFeedIntegrityCleanupWarningKinds,
} from "@/api/schemas/feed-integrity";

const getFeedIntegrityReportResponseFixture = {
  orphaned_article_count: 2,
  orphaned_feeds: [
    {
      missing_feed_id: "missing-feed-1",
      article_count: 2,
      latest_article_title: "Latest orphaned article",
      latest_article_published_at: "2026-04-20T10:00:00Z",
    },
    {
      missing_feed_id: "missing-feed-2",
      article_count: 0,
      latest_article_title: null,
      latest_article_published_at: null,
    },
  ],
} satisfies FeedIntegrityReportDto;

const cleanupDryRunFixture = {
  dry_run: true,
  orphaned_article_count: 2,
  deleted_article_count: 0,
  orphaned_article_ids: ["article-1", "article-2"],
} satisfies FeedIntegrityCleanupDto;

describe("FeedIntegrityReportDtoSchema", () => {
  it("parses a get_feed_integrity_report read-only command response fixture", () => {
    expect(FeedIntegrityReportDtoSchema.parse(getFeedIntegrityReportResponseFixture)).toEqual(
      getFeedIntegrityReportResponseFixture,
    );
  });

  it("rejects invalid orphan counts", () => {
    expect(
      FeedIntegrityReportDtoSchema.safeParse({
        ...getFeedIntegrityReportResponseFixture,
        orphaned_article_count: -1,
      }).success,
    ).toBe(false);
    expect(
      FeedIntegrityReportDtoSchema.safeParse({
        ...getFeedIntegrityReportResponseFixture,
        orphaned_feeds: [
          {
            ...getFeedIntegrityReportResponseFixture.orphaned_feeds[0],
            article_count: 1.5,
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      FeedIntegrityReportDtoSchema.safeParse({
        ...getFeedIntegrityReportResponseFixture,
        orphaned_feeds: [
          {
            ...getFeedIntegrityReportResponseFixture.orphaned_feeds[0],
            article_count: Number.POSITIVE_INFINITY,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects invalid orphan latest article timestamps", () => {
    expect(
      FeedIntegrityReportDtoSchema.safeParse({
        ...getFeedIntegrityReportResponseFixture,
        orphaned_feeds: [
          {
            ...getFeedIntegrityReportResponseFixture.orphaned_feeds[0],
            latest_article_published_at: "2026-04-20",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      FeedIntegrityReportDtoSchema.safeParse({
        ...getFeedIntegrityReportResponseFixture,
        orphaned_feeds: [
          {
            ...getFeedIntegrityReportResponseFixture.orphaned_feeds[0],
            latest_article_published_at: "not-a-date",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects unknown backend DTO fields", () => {
    expect(
      FeedIntegrityReportDtoSchema.safeParse({
        ...getFeedIntegrityReportResponseFixture,
        backend_added_field: "unexpected",
      }).success,
    ).toBe(false);
    expect(
      FeedIntegrityReportDtoSchema.safeParse({
        ...getFeedIntegrityReportResponseFixture,
        orphaned_feeds: [
          {
            ...getFeedIntegrityReportResponseFixture.orphaned_feeds[0],
            backend_added_field: "unexpected",
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("FeedIntegrityCleanupDtoSchema", () => {
  it("accepts dry-run cleanup only when no articles were deleted", () => {
    expect(FeedIntegrityCleanupDtoSchema.parse(cleanupDryRunFixture)).toEqual(cleanupDryRunFixture);
    expect(
      FeedIntegrityCleanupDtoSchema.safeParse({
        ...cleanupDryRunFixture,
        deleted_article_count: 1,
      }).success,
    ).toBe(false);
  });

  it("accepts destructive cleanup count drift as a partial result", () => {
    expect(
      FeedIntegrityCleanupDtoSchema.safeParse({
        dry_run: false,
        orphaned_article_count: 2,
        deleted_article_count: 2,
      }).success,
    ).toBe(true);
    expect(
      FeedIntegrityCleanupDtoSchema.safeParse({
        dry_run: false,
        orphaned_article_count: 2,
        deleted_article_count: 3,
      }).success,
    ).toBe(true);
  });

  it("maps destructive cleanup count drift and irreversible deletion to UI warning kinds", () => {
    expect(getFeedIntegrityCleanupWarningKinds(cleanupDryRunFixture)).toEqual([]);
    expect(
      getFeedIntegrityCleanupWarningKinds({
        dry_run: false,
        orphaned_article_count: 2,
        deleted_article_count: 1,
      }),
    ).toEqual(["count_mismatch", "undo_unavailable"]);
    expect(
      getFeedIntegrityCleanupWarningKinds({
        dry_run: false,
        orphaned_article_count: 2,
        deleted_article_count: 3,
      }),
    ).toEqual(["count_mismatch", "undo_unavailable"]);
    expect(
      getFeedIntegrityCleanupWarningKinds({
        dry_run: false,
        orphaned_article_count: 0,
        deleted_article_count: 0,
      }),
    ).toEqual([]);
  });

  it("keeps dry-run counts informational and reserves mismatch warnings for destructive cleanup results", () => {
    expect(
      getFeedIntegrityCleanupWarningKinds({
        dry_run: true,
        orphaned_article_count: 4,
        deleted_article_count: 0,
      }),
    ).toEqual([]);
    expect(
      getFeedIntegrityCleanupWarningKinds({
        dry_run: false,
        orphaned_article_count: 4,
        deleted_article_count: 0,
      }),
    ).toEqual(["count_mismatch"]);
  });

  it("keeps undo-unavailable warnings tied to actual destructive deletion count", () => {
    expect(
      getFeedIntegrityCleanupWarningKinds({
        dry_run: false,
        orphaned_article_count: 2,
        deleted_article_count: 2,
      }),
    ).toEqual(["undo_unavailable"]);
    expect(
      getFeedIntegrityCleanupWarningKinds({
        dry_run: false,
        orphaned_article_count: 2,
        deleted_article_count: 0,
      }),
    ).not.toContain("undo_unavailable");
  });
});
