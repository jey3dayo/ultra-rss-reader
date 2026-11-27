import { describe, expect, it } from "vitest";
import type { FeedArticleSummaryDto, FeedDto, FolderDto } from "@/api/tauri-commands";
import {
  buildFolderNameByIdMap,
  buildSubscriptionReviewCandidates,
  buildSubscriptionReviewReasonFacts,
  resolveLatestKnownArticleAt,
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
    icon_url: null,
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
    created_at: null,
  },
  {
    id: "feed-active",
    account_id: "acc-1",
    folder_id: null,
    remote_id: null,
    title: "Active Feed",
    url: "https://example.com/active.xml",
    site_url: "https://example.com/active",
    icon_url: null,
    unread_count: 3,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
    created_at: null,
  },
  {
    id: "feed-mid",
    account_id: "acc-1",
    folder_id: null,
    remote_id: null,
    title: "Quiet Feed",
    url: "https://example.com/quiet.xml",
    site_url: "https://example.com/quiet",
    icon_url: null,
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
    created_at: null,
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
    last_seen_article_at: null,
    last_seen_article_probe_completed: false,
    starred_count: 1,
    recent_article_count: 0,
  },
  {
    feed_id: "feed-active",
    latest_article_at: "2026-04-01T09:00:00Z",
    last_seen_article_at: null,
    last_seen_article_probe_completed: false,
    starred_count: 1,
    recent_article_count: 0,
  },
  {
    feed_id: "feed-mid",
    latest_article_at: "2026-01-01T12:00:00Z",
    last_seen_article_at: null,
    last_seen_article_probe_completed: false,
    starred_count: 0,
    recent_article_count: 0,
  },
];

describe("buildSubscriptionReviewCandidates", () => {
  it("builds a folder name lookup by folder id", () => {
    expect(buildFolderNameByIdMap(folders)).toEqual(new Map([["folder-work", "Work"]]));
  });

  it("uses the last duplicate folder id entry and preserves blank folder names for review candidate folder labels", () => {
    const candidates = buildSubscriptionReviewCandidates({
      isLocalAccount: true,
      isAccountSyncEnabled: true,
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
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 1,
          recent_article_count: 0,
        },
        {
          feed_id: "feed-blank-folder",
          latest_article_at: "2026-04-01T00:00:00Z",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 1,
          recent_article_count: 0,
        },
      ],
      now: new Date("2026-04-05T00:00:00Z"),
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
      isLocalAccount: true,
      isAccountSyncEnabled: true,
      feeds,
      folders,
      feedArticleSummaries,
      now: new Date("2026-04-05T00:00:00Z"),
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
      isLocalAccount: true,
      isAccountSyncEnabled: true,
      feeds: [{ ...feeds[0], id: "feed-duplicate-summary", unread_count: 0 }],
      folders,
      feedArticleSummaries: [
        {
          feed_id: "feed-duplicate-summary",
          latest_article_at: "2026-04-01T00:00:00Z",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 0,
          recent_article_count: 0,
        },
        {
          feed_id: "feed-duplicate-summary",
          latest_article_at: "2025-01-01T00:00:00Z",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 7,
          recent_article_count: 0,
        },
      ],
      now: new Date("2026-04-05T00:00:00Z"),
    });

    expect(candidates[0]).toMatchObject({
      feedId: "feed-duplicate-summary",
      latestArticleAt: "2025-01-01T00:00:00Z",
      staleDays: 459,
      sinceCreatedDays: null,
      starredCount: 7,
      reasonKeys: ["stale_90d", "quiet_no_unread"],
    });
  });

  it("marks stale low-signal feeds with cleanup reasons and sorts the strongest candidate first", () => {
    const candidates = buildSubscriptionReviewCandidates({
      isLocalAccount: true,
      isAccountSyncEnabled: true,
      feeds,
      folders,
      feedArticleSummaries,
      now: new Date("2026-04-05T00:00:00Z"),
    });

    expect(candidates.map((candidate) => candidate.feedId)).toEqual(["feed-stale", "feed-mid", "feed-active"]);
    expect(candidates[0]?.reasonKeys).toEqual(["stale_90d", "quiet_no_unread"]);
    expect(candidates[1]?.reasonKeys).toEqual(["stale_90d", "quiet_no_unread"]);
    expect(candidates[2]?.reasonKeys).toEqual([]);
    expect(candidates[0]?.staleDays).toBeGreaterThan(90);
  });

  it("keeps multi-reason candidates in review copy order with the high-priority summary", () => {
    const candidates = buildSubscriptionReviewCandidates({
      isLocalAccount: true,
      isAccountSyncEnabled: true,
      feeds,
      folders,
      feedArticleSummaries,
      now: new Date("2026-04-05T00:00:00Z"),
    });

    const multiReasonCandidate = candidates.find((candidate) => candidate.feedId === "feed-mid");

    if (!multiReasonCandidate) {
      throw new Error("expected review candidates to include the multi-reason feed");
    }

    expect(multiReasonCandidate.reasonKeys).toEqual(["stale_90d", "quiet_no_unread"]);
    expect(summarizeSubscriptionReviewCandidate(multiReasonCandidate)).toEqual({
      tone: "high",
      titleKey: "review_now",
      summaryKey: "stale_and_inactive",
    });
    expect(buildSubscriptionReviewReasonFacts(multiReasonCandidate)).toEqual([{ key: "unread_count", value: 0 }]);
  });

  it("marks stale feeds at the 90 day boundary only", () => {
    const candidates = buildSubscriptionReviewCandidates({
      isLocalAccount: true,
      isAccountSyncEnabled: true,
      feeds: [
        { ...feeds[0], id: "feed-stale-boundary", unread_count: 1 },
        { ...feeds[1], id: "feed-recent-boundary", unread_count: 1 },
      ],
      folders,
      feedArticleSummaries: [
        {
          feed_id: "feed-stale-boundary",
          latest_article_at: "2026-01-05T00:00:00Z",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 1,
          recent_article_count: 0,
        },
        {
          feed_id: "feed-recent-boundary",
          latest_article_at: "2026-01-06T00:00:00Z",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 1,
          recent_article_count: 0,
        },
      ],
      now: new Date("2026-04-05T00:00:00Z"),
    });

    expect(candidates.find((candidate) => candidate.feedId === "feed-stale-boundary")).toMatchObject({
      staleDays: 90,
      sinceCreatedDays: null,
      reasonKeys: ["stale_90d"],
    });
    expect(candidates.find((candidate) => candidate.feedId === "feed-recent-boundary")).toMatchObject({
      staleDays: 89,
      sinceCreatedDays: null,
      reasonKeys: ["attention_30d"],
    });
  });

  it("uses 30 days for attention and 60 days for review candidates", () => {
    const candidates = buildSubscriptionReviewCandidates({
      isLocalAccount: true,
      isAccountSyncEnabled: true,
      feeds: [
        { ...feeds[0], id: "feed-quiet-boundary", unread_count: 0 },
        { ...feeds[1], id: "feed-recent-unread-boundary", unread_count: 0 },
        { ...feeds[2], id: "feed-quiet-with-unread", unread_count: 1 },
        { ...feeds[0], id: "feed-review-boundary", unread_count: 0 },
        { ...feeds[1], id: "feed-review-recent-boundary", unread_count: 0 },
        { ...feeds[2], id: "feed-review-with-unread", unread_count: 1 },
      ],
      folders,
      feedArticleSummaries: [
        {
          feed_id: "feed-quiet-boundary",
          latest_article_at: "2026-03-06T00:00:00Z",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 0,
          recent_article_count: 0,
        },
        {
          feed_id: "feed-recent-unread-boundary",
          latest_article_at: "2026-03-07T00:00:00Z",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 0,
          recent_article_count: 0,
        },
        {
          feed_id: "feed-quiet-with-unread",
          latest_article_at: "2026-03-06T00:00:00Z",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 0,
          recent_article_count: 0,
        },
        {
          feed_id: "feed-review-boundary",
          latest_article_at: "2026-02-04T00:00:00Z",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 0,
          recent_article_count: 0,
        },
        {
          feed_id: "feed-review-recent-boundary",
          latest_article_at: "2026-02-05T00:00:00Z",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 0,
          recent_article_count: 0,
        },
        {
          feed_id: "feed-review-with-unread",
          latest_article_at: "2026-02-04T00:00:00Z",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 0,
          recent_article_count: 0,
        },
      ],
      now: new Date("2026-04-05T00:00:00Z"),
    });

    expect(candidates.find((candidate) => candidate.feedId === "feed-quiet-boundary")).toMatchObject({
      staleDays: 30,
      sinceCreatedDays: null,
      reasonKeys: ["attention_30d"],
    });
    expect(candidates.find((candidate) => candidate.feedId === "feed-recent-unread-boundary")).toMatchObject({
      staleDays: 29,
      sinceCreatedDays: null,
      reasonKeys: [],
    });
    expect(candidates.find((candidate) => candidate.feedId === "feed-quiet-with-unread")).toMatchObject({
      staleDays: 30,
      sinceCreatedDays: null,
      reasonKeys: ["attention_30d"],
    });
    expect(candidates.find((candidate) => candidate.feedId === "feed-review-boundary")).toMatchObject({
      staleDays: 60,
      sinceCreatedDays: null,
      reasonKeys: ["quiet_no_unread"],
    });
    expect(candidates.find((candidate) => candidate.feedId === "feed-review-recent-boundary")).toMatchObject({
      staleDays: 59,
      sinceCreatedDays: null,
      reasonKeys: ["attention_30d"],
    });
    expect(candidates.find((candidate) => candidate.feedId === "feed-review-with-unread")).toMatchObject({
      staleDays: 60,
      sinceCreatedDays: null,
      reasonKeys: ["attention_30d"],
    });
  });

  it("does not expose stale review state for future latest article dates", () => {
    const candidates = buildSubscriptionReviewCandidates({
      isLocalAccount: true,
      isAccountSyncEnabled: true,
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
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 1,
          recent_article_count: 0,
        },
        {
          feed_id: "feed-future",
          latest_article_at: "2026-04-06T00:00:00Z",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 1,
          recent_article_count: 0,
        },
      ],
      now: new Date("2026-04-05T00:00:00Z"),
    });

    const futureCandidate = candidates.find((candidate) => candidate.feedId === "feed-future");

    if (!futureCandidate) {
      throw new Error("expected review candidates to include the future-dated feed");
    }

    expect(candidates.map((candidate) => candidate.feedId)).toEqual(["feed-stale", "feed-future"]);
    const futureFacts = buildSubscriptionReviewReasonFacts(futureCandidate);

    expect(futureCandidate).toMatchObject({
      staleDays: 0,
      sinceCreatedDays: null,
      reasonKeys: [],
    });
    expect(futureCandidate.reasonKeys).not.toContain("stale_90d");
    expect(futureCandidate.staleDays).toBeGreaterThanOrEqual(0);
    expect(futureFacts).toEqual([]);
    expect(futureFacts.every((fact) => fact.value >= 0)).toBe(true);
    expect(resolveSubscriptionCleanupRecommendation(futureCandidate)).toBe("retain");
  });

  it("calculates stale days from UTC calendar days across DST and timezone offsets", () => {
    const candidates = buildSubscriptionReviewCandidates({
      isLocalAccount: true,
      isAccountSyncEnabled: true,
      feeds: [
        { ...feeds[0], id: "feed-dst-boundary", title: "DST Boundary", unread_count: 1 },
        { ...feeds[1], id: "feed-timezone-boundary", title: "Timezone Boundary", unread_count: 1 },
      ],
      folders,
      feedArticleSummaries: [
        {
          feed_id: "feed-dst-boundary",
          latest_article_at: "2026-03-08T05:30:00Z",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 1,
          recent_article_count: 0,
        },
        {
          feed_id: "feed-timezone-boundary",
          latest_article_at: "2026-01-05T23:30:00-05:00",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 1,
          recent_article_count: 0,
        },
      ],
      now: new Date("2026-04-06T00:30:00+09:00"),
    });

    expect(candidates.find((candidate) => candidate.feedId === "feed-dst-boundary")).toMatchObject({
      staleDays: 28,
      sinceCreatedDays: null,
      reasonKeys: [],
    });
    expect(candidates.find((candidate) => candidate.feedId === "feed-timezone-boundary")).toMatchObject({
      staleDays: 89,
      sinceCreatedDays: null,
      reasonKeys: ["attention_30d"],
    });
  });

  it("keeps invalid latest article dates out of stale day review calculation", () => {
    const candidates = buildSubscriptionReviewCandidates({
      isLocalAccount: true,
      isAccountSyncEnabled: true,
      feeds: [{ ...feeds[0], id: "feed-invalid-date", unread_count: 1 }],
      folders,
      feedArticleSummaries: [
        {
          feed_id: "feed-invalid-date",
          latest_article_at: "not-a-date",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 1,
          recent_article_count: 0,
        },
      ],
      now: new Date("2026-04-05T00:00:00Z"),
    });

    expect(candidates[0]).toMatchObject({
      latestArticleAt: "not-a-date",
      staleDays: null,
      sinceCreatedDays: null,
      reasonKeys: [],
    });
  });

  it("does not mark feeds with no fetched articles as review candidates just because counts are zero", () => {
    const candidates = buildSubscriptionReviewCandidates({
      isLocalAccount: true,
      isAccountSyncEnabled: true,
      feeds: [
        {
          id: "feed-empty",
          account_id: "acc-1",
          folder_id: null,
          remote_id: null,
          title: "Empty Feed",
          url: "https://example.com/empty.xml",
          site_url: "https://example.com/empty",
          icon_url: null,
          unread_count: 0,
          reader_mode: "inherit",
          web_preview_mode: "inherit",
          created_at: null,
        },
      ],
      folders,
      feedArticleSummaries: [],
      now: new Date("2026-04-05T00:00:00Z"),
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
      isLocalAccount: true,
      isAccountSyncEnabled: true,
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
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: -3,
          recent_article_count: -3,
        },
      ],
      now: new Date("2026-04-05T00:00:00Z"),
    });

    expect(candidates[0]).toMatchObject({
      feedId: "feed-negative-signals",
      unreadCount: 0,
      starredCount: 0,
      reasonKeys: ["stale_90d", "quiet_no_unread"],
    });
    expect(buildSubscriptionReviewReasonFacts(candidates[0])).toEqual([{ key: "unread_count", value: 0 }]);
  });

  it("sorts equally stale candidates by reason count, unread count, then title without using stars", () => {
    const candidates = buildSubscriptionReviewCandidates({
      isLocalAccount: true,
      isAccountSyncEnabled: true,
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
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 2,
          recent_article_count: 0,
        },
        {
          feed_id: "feed-more-reasons",
          latest_article_at: "2026-01-01T00:00:00Z",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 2,
          recent_article_count: 0,
        },
        {
          feed_id: "feed-fewer-unread",
          latest_article_at: "2026-01-01T00:00:00Z",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 0,
          recent_article_count: 0,
        },
        {
          feed_id: "feed-fewer-stars",
          latest_article_at: "2026-01-01T00:00:00Z",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 10,
          recent_article_count: 0,
        },
        {
          feed_id: "feed-title-tie",
          latest_article_at: "2026-01-01T00:00:00Z",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 1,
          recent_article_count: 0,
        },
      ],
      now: new Date("2026-04-05T00:00:00Z"),
    });

    expect(candidates.map((candidate) => candidate.feedId)).toEqual([
      "feed-more-reasons",
      "feed-title-tie",
      "feed-fewer-stars",
      "feed-fewer-unread",
      "feed-low-reasons",
    ]);
  });

  it("orders candidates by stale days before reason count or title", () => {
    const candidates = buildSubscriptionReviewCandidates({
      isLocalAccount: true,
      isAccountSyncEnabled: true,
      feeds: [
        { ...feeds[0], id: "feed-staler", title: "Zulu", unread_count: 5 },
        { ...feeds[0], id: "feed-more-reasons", title: "Alpha", unread_count: 0 },
      ],
      folders,
      feedArticleSummaries: [
        {
          feed_id: "feed-staler",
          latest_article_at: "2025-12-26T00:00:00Z",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 0,
          recent_article_count: 0,
        },
        {
          feed_id: "feed-more-reasons",
          latest_article_at: "2026-01-01T00:00:00Z",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 0,
          recent_article_count: 0,
        },
      ],
      now: new Date("2026-04-05T00:00:00Z"),
    });

    expect(candidates.map((candidate) => candidate.feedId)).toEqual(["feed-staler", "feed-more-reasons"]);
    expect(candidates[0]).toMatchObject({ staleDays: 100, reasonKeys: ["stale_90d"] });
    expect(candidates[1]).toMatchObject({ staleDays: 94, reasonKeys: ["stale_90d", "quiet_no_unread"] });
  });

  it("orders equally stale candidates by unread count before title", () => {
    const candidates = buildSubscriptionReviewCandidates({
      isLocalAccount: true,
      isAccountSyncEnabled: true,
      feeds: [
        { ...feeds[0], id: "feed-alpha-unread", title: "Alpha", unread_count: 5 },
        { ...feeds[0], id: "feed-zulu-unread", title: "Zulu", unread_count: 1 },
      ],
      folders,
      feedArticleSummaries: [
        {
          feed_id: "feed-alpha-unread",
          latest_article_at: "2026-01-01T00:00:00Z",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 0,
          recent_article_count: 0,
        },
        {
          feed_id: "feed-zulu-unread",
          latest_article_at: "2026-01-01T00:00:00Z",
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 0,
          recent_article_count: 0,
        },
      ],
      now: new Date("2026-04-05T00:00:00Z"),
    });

    expect(candidates.map((candidate) => candidate.feedId)).toEqual(["feed-zulu-unread", "feed-alpha-unread"]);
    expect(candidates[0]?.reasonKeys).toEqual(["stale_90d"]);
    expect(candidates[1]?.reasonKeys).toEqual(["stale_90d"]);
  });

  it("orders never-fetched feeds after feeds with a known latest article", () => {
    const orderedFeeds: FeedDto[] = [
      { ...feeds[0], id: "feed-recent-order", title: "Middle", unread_count: 0 },
      { ...feeds[0], id: "feed-fresh-order", title: "Zebra", unread_count: 0 },
      { ...feeds[0], id: "feed-never-fetched-order", title: "Aardvark", unread_count: 0 },
      { ...feeds[0], id: "feed-never-fetched-order-2", title: "Bumblebee", unread_count: 0 },
    ];
    const feedArticleSummariesForOrder: FeedArticleSummaryDto[] = [
      {
        feed_id: "feed-fresh-order",
        latest_article_at: "2026-04-05T00:00:00Z",
        last_seen_article_at: null,
        last_seen_article_probe_completed: false,
        starred_count: 0,
        recent_article_count: 0,
      },
      {
        feed_id: "feed-recent-order",
        latest_article_at: "2026-03-31T00:00:00Z",
        last_seen_article_at: null,
        last_seen_article_probe_completed: false,
        starred_count: 0,
        recent_article_count: 0,
      },
    ];
    const expectedOrder = [
      "feed-recent-order",
      "feed-fresh-order",
      "feed-never-fetched-order",
      "feed-never-fetched-order-2",
    ];

    // Both input orders are exercised so the comparator sees never-fetched feeds on each side of a comparison.
    for (const feedsInOrder of [orderedFeeds, [...orderedFeeds].reverse()]) {
      const candidates = buildSubscriptionReviewCandidates({
        isLocalAccount: true,
        isAccountSyncEnabled: true,
        feeds: feedsInOrder,
        folders,
        feedArticleSummaries: feedArticleSummariesForOrder,
        now: new Date("2026-04-05T00:00:00Z"),
      });

      expect(candidates.map((candidate) => candidate.feedId)).toEqual(expectedOrder);
      expect(candidates[2]).toMatchObject({ staleDays: null, reasonKeys: [] });
      expect(candidates[3]).toMatchObject({ staleDays: null, reasonKeys: [] });
    }
  });

  it("summarizes candidate urgency for the review panel", () => {
    const candidates = buildSubscriptionReviewCandidates({
      isLocalAccount: true,
      isAccountSyncEnabled: true,
      feeds,
      folders,
      feedArticleSummaries,
      now: new Date("2026-04-05T00:00:00Z"),
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

  it("summarizes each stale and quiet unread signal combination for review copy", () => {
    const candidate = {
      feedId: "feed-signals",
      title: "Signal Feed",
      folderId: null,
      folderName: null,
      latestArticleAt: "2026-01-01T00:00:00Z",
      staleDays: 94,
      sinceCreatedDays: null,
      unreadCount: 1,
      starredCount: 1,
    };

    expect(
      summarizeSubscriptionReviewCandidate({
        ...candidate,
        reasonKeys: ["quiet_no_unread"],
      }),
    ).toEqual({
      tone: "medium",
      titleKey: "consider",
      summaryKey: "quiet_without_unread",
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
        reasonKeys: [],
      }),
    ).toEqual({
      tone: "low",
      titleKey: "keep",
      summaryKey: "healthy_feed",
    });
  });

  it("summarizes attention-only candidates as low urgency attention copy", () => {
    const candidate = {
      feedId: "feed-attention",
      title: "Attention Feed",
      folderId: null,
      folderName: null,
      latestArticleAt: "2026-03-01T00:00:00Z",
      staleDays: 35,
      sinceCreatedDays: null,
      unreadCount: 2,
      starredCount: 0,
    };

    expect(summarizeSubscriptionReviewCandidate({ ...candidate, reasonKeys: ["attention_30d"] })).toEqual({
      tone: "low",
      titleKey: "attention",
      summaryKey: "attention_low_activity",
    });
    expect(resolveSubscriptionCleanupRecommendation({ ...candidate, reasonKeys: ["attention_30d"] })).toBe("retain");
  });

  it("separates cleanup recommendation from review reason signals", () => {
    const candidate = {
      feedId: "feed-signals",
      title: "Signal Feed",
      folderId: null,
      folderName: null,
      latestArticleAt: "2026-01-01T00:00:00Z",
      staleDays: 94,
      sinceCreatedDays: null,
      unreadCount: 0,
      starredCount: 0,
    };

    expect(
      resolveSubscriptionCleanupRecommendation({
        ...candidate,
        reasonKeys: ["stale_90d", "quiet_no_unread"],
      }),
    ).toBe("cleanup_candidate");
    expect(
      resolveSubscriptionCleanupRecommendation({
        ...candidate,
        reasonKeys: ["stale_90d"],
      }),
    ).toBe("watch");
    expect(
      resolveSubscriptionCleanupRecommendation({
        ...candidate,
        reasonKeys: ["quiet_no_unread"],
      }),
    ).toBe("watch");
  });

  it("builds reason facts only for active review reasons", () => {
    const candidates = buildSubscriptionReviewCandidates({
      isLocalAccount: true,
      isAccountSyncEnabled: true,
      feeds,
      folders,
      feedArticleSummaries,
      now: new Date("2026-04-05T00:00:00Z"),
    });

    expect(buildSubscriptionReviewReasonFacts(candidates[0])).toEqual([{ key: "unread_count", value: 0 }]);
    expect(buildSubscriptionReviewReasonFacts(candidates[1])).toEqual([{ key: "unread_count", value: 0 }]);
    expect(buildSubscriptionReviewReasonFacts(candidates[2])).toEqual([]);
  });

  it("resolves review summary translation keys", () => {
    expect(resolveSubscriptionReviewSummaryTranslationKey("attention_low_activity")).toBe("detail_reason_attention");
    expect(resolveSubscriptionReviewSummaryTranslationKey("stale_and_inactive")).toBe(
      "detail_reason_stale_and_inactive",
    );
    expect(resolveSubscriptionReviewSummaryTranslationKey("quiet_without_unread")).toBe(
      "detail_reason_quiet_without_unread",
    );
    expect(resolveSubscriptionReviewSummaryTranslationKey("stale_but_supported")).toBe(
      "detail_reason_stale_but_supported",
    );
    expect(resolveSubscriptionReviewSummaryTranslationKey("healthy_feed")).toBe("detail_reason_normal");
  });

  it("resolves review reason fact translation keys", () => {
    expect(resolveSubscriptionReviewReasonFactTranslationKey("unread_count")).toBe("fact_unread_count");
  });
  it("marks a feed as stale from last_seen_article_at when its stored articles were purged", () => {
    const candidates = buildSubscriptionReviewCandidates({
      isLocalAccount: true,
      isAccountSyncEnabled: true,
      feeds: [
        {
          id: "feed-purged",
          account_id: "acc-1",
          folder_id: null,
          remote_id: null,
          title: "Purged Feed",
          url: "https://example.com/purged.xml",
          site_url: "https://example.com/purged",
          icon_url: null,
          unread_count: 0,
          reader_mode: "inherit",
          web_preview_mode: "inherit",
          created_at: null,
        },
      ],
      folders,
      feedArticleSummaries: [
        {
          feed_id: "feed-purged",
          latest_article_at: null,
          last_seen_article_at: "2023-01-01T00:00:00Z",
          last_seen_article_probe_completed: false,
          starred_count: 0,
          recent_article_count: 0,
        },
      ],
      now: new Date("2026-11-18T00:00:00Z"),
    });

    expect(candidates[0]).toMatchObject({
      feedId: "feed-purged",
      latestArticleAt: "2023-01-01T00:00:00Z",
      reasonKeys: ["stale_90d", "quiet_no_unread"],
    });
    expect(summarizeSubscriptionReviewCandidate(candidates[0])).toMatchObject({
      tone: "high",
      titleKey: "review_now",
      summaryKey: "stale_and_inactive",
    });
  });

  it("does not mark a feed as a review candidate when no article was ever observed", () => {
    const candidates = buildSubscriptionReviewCandidates({
      isLocalAccount: true,
      isAccountSyncEnabled: true,
      feeds: [
        {
          id: "feed-never-fetched",
          account_id: "acc-1",
          folder_id: null,
          remote_id: null,
          title: "Never Fetched Feed",
          url: "https://example.com/never.xml",
          site_url: "https://example.com/never",
          icon_url: null,
          unread_count: 0,
          reader_mode: "inherit",
          web_preview_mode: "inherit",
          created_at: null,
        },
      ],
      folders,
      feedArticleSummaries: [
        {
          feed_id: "feed-never-fetched",
          latest_article_at: null,
          last_seen_article_at: null,
          last_seen_article_probe_completed: false,
          starred_count: 0,
          recent_article_count: 0,
        },
      ],
      now: new Date("2026-11-18T00:00:00Z"),
    });

    expect(candidates[0]).toMatchObject({
      feedId: "feed-never-fetched",
      latestArticleAt: null,
      reasonKeys: [],
    });
  });

  it("resolveLatestKnownArticleAt picks the newer of latest and last seen", () => {
    expect(
      resolveLatestKnownArticleAt({
        latest_article_at: "2026-04-01T00:00:00Z",
        last_seen_article_at: "2026-03-01T00:00:00Z",
      }),
    ).toBe("2026-04-01T00:00:00Z");
    expect(
      resolveLatestKnownArticleAt({
        latest_article_at: "2026-03-01T00:00:00Z",
        last_seen_article_at: "2026-04-01T00:00:00Z",
      }),
    ).toBe("2026-04-01T00:00:00Z");
    expect(resolveLatestKnownArticleAt({ latest_article_at: null, last_seen_article_at: null })).toBeNull();
    expect(resolveLatestKnownArticleAt(null)).toBeNull();
    expect(resolveLatestKnownArticleAt(undefined)).toBeNull();
  });

  it("resolveLatestKnownArticleAt keeps the stored latest article when both timestamps are the same instant", () => {
    expect(
      resolveLatestKnownArticleAt({
        latest_article_at: "2026-04-01T00:00:00Z",
        last_seen_article_at: "2026-04-01T09:00:00+09:00",
      }),
    ).toBe("2026-04-01T00:00:00Z");
  });
});

describe("no_articles review candidates", () => {
  const now = new Date("2026-04-05T12:00:00Z");
  const baseFeed = feeds[0];
  const emptySummary: FeedArticleSummaryDto = {
    feed_id: baseFeed.id,
    latest_article_at: null,
    last_seen_article_at: null,
    last_seen_article_probe_completed: false,
    starred_count: 0,
    recent_article_count: 0,
  };

  function createdDaysAgo(days: number): string {
    return new Date(now.getTime() - days * 86_400_000).toISOString();
  }

  function buildOne({
    feed = {},
    summary = {},
    summaries,
    isLocalAccount = true,
    isAccountSyncEnabled = true,
  }: {
    feed?: Partial<FeedDto>;
    summary?: Partial<FeedArticleSummaryDto>;
    summaries?: FeedArticleSummaryDto[];
    isLocalAccount?: boolean;
    isAccountSyncEnabled?: boolean;
  }) {
    const [candidate] = buildSubscriptionReviewCandidates({
      feeds: [{ ...baseFeed, created_at: createdDaysAgo(120), ...feed }],
      folders: [],
      feedArticleSummaries: summaries ?? [{ ...emptySummary, ...summary }],
      now,
      isLocalAccount,
      isAccountSyncEnabled,
    });
    return candidate;
  }

  it("flags a feed created 90 or more days ago that never produced an article", () => {
    const candidate = buildOne({ feed: { created_at: createdDaysAgo(90) } });

    expect(candidate.reasonKeys).toEqual(["no_articles"]);
    expect(candidate.sinceCreatedDays).toBe(90);
    expect(candidate.staleDays).toBeNull();
  });

  it("does not flag a feed created fewer than 90 days ago", () => {
    const candidate = buildOne({ feed: { created_at: createdDaysAgo(89) } });

    expect(candidate.reasonKeys).toEqual([]);
    expect(candidate.sinceCreatedDays).toBeNull();
  });

  it.each([
    ["created_at is unknown", { created_at: null }],
    ["created_at is not a date", { created_at: "not-a-date" }],
  ])("does not flag a feed whose %s", (_label, feed) => {
    expect(buildOne({ feed }).reasonKeys).toEqual([]);
  });

  it("does not use no_articles when either article timestamp is known", () => {
    const withLatest = buildOne({ summary: { latest_article_at: "2026-04-01T00:00:00Z" } });
    const withLastSeen = buildOne({ summary: { last_seen_article_at: "2026-04-01T00:00:00Z" } });

    expect(withLatest.reasonKeys).not.toContain("no_articles");
    expect(withLastSeen.reasonKeys).not.toContain("no_articles");
    expect(withLastSeen.sinceCreatedDays).toBeNull();
  });

  it("waits for the latest-article probe on provider accounts", () => {
    const beforeProbe = buildOne({ isLocalAccount: false, summary: { last_seen_article_probe_completed: false } });
    const afterProbe = buildOne({ isLocalAccount: false, summary: { last_seen_article_probe_completed: true } });

    expect(beforeProbe.reasonKeys).toEqual([]);
    expect(afterProbe.reasonKeys).toEqual(["no_articles"]);
  });

  it("does not need a probe on local accounts, which never run one", () => {
    const candidate = buildOne({ isLocalAccount: true, summary: { last_seen_article_probe_completed: false } });

    expect(candidate.reasonKeys).toEqual(["no_articles"]);
  });

  it("does not flag a feed whose summary row is missing, because the summary query returns a row for every feed", () => {
    const candidate = buildOne({ summaries: [] });

    expect(candidate.reasonKeys).toEqual([]);
  });

  it("does not flag feeds of an account with sync turned off", () => {
    const candidate = buildOne({
      isLocalAccount: false,
      isAccountSyncEnabled: false,
      summary: { last_seen_article_probe_completed: true },
    });

    expect(candidate.reasonKeys).toEqual([]);
  });

  it("treats no_articles as a medium-tone review candidate that is only worth watching", () => {
    const candidate = buildOne({});

    expect(summarizeSubscriptionReviewCandidate(candidate)).toEqual({
      tone: "medium",
      titleKey: "consider",
      summaryKey: "no_articles_since_subscribed",
    });
    expect(resolveSubscriptionCleanupRecommendation(candidate)).toBe("watch");
    expect(resolveSubscriptionReviewSummaryTranslationKey("no_articles_since_subscribed")).toBe(
      "detail_reason_no_articles",
    );
  });

  it("ranks a no-articles feed by subscription age alongside stale feeds instead of last", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds: [
        { ...baseFeed, id: "stale-120", title: "Stale 120", created_at: null },
        { ...baseFeed, id: "empty-200", title: "Empty 200", created_at: createdDaysAgo(200) },
        { ...baseFeed, id: "stale-95", title: "Stale 95", created_at: null },
        { ...baseFeed, id: "empty-100", title: "Empty 100", created_at: createdDaysAgo(100) },
      ],
      folders: [],
      feedArticleSummaries: [
        { ...emptySummary, feed_id: "stale-120", latest_article_at: createdDaysAgo(120) },
        { ...emptySummary, feed_id: "empty-200" },
        { ...emptySummary, feed_id: "stale-95", latest_article_at: createdDaysAgo(95) },
        { ...emptySummary, feed_id: "empty-100" },
      ],
      now,
      isLocalAccount: true,
      isAccountSyncEnabled: true,
    });

    expect(candidates.map((candidate) => candidate.feedId)).toEqual([
      "empty-200",
      "stale-120",
      "empty-100",
      "stale-95",
    ]);
  });
});
