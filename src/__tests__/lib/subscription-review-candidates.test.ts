import { describe, expect, it } from "vitest";
import type { FeedArticleSummaryDto, FeedDto, FolderDto } from "@/api/tauri-commands";
import {
  buildFolderNameByIdMap,
  buildSubscriptionReviewCandidates,
  buildSubscriptionReviewReasonFacts,
  resolveSubscriptionCleanupRecommendation,
  resolveSubscriptionReviewReasonFactTranslationKey,
  resolveSubscriptionReviewSummaryTranslationKey,
  summarizeSubscriptionReviewCandidate,
} from "@/lib/subscriptions/subscription-review-candidates";

const feeds: FeedDto[] = [
  {
    id: "feed-stale",
    account_id: "acc-1",
    folder_id: "folder-work",
    remote_id: null,
    title: "Old Product Blog",
    url: "https://example.com/old.xml",
    site_url: "https://example.com/old",
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-active",
    account_id: "acc-1",
    folder_id: null,
    remote_id: null,
    title: "Active Feed",
    url: "https://example.com/active.xml",
    site_url: "https://example.com/active",
    unread_count: 3,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-mid",
    account_id: "acc-1",
    folder_id: null,
    remote_id: null,
    title: "Quiet Feed",
    url: "https://example.com/quiet.xml",
    site_url: "https://example.com/quiet",
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
];

const folders: FolderDto[] = [
  {
    id: "folder-work",
    account_id: "acc-1",
    name: "Work",
    sort_order: 0,
  },
];

const feedArticleSummaries: FeedArticleSummaryDto[] = [
  {
    feed_id: "feed-stale",
    latest_article_at: "2025-11-01T10:00:00Z",
    starred_count: 1,
  },
  {
    feed_id: "feed-active",
    latest_article_at: "2026-04-01T09:00:00Z",
    starred_count: 1,
  },
  {
    feed_id: "feed-mid",
    latest_article_at: "2026-01-01T12:00:00Z",
    starred_count: 0,
  },
];

describe("buildSubscriptionReviewCandidates", () => {
  it("builds a folder name lookup by folder id", () => {
    expect(buildFolderNameByIdMap(folders)).toEqual(new Map([["folder-work", "Work"]]));
  });

  it("uses the last duplicate folder id entry and preserves blank folder names for review candidate folder labels", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds: [
        { ...feeds[0], id: "feed-duplicate-folder" },
        { ...feeds[0], id: "feed-blank-folder", folder_id: "folder-empty", title: "Blank Folder Feed" },
      ],
      folders: [
        ...folders,
        { id: "folder-work", account_id: "acc-1", name: "Work override", sort_order: 1 },
        { id: "folder-empty", account_id: "acc-1", name: "", sort_order: 2 },
      ],
      feedArticleSummaries: [
        {
          feed_id: "feed-duplicate-folder",
          latest_article_at: "2026-04-01T00:00:00Z",
          starred_count: 1,
        },
        {
          feed_id: "feed-blank-folder",
          latest_article_at: "2026-04-01T00:00:00Z",
          starred_count: 1,
        },
      ],
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });

    expect(buildFolderNameByIdMap([...folders, { ...folders[0], name: "Work override", sort_order: 1 }])).toEqual(
      new Map([["folder-work", "Work override"]]),
    );
    expect(buildFolderNameByIdMap([{ id: "folder-empty", account_id: "acc-1", name: "", sort_order: 0 }])).toEqual(
      new Map([["folder-empty", ""]]),
    );
    expect(candidates.find((candidate) => candidate.feedId === "feed-duplicate-folder")).toMatchObject({
      feedId: "feed-duplicate-folder",
      folderName: "Work override",
    });
    expect(candidates.find((candidate) => candidate.feedId === "feed-blank-folder")).toMatchObject({
      feedId: "feed-blank-folder",
      folderName: "",
    });
  });

  it("derives one candidate per feed with latest article, folder name, and signal counts", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds,
      folders,
      feedArticleSummaries,
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });

    expect(candidates).toHaveLength(3);
    expect(candidates[0]).toMatchObject({
      feedId: "feed-stale",
      title: "Old Product Blog",
      folderName: "Work",
      latestArticleAt: "2025-11-01T10:00:00Z",
      unreadCount: 0,
      starredCount: 1,
    });
  });

  it("uses the last duplicate feed article summary for review signal projection", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds: [{ ...feeds[0], id: "feed-duplicate-summary", unread_count: 0 }],
      folders,
      feedArticleSummaries: [
        {
          feed_id: "feed-duplicate-summary",
          latest_article_at: "2026-04-01T00:00:00Z",
          starred_count: 0,
        },
        {
          feed_id: "feed-duplicate-summary",
          latest_article_at: "2025-01-01T00:00:00Z",
          starred_count: 7,
        },
      ],
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });

    expect(candidates[0]).toMatchObject({
      feedId: "feed-duplicate-summary",
      latestArticleAt: "2025-01-01T00:00:00Z",
      staleDays: 459,
      starredCount: 7,
      reasonKeys: ["stale_90d", "no_unread"],
    });
  });

  it("marks stale low-signal feeds with cleanup reasons and sorts the strongest candidate first", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds,
      folders,
      feedArticleSummaries,
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });

    expect(candidates.map((candidate) => candidate.feedId)).toEqual(["feed-stale", "feed-mid", "feed-active"]);
    expect(candidates[0]?.reasonKeys).toEqual(["stale_90d", "no_unread"]);
    expect(candidates[1]?.reasonKeys).toEqual(["stale_90d", "no_unread", "no_stars"]);
    expect(candidates[2]?.reasonKeys).toEqual([]);
    expect(candidates[0]?.staleDays).toBeGreaterThan(90);
  });

  it("keeps multi-reason candidates in review copy order with the high-priority summary", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds,
      folders,
      feedArticleSummaries,
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });

    const multiReasonCandidate = candidates.find((candidate) => candidate.feedId === "feed-mid");

    if (!multiReasonCandidate) {
      throw new Error("expected review candidates to include the multi-reason feed");
    }

    expect(multiReasonCandidate.reasonKeys).toEqual(["stale_90d", "no_unread", "no_stars"]);
    expect(summarizeSubscriptionReviewCandidate(multiReasonCandidate)).toEqual({
      tone: "high",
      titleKey: "review_now",
      summaryKey: "stale_and_inactive",
    });
    expect(buildSubscriptionReviewReasonFacts(multiReasonCandidate)).toEqual([
      { key: "stale_days", value: 93 },
      { key: "unread_count", value: 0 },
      { key: "starred_count", value: 0 },
    ]);
  });

  it("marks stale feeds at the 90 day boundary only", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds: [
        { ...feeds[0], id: "feed-stale-boundary", unread_count: 1 },
        { ...feeds[1], id: "feed-recent-boundary", unread_count: 1 },
      ],
      folders,
      feedArticleSummaries: [
        {
          feed_id: "feed-stale-boundary",
          latest_article_at: "2026-01-05T00:00:00Z",
          starred_count: 1,
        },
        {
          feed_id: "feed-recent-boundary",
          latest_article_at: "2026-01-06T00:00:00Z",
          starred_count: 1,
        },
      ],
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });

    expect(candidates.find((candidate) => candidate.feedId === "feed-stale-boundary")).toMatchObject({
      staleDays: 90,
      reasonKeys: ["stale_90d"],
    });
    expect(candidates.find((candidate) => candidate.feedId === "feed-recent-boundary")).toMatchObject({
      staleDays: 89,
      reasonKeys: [],
    });
  });

  it("does not expose stale review state for future latest article dates", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds: [
        { ...feeds[0], id: "feed-stale", title: "Past Feed", unread_count: 1 },
        {
          ...feeds[1],
          id: "feed-future",
          title: "Future Feed",
          unread_count: 1,
        },
      ],
      folders,
      feedArticleSummaries: [
        {
          feed_id: "feed-stale",
          latest_article_at: "2026-01-01T00:00:00Z",
          starred_count: 1,
        },
        {
          feed_id: "feed-future",
          latest_article_at: "2026-04-06T00:00:00Z",
          starred_count: 1,
        },
      ],
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });

    const futureCandidate = candidates.find((candidate) => candidate.feedId === "feed-future");

    if (!futureCandidate) {
      throw new Error("expected review candidates to include the future-dated feed");
    }

    expect(candidates.map((candidate) => candidate.feedId)).toEqual(["feed-stale", "feed-future"]);
    const futureFacts = buildSubscriptionReviewReasonFacts(futureCandidate);

    expect(futureCandidate).toMatchObject({
      staleDays: 0,
      reasonKeys: [],
    });
    expect(futureCandidate.reasonKeys).not.toContain("stale_90d");
    expect(futureCandidate.staleDays).toBeGreaterThanOrEqual(0);
    expect(futureFacts).toEqual([]);
    expect(futureFacts.every((fact) => fact.value >= 0)).toBe(true);
    expect(resolveSubscriptionCleanupRecommendation(futureCandidate)).toBe("retain");
  });

  it("excludes candidates removed by keep or later local state", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds,
      folders,
      feedArticleSummaries,
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(["feed-stale", "feed-mid"]),
    });

    expect(candidates.map((candidate) => candidate.feedId)).toEqual(["feed-active"]);
  });

  it("excludes hidden feeds before summary and reason sorting", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds: [
        {
          ...feeds[0],
          id: "feed-hidden-critical",
          title: "A Hidden Critical Feed",
          unread_count: 0,
        },
        {
          ...feeds[0],
          id: "feed-visible-medium",
          title: "B Visible Medium Feed",
          unread_count: 4,
        },
        {
          ...feeds[0],
          id: "feed-visible-low",
          title: "C Visible Low Feed",
          unread_count: 4,
        },
      ],
      folders,
      feedArticleSummaries: [
        {
          feed_id: "feed-hidden-critical",
          latest_article_at: "2025-01-01T00:00:00Z",
          starred_count: 0,
        },
        {
          feed_id: "feed-visible-medium",
          latest_article_at: "2026-01-01T00:00:00Z",
          starred_count: 1,
        },
        {
          feed_id: "feed-visible-low",
          latest_article_at: "2026-03-01T00:00:00Z",
          starred_count: 1,
        },
      ],
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(["feed-hidden-critical"]),
    });

    expect(candidates.map((candidate) => candidate.feedId)).toEqual(["feed-visible-medium", "feed-visible-low"]);
    expect(candidates.map((candidate) => summarizeSubscriptionReviewCandidate(candidate).summaryKey)).toEqual([
      "stale_but_supported",
      "healthy_feed",
    ]);
    expect(candidates.map((candidate) => buildSubscriptionReviewReasonFacts(candidate))).toEqual([
      [{ key: "stale_days", value: 94 }],
      [],
    ]);
  });

  it("does not mark feeds with no fetched articles as review candidates just because counts are zero", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds: [
        {
          id: "feed-empty",
          account_id: "acc-1",
          folder_id: null,
          remote_id: null,
          title: "Empty Feed",
          url: "https://example.com/empty.xml",
          site_url: "https://example.com/empty",
          unread_count: 0,
          reader_mode: "inherit",
          web_preview_mode: "inherit",
        },
      ],
      folders,
      feedArticleSummaries: [],
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });

    expect(candidates[0]).toMatchObject({
      feedId: "feed-empty",
      latestArticleAt: null,
      reasonKeys: [],
      starredCount: 0,
    });
    expect(summarizeSubscriptionReviewCandidate(candidates[0])).toMatchObject({
      tone: "low",
      titleKey: "keep",
    });
  });

  it("clamps negative signal counts before deriving review reasons and facts", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds: [
        {
          ...feeds[0],
          id: "feed-negative-signals",
          unread_count: -10,
        },
      ],
      folders,
      feedArticleSummaries: [
        {
          feed_id: "feed-negative-signals",
          latest_article_at: "2026-01-01T00:00:00Z",
          starred_count: -3,
        },
      ],
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });

    expect(candidates[0]).toMatchObject({
      feedId: "feed-negative-signals",
      unreadCount: 0,
      starredCount: 0,
      reasonKeys: ["stale_90d", "no_unread", "no_stars"],
    });
    expect(buildSubscriptionReviewReasonFacts(candidates[0])).toEqual([
      { key: "stale_days", value: 94 },
      { key: "unread_count", value: 0 },
      { key: "starred_count", value: 0 },
    ]);
  });

  it("sorts equally stale candidates by reason count, unread count, starred count, then title", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds: [
        {
          ...feeds[0],
          id: "feed-low-reasons",
          title: "Delta",
          unread_count: 4,
        },
        {
          ...feeds[0],
          id: "feed-more-reasons",
          title: "Charlie",
          unread_count: 0,
        },
        {
          ...feeds[0],
          id: "feed-fewer-unread",
          title: "Bravo",
          unread_count: 1,
        },
        {
          ...feeds[0],
          id: "feed-fewer-stars",
          title: "Alpha",
          unread_count: 1,
        },
        { ...feeds[0], id: "feed-title-tie", title: "Able", unread_count: 1 },
      ],
      folders,
      feedArticleSummaries: [
        {
          feed_id: "feed-low-reasons",
          latest_article_at: "2026-01-01T00:00:00Z",
          starred_count: 2,
        },
        {
          feed_id: "feed-more-reasons",
          latest_article_at: "2026-01-01T00:00:00Z",
          starred_count: 2,
        },
        {
          feed_id: "feed-fewer-unread",
          latest_article_at: "2026-01-01T00:00:00Z",
          starred_count: 2,
        },
        {
          feed_id: "feed-fewer-stars",
          latest_article_at: "2026-01-01T00:00:00Z",
          starred_count: 1,
        },
        {
          feed_id: "feed-title-tie",
          latest_article_at: "2026-01-01T00:00:00Z",
          starred_count: 1,
        },
      ],
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });

    expect(candidates.map((candidate) => candidate.feedId)).toEqual([
      "feed-more-reasons",
      "feed-title-tie",
      "feed-fewer-stars",
      "feed-fewer-unread",
      "feed-low-reasons",
    ]);
  });

  it("summarizes candidate urgency for the review panel", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds,
      folders,
      feedArticleSummaries,
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });

    const firstCandidate = candidates[0];
    const thirdCandidate = candidates[2];

    if (!firstCandidate || !thirdCandidate) {
      throw new Error("expected cleanup candidates to include review and keep entries");
    }

    expect(summarizeSubscriptionReviewCandidate(firstCandidate)).toEqual({
      tone: "high",
      titleKey: "review_now",
      summaryKey: "stale_and_inactive",
    });
    expect(summarizeSubscriptionReviewCandidate(thirdCandidate)).toEqual({
      tone: "low",
      titleKey: "keep",
      summaryKey: "healthy_feed",
    });
  });

  it("summarizes each stale, unread, and starred signal combination for review copy", () => {
    const candidate = {
      feedId: "feed-signals",
      title: "Signal Feed",
      folderId: null,
      folderName: null,
      latestArticleAt: "2026-01-01T00:00:00Z",
      staleDays: 94,
      unreadCount: 1,
      starredCount: 1,
    };

    expect(
      summarizeSubscriptionReviewCandidate({
        ...candidate,
        reasonKeys: ["stale_90d", "no_stars"],
      }),
    ).toEqual({
      tone: "medium",
      titleKey: "consider",
      summaryKey: "stale_with_no_stars",
    });
    expect(
      summarizeSubscriptionReviewCandidate({
        ...candidate,
        reasonKeys: ["no_unread", "no_stars"],
      }),
    ).toEqual({
      tone: "medium",
      titleKey: "consider",
      summaryKey: "inactive_without_signals",
    });
    expect(
      summarizeSubscriptionReviewCandidate({
        ...candidate,
        reasonKeys: ["stale_90d"],
      }),
    ).toEqual({
      tone: "medium",
      titleKey: "consider",
      summaryKey: "stale_but_supported",
    });
    expect(
      summarizeSubscriptionReviewCandidate({
        ...candidate,
        reasonKeys: ["no_stars"],
      }),
    ).toEqual({
      tone: "low",
      titleKey: "keep",
      summaryKey: "healthy_feed",
    });
  });

  it("separates cleanup recommendation from review reason signals", () => {
    const candidate = {
      feedId: "feed-signals",
      title: "Signal Feed",
      folderId: null,
      folderName: null,
      latestArticleAt: "2026-01-01T00:00:00Z",
      staleDays: 94,
      unreadCount: 0,
      starredCount: 0,
    };

    expect(
      resolveSubscriptionCleanupRecommendation({
        ...candidate,
        reasonKeys: ["stale_90d", "no_unread"],
      }),
    ).toBe("cleanup_candidate");
    expect(
      resolveSubscriptionCleanupRecommendation({
        ...candidate,
        reasonKeys: ["stale_90d", "no_stars"],
      }),
    ).toBe("watch");
    expect(
      resolveSubscriptionCleanupRecommendation({
        ...candidate,
        reasonKeys: ["no_unread", "no_stars"],
      }),
    ).toBe("watch");
    expect(
      resolveSubscriptionCleanupRecommendation({
        ...candidate,
        reasonKeys: ["no_stars"],
      }),
    ).toBe("retain");
  });

  it("builds reason facts only for active review reasons", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds,
      folders,
      feedArticleSummaries,
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });

    expect(buildSubscriptionReviewReasonFacts(candidates[0])).toEqual([
      { key: "stale_days", value: 154 },
      { key: "unread_count", value: 0 },
    ]);
    expect(buildSubscriptionReviewReasonFacts(candidates[1])).toEqual([
      { key: "stale_days", value: 93 },
      { key: "unread_count", value: 0 },
      { key: "starred_count", value: 0 },
    ]);
    expect(buildSubscriptionReviewReasonFacts(candidates[2])).toEqual([]);
  });

  it("resolves review summary translation keys", () => {
    expect(resolveSubscriptionReviewSummaryTranslationKey("stale_and_inactive")).toBe(
      "detail_reason_stale_and_inactive",
    );
    expect(resolveSubscriptionReviewSummaryTranslationKey("stale_with_no_stars")).toBe(
      "detail_reason_stale_with_no_stars",
    );
    expect(resolveSubscriptionReviewSummaryTranslationKey("inactive_without_signals")).toBe(
      "detail_reason_inactive_without_signals",
    );
    expect(resolveSubscriptionReviewSummaryTranslationKey("stale_but_supported")).toBe(
      "detail_reason_stale_but_supported",
    );
    expect(resolveSubscriptionReviewSummaryTranslationKey("healthy_feed")).toBe("detail_reason_normal");
  });

  it("resolves review reason fact translation keys", () => {
    expect(resolveSubscriptionReviewReasonFactTranslationKey("stale_days")).toBe("fact_stale_days");
    expect(resolveSubscriptionReviewReasonFactTranslationKey("unread_count")).toBe("fact_unread_count");
    expect(resolveSubscriptionReviewReasonFactTranslationKey("starred_count")).toBe("fact_starred_count");
  });
});
