import { describe, expect, it } from "vitest";
import { type FeedIntegrityReportDto, FeedIntegrityReportDtoSchema } from "@/api/schemas/feed-integrity";

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
  });
});
