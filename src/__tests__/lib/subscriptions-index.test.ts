import { describe, expect, it } from "vitest";
import type { ArticleDto, FeedDto, FolderDto } from "@/api/tauri-commands";
import { buildSubscriptionReviewCandidates } from "@/lib/subscription-review-candidates";
import {
  buildSubscriptionDetailCandidate,
  buildSubscriptionDetailMetrics,
  buildSubscriptionListGroups,
  buildSubscriptionListRows,
  buildSubscriptionReviewCandidateMap,
  buildSubscriptionSummaryCards,
  buildSubscriptionsIndexSummary,
  buildVisibleSubscriptionRows,
  countReviewCandidates,
  countStaleCandidates,
  countStarredArticles,
  findLatestArticleTimestamp,
  formatSubscriptionDate,
  resolveSelectedSubscriptionCandidate,
  resolveSelectedSubscriptionDetailMetrics,
  resolveSubscriptionRowStatus,
  resolveSubscriptionsInventoryHeading,
} from "@/lib/subscriptions-index";

const feeds: FeedDto[] = [
  {
    id: "feed-stale",
    account_id: "acc-1",
    folder_id: "folder-work",
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
    title: "Quiet Feed",
    url: "https://example.com/quiet.xml",
    site_url: "https://example.com/quiet",
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-dormant",
    account_id: "acc-1",
    folder_id: null,
    title: "Dormant Feed",
    url: "https://example.com/dormant.xml",
    site_url: "https://example.com/dormant",
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

const articles: ArticleDto[] = [
  {
    id: "art-old-1",
    feed_id: "feed-stale",
    title: "Very old post",
    content_sanitized: "<p>old</p>",
    summary: null,
    url: "https://example.com/old/1",
    author: null,
    published_at: "2025-11-01T10:00:00Z",
    thumbnail: null,
    is_read: true,
    is_starred: false,
  },
  {
    id: "art-old-2",
    feed_id: "feed-stale",
    title: "Older starred post",
    content_sanitized: "<p>older</p>",
    summary: null,
    url: "https://example.com/old/2",
    author: null,
    published_at: "2025-10-15T10:00:00Z",
    thumbnail: null,
    is_read: true,
    is_starred: true,
  },
  {
    id: "art-new-1",
    feed_id: "feed-active",
    title: "Fresh post",
    content_sanitized: "<p>fresh</p>",
    summary: null,
    url: "https://example.com/active/1",
    author: null,
    published_at: "2026-04-01T09:00:00Z",
    thumbnail: null,
    is_read: false,
    is_starred: true,
  },
  {
    id: "art-mid-1",
    feed_id: "feed-mid",
    title: "Quiet post",
    content_sanitized: "<p>quiet</p>",
    summary: null,
    url: "https://example.com/quiet/1",
    author: null,
    published_at: "2026-01-01T12:00:00Z",
    thumbnail: null,
    is_read: true,
    is_starred: false,
  },
  {
    id: "art-dormant-1",
    feed_id: "feed-dormant",
    title: "Dormant latest post",
    content_sanitized: "<p>dormant</p>",
    summary: null,
    url: "https://example.com/dormant/1",
    author: null,
    published_at: "2026-03-15T12:00:00Z",
    thumbnail: null,
    is_read: true,
    is_starred: false,
  },
];

describe("subscriptions index helpers", () => {
  it("builds summary counts from all feeds and review candidates", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds,
      folders,
      articles,
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });

    expect(buildSubscriptionsIndexSummary({ feeds, candidates })).toEqual({
      totalCount: 4,
      reviewCount: 3,
      staleCount: 2,
    });
    expect(countReviewCandidates(candidates)).toBe(3);
    expect(countStaleCandidates(candidates)).toBe(2);
  });

  it("derives row status from review candidates only", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds,
      folders,
      articles,
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });
    const candidateMap = buildSubscriptionReviewCandidateMap(candidates);

    expect(
      resolveSubscriptionRowStatus({
        candidate: candidateMap.get("feed-stale"),
      }),
    ).toEqual({ tone: "medium", labelKey: "stale_90d" });

    expect(
      resolveSubscriptionRowStatus({
        candidate: candidateMap.get("feed-active"),
      }),
    ).toEqual({ tone: "neutral", labelKey: "normal" });

    expect(
      resolveSubscriptionRowStatus({
        candidate: candidateMap.get("feed-dormant"),
      }),
    ).toEqual({ tone: "medium", labelKey: "no_unread" });
  });

  it("builds latest-article metrics and preview rows for the right detail pane", () => {
    expect(
      buildSubscriptionDetailMetrics({
        feed: feeds[0],
        articles,
      }),
    ).toEqual({
      latestArticleAt: "2025-11-01T10:00:00Z",
      starredCount: 1,
      previewArticles: [articles[0], articles[1]],
    });
    expect(countStarredArticles(articles)).toBe(2);
    expect(findLatestArticleTimestamp([articles[1], articles[0]])).toBe("2025-11-01T10:00:00Z");
    expect(
      findLatestArticleTimestamp([
        { ...articles[0], published_at: "not-a-date" },
        { ...articles[1], published_at: "2025-10-15T10:00:00Z" },
      ]),
    ).toBe("2025-10-15T10:00:00Z");
  });

  it("builds summary cards and derives the filtered inventory heading", () => {
    const summaryCards = buildSubscriptionSummaryCards({
      summary: { totalCount: 4, reviewCount: 3, staleCount: 2 },
      activeSummaryFilter: "review",
      labels: {
        total: "All",
        totalCaption: (count) => `${count} feeds`,
        review: "Review",
        reviewCaption: (count) => `${count} candidates`,
        stale: "Stale",
        staleCaption: (count) => `${count} stale`,
      },
    });

    expect(summaryCards).toMatchObject([
      { filterKey: "all", value: "4", isActive: false },
      { filterKey: "review", value: "3", isActive: true },
      { filterKey: "stale", value: "2", isActive: false },
    ]);
    expect(
      resolveSubscriptionsInventoryHeading({
        activeSummaryFilter: "review",
        summaryCards,
        defaultHeading: "Inventory",
      }),
    ).toBe("Review");
  });

  it("builds list rows with folder names and candidate status", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds,
      folders,
      articles,
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });
    const rows = buildSubscriptionListRows({
      feeds,
      candidateMap: buildSubscriptionReviewCandidateMap(candidates),
      folderNameById: new Map([["folder-work", "Work"]]),
    });

    expect(rows[0]).toMatchObject({
      feed: feeds[0],
      folderId: "folder-work",
      folderName: "Work",
      latestArticleAt: "2025-11-01T10:00:00Z",
      status: { tone: "medium", labelKey: "stale_90d" },
    });
    expect(
      resolveSelectedSubscriptionCandidate({
        selectedRow: rows[0],
        candidateMap: buildSubscriptionReviewCandidateMap(candidates),
      })?.feedId,
    ).toBe("feed-stale");
    expect(resolveSelectedSubscriptionCandidate({ selectedRow: null, candidateMap: new Map() })).toBeNull();
    expect(
      resolveSelectedSubscriptionDetailMetrics({
        selectedRow: rows[0],
        articles,
      }),
    ).toMatchObject({
      latestArticleAt: "2025-11-01T10:00:00Z",
      starredCount: 1,
    });
    expect(resolveSelectedSubscriptionDetailMetrics({ selectedRow: null, articles })).toBeNull();
  });

  it("filters visible rows by review status, local decisions, search query, and sort key", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds,
      folders,
      articles,
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });
    const rows = buildSubscriptionListRows({
      feeds,
      candidateMap: buildSubscriptionReviewCandidateMap(candidates),
      folderNameById: new Map([["folder-work", "Work"]]),
    });

    const visibleRows = buildVisibleSubscriptionRows({
      rows,
      activeSummaryFilter: "review",
      keptFeedIds: new Set(["feed-dormant"]),
      deferredFeedIds: new Set(),
      searchQuery: "",
      sortKey: "updated_at",
    });

    expect(visibleRows.map((row) => row.feed.id)).toEqual(["feed-mid", "feed-stale"]);
  });

  it("sorts rows with invalid update dates after valid update dates", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds,
      folders,
      articles,
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });
    const rows = buildSubscriptionListRows({
      feeds,
      candidateMap: buildSubscriptionReviewCandidateMap(candidates),
      folderNameById: new Map([["folder-work", "Work"]]),
    }).map((row, index) => ({
      ...row,
      latestArticleAt: index === 0 ? "not-a-date" : row.latestArticleAt,
    }));

    const visibleRows = buildVisibleSubscriptionRows({
      rows,
      activeSummaryFilter: "all",
      keptFeedIds: new Set(),
      deferredFeedIds: new Set(),
      searchQuery: "",
      sortKey: "updated_at",
    });

    expect(visibleRows[visibleRows.length - 1]?.feed.id).toBe("feed-stale");
  });

  it("groups subscription rows by folder label", () => {
    const rows = buildSubscriptionListRows({
      feeds,
      candidateMap: new Map(),
      folderNameById: new Map([["folder-work", "Work"]]),
    });

    expect(buildSubscriptionListGroups(rows, "No Folder")).toMatchObject([
      { key: "__ungrouped__", label: "No Folder", rows: [rows[1], rows[2], rows[3]], folderId: null },
      { key: "folder-work", label: "Work", rows: [rows[0]], folderId: "folder-work" },
    ]);
  });

  it("formats subscription dates with an invalid fallback", () => {
    expect(formatSubscriptionDate("not-a-date", "en-US")).toBe("—");
    expect(formatSubscriptionDate("2026-04-01T09:00:00Z", "en-US")).toContain("2026");
  });

  it("builds detail candidate copy from review facts", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds,
      folders,
      articles,
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });
    const selectedCandidate = candidates.find((candidate) => candidate.feedId === "feed-stale") ?? null;

    const detail = buildSubscriptionDetailCandidate({
      selectedRow: {
        feed: feeds[0],
        folderId: "folder-work",
        folderName: "Work",
        latestArticleAt: selectedCandidate?.latestArticleAt ?? null,
        status: { tone: "medium", labelKey: "stale_90d" },
      },
      selectedCandidate,
      labels: {
        statusLabel: (labelKey) => labelKey,
        normalReason: "Normal",
        summaryText: (summaryKey) => summaryKey,
        reasonFact: (fact) => `${fact.key}:${fact.value}`,
        reasonLabel: (reasonKey) => reasonKey,
      },
    });

    expect(detail).toMatchObject({
      candidate: selectedCandidate,
      tone: "high",
      statusLabel: "stale_90d",
      summary: "stale_and_inactive",
      reasonBoxBody: "stale_days:154 / unread_count:0",
      reasonLabels: ["stale_90d", "no_unread"],
    });
  });
});
