import { describe, expect, it, vi } from "vitest";
import type { ArticleDto, FeedArticleSummaryDto, FeedDto, FolderDto } from "@/api/tauri-commands";
import { buildSubscriptionReviewCandidates } from "@/lib/subscriptions/subscription-review-candidates";
import {
  buildFeedArticleSummaryMap,
  buildSubscriptionDecisionActions,
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
  resolveSelectedSubscriptionDisplayModeLabel,
  resolveSubscriptionRowStatus,
  resolveSubscriptionsInventoryHeading,
} from "@/lib/subscriptions/subscriptions-index";

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

const feedArticleSummaries: FeedArticleSummaryDto[] = [
  { feed_id: "feed-stale", latest_article_at: "2025-11-01T10:00:00Z", starred_count: 1 },
  { feed_id: "feed-active", latest_article_at: "2026-04-01T09:00:00Z", starred_count: 1 },
  { feed_id: "feed-mid", latest_article_at: "2026-01-01T12:00:00Z", starred_count: 0 },
  { feed_id: "feed-dormant", latest_article_at: "2026-03-15T12:00:00Z", starred_count: 0 },
];

const feedArticleSummaryMap = buildFeedArticleSummaryMap(feedArticleSummaries);

describe("subscriptions index helpers", () => {
  it("builds summary counts from all feeds and review candidates", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds,
      folders,
      feedArticleSummaries,
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
      feedArticleSummaries,
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
    const thirdPreviewArticle: ArticleDto = {
      ...articles[1],
      id: "art-old-3",
      title: "Oldest hidden preview post",
      published_at: "2025-09-01T10:00:00Z",
    };

    expect(
      buildSubscriptionDetailMetrics({
        feed: feeds[0],
        articles: [...articles, thirdPreviewArticle],
        feedArticleSummary: feedArticleSummaryMap.get("feed-stale") ?? null,
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
      feedArticleSummaries,
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });
    const rows = buildSubscriptionListRows({
      feeds,
      candidateMap: buildSubscriptionReviewCandidateMap(candidates),
      feedArticleSummaryMap,
      folderNameById: new Map([["folder-work", "Work"]]),
    });

    expect(rows[0]).toMatchObject({
      feed: feeds[0],
      folderId: "folder-work",
      folderName: "Work",
      latestArticleAt: "2025-11-01T10:00:00Z",
      status: { tone: "medium", labelKey: "stale_90d" },
      reasonTooltipKey: "stale_90d",
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
        feedArticleSummaryMap,
      }),
    ).toMatchObject({
      latestArticleAt: "2025-11-01T10:00:00Z",
      starredCount: 1,
    });
    expect(resolveSelectedSubscriptionDetailMetrics({ selectedRow: null, articles, feedArticleSummaryMap })).toBeNull();
  });

  it("builds decision actions only for flagged subscription rows", () => {
    const rows = buildSubscriptionListRows({
      feeds,
      candidateMap: new Map([
        [
          "feed-stale",
          {
            feedId: "feed-stale",
            title: "Old Product Blog",
            folderId: "folder-work",
            folderName: "Work",
            latestArticleAt: "2025-11-01T10:00:00Z",
            unreadCount: 0,
            starredCount: 1,
            staleDays: 155,
            reasonKeys: ["stale_90d"],
          },
        ],
      ]),
      feedArticleSummaryMap,
      folderNameById: new Map([["folder-work", "Work"]]),
    });
    const onKeep = vi.fn();
    const onDefer = vi.fn();
    const onDelete = vi.fn();

    const actions = buildSubscriptionDecisionActions({
      selectedRow: rows[0],
      isFlagged: true,
      labels: { keep: "Keep", defer: "Later", delete: "Delete" },
      onKeep,
      onDefer,
      onDelete,
    });

    expect(actions).toMatchObject({ keepLabel: "Keep", deferLabel: "Later", deleteLabel: "Delete" });
    actions?.onKeep();
    actions?.onDefer();
    actions?.onDelete();
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onDefer).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(
      buildSubscriptionDecisionActions({
        selectedRow: rows[0],
        isFlagged: false,
        labels: { keep: "Keep", defer: "Later", delete: "Delete" },
        onKeep,
        onDefer,
        onDelete,
      }),
    ).toBeNull();
  });

  it("filters visible rows by review status, local decisions, search query, and sort key", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds,
      folders,
      feedArticleSummaries,
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });
    const rows = buildSubscriptionListRows({
      feeds,
      candidateMap: buildSubscriptionReviewCandidateMap(candidates),
      feedArticleSummaryMap,
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

    expect(
      buildVisibleSubscriptionRows({
        rows,
        activeSummaryFilter: "review",
        keptFeedIds: new Set(),
        deferredFeedIds: new Set(["feed-mid"]),
        searchQuery: "",
        sortKey: "updated_at",
      }).map((row) => row.feed.id),
    ).toEqual(["feed-dormant", "feed-stale"]);
  });

  it("filters visible rows by folder or feed search and sorts by unread count", () => {
    const rows = buildSubscriptionListRows({
      feeds,
      candidateMap: new Map(),
      feedArticleSummaryMap,
      folderNameById: new Map([["folder-work", "Work"]]),
    });

    expect(
      buildVisibleSubscriptionRows({
        rows,
        activeSummaryFilter: "all",
        keptFeedIds: new Set(),
        deferredFeedIds: new Set(),
        searchQuery: "work",
        sortKey: "title",
      }).map((row) => row.feed.id),
    ).toEqual(["feed-stale"]);
    expect(
      buildVisibleSubscriptionRows({
        rows,
        activeSummaryFilter: "all",
        keptFeedIds: new Set(),
        deferredFeedIds: new Set(),
        searchQuery: "feed",
        sortKey: "unread_count",
      }).map((row) => row.feed.id),
    ).toEqual(["feed-active", "feed-mid", "feed-dormant"]);
  });

  it("sorts rows with invalid update dates after valid update dates", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds,
      folders,
      feedArticleSummaries,
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });
    const rows = buildSubscriptionListRows({
      feeds,
      candidateMap: buildSubscriptionReviewCandidateMap(candidates),
      feedArticleSummaryMap,
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
      feedArticleSummaryMap,
      folderNameById: new Map([["folder-work", "Work"]]),
    });

    expect(buildSubscriptionListGroups(rows, "No Folder")).toMatchObject([
      { key: "__ungrouped__", label: "No Folder", rows: [rows[1], rows[2], rows[3]], folderId: null },
      { key: "folder-work", label: "Work", rows: [rows[0]], folderId: "folder-work" },
    ]);
  });

  it("sorts groups by label without reordering rows inside each group", () => {
    const rows = buildSubscriptionListRows({
      feeds,
      candidateMap: new Map(),
      feedArticleSummaryMap,
      folderNameById: new Map([["folder-work", "AA Work"]]),
    });
    const visibleRows = buildVisibleSubscriptionRows({
      rows,
      activeSummaryFilter: "all",
      keptFeedIds: new Set(),
      deferredFeedIds: new Set(),
      searchQuery: "",
      sortKey: "updated_at",
    });

    const groups = buildSubscriptionListGroups(visibleRows, "ZZ No Folder");

    expect(groups.map((group) => group.label)).toEqual(["AA Work", "ZZ No Folder"]);
    expect(groups[1]?.rows.map((row) => row.feed.id)).toEqual(["feed-active", "feed-dormant", "feed-mid"]);
  });

  it("formats subscription dates with an invalid fallback", () => {
    expect(formatSubscriptionDate("not-a-date", "en-US")).toBe("—");
    expect(formatSubscriptionDate("2026-04-01T09:00:00Z", "en-US")).toContain("2026");
  });

  it("resolves the selected display mode label for default, standard, and preview feed modes", () => {
    const labels = {
      default: "Use default",
      standard: "Standard",
      preview: "Preview",
    };
    const baseRow = buildSubscriptionListRows({
      feeds,
      candidateMap: new Map(),
      feedArticleSummaryMap,
      folderNameById: new Map([["folder-work", "Work"]]),
    })[0];

    expect(resolveSelectedSubscriptionDisplayModeLabel({ selectedRow: null, labels })).toBe("Use default");
    expect(resolveSelectedSubscriptionDisplayModeLabel({ selectedRow: baseRow, labels })).toBe("Use default");
    expect(
      resolveSelectedSubscriptionDisplayModeLabel({
        selectedRow: { ...baseRow, feed: { ...baseRow.feed, reader_mode: "on", web_preview_mode: "off" } },
        labels,
      }),
    ).toBe("Standard");
    expect(
      resolveSelectedSubscriptionDisplayModeLabel({
        selectedRow: { ...baseRow, feed: { ...baseRow.feed, reader_mode: "on", web_preview_mode: "on" } },
        labels,
      }),
    ).toBe("Preview");
  });

  it("builds detail candidate copy from review facts", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds,
      folders,
      feedArticleSummaries,
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
        reasonTooltipKey: "stale_90d",
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
