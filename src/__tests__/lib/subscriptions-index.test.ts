import { describe, expect, it, vi } from "vitest";
import type { ArticleDto, FeedArticleSummaryDto, FeedDto, FolderDto } from "@/api/tauri-commands";
import type { SubscriptionReviewCandidate } from "@/lib/subscriptions/subscription-review-candidates";
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
  countStarredArticles,
  formatSubscriptionDate,
  resolveSelectedSubscriptionCandidate,
  resolveSelectedSubscriptionDetailMetrics,
  resolveSelectedSubscriptionDisplayModeLabel,
  resolveSubscriptionRowReasonTooltipKey,
  resolveSubscriptionRowStatus,
  resolveSubscriptionsInventoryHeading,
} from "@/lib/subscriptions/subscriptions-index";

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
  {
    id: "feed-dormant",
    account_id: "acc-1",
    folder_id: null,
    remote_id: null,
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
  {
    feed_id: "feed-dormant",
    latest_article_at: "2026-03-15T12:00:00Z",
    starred_count: 0,
  },
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
  });

  it("uses the last duplicate review candidate feed id while summary counts preserve caller input", () => {
    const firstCandidate: SubscriptionReviewCandidate = {
      feedId: "feed-stale",
      title: "First duplicate",
      folderId: "folder-work",
      folderName: "Work",
      latestArticleAt: "2025-11-01T10:00:00Z",
      staleDays: 155,
      unreadCount: 0,
      starredCount: 1,
      reasonKeys: ["stale_90d"],
    };
    const secondCandidate: SubscriptionReviewCandidate = {
      ...firstCandidate,
      title: "Second duplicate",
      staleDays: 94,
      reasonKeys: ["stale_90d", "no_unread"],
    };
    const candidateMap = buildSubscriptionReviewCandidateMap([firstCandidate, secondCandidate]);

    expect(candidateMap.size).toBe(1);
    expect(candidateMap).toEqual(new Map([["feed-stale", secondCandidate]]));
    expect(
      resolveSelectedSubscriptionCandidate({
        selectedRow: {
          feed: feeds[0],
          folderId: "folder-work",
          folderName: "Work",
          latestArticleAt: firstCandidate.latestArticleAt,
          status: { tone: "medium", labelKey: "stale_90d" },
          reasonTooltipKey: "stale_90d",
        },
        candidateMap,
      }),
    ).toBe(secondCandidate);
    expect(resolveSelectedSubscriptionCandidate({ selectedRow: null, candidateMap })).toBeNull();
    expect(
      buildSubscriptionsIndexSummary({
        feeds: [feeds[0]],
        candidates: [firstCandidate, secondCandidate],
      }),
    ).toEqual({
      totalCount: 1,
      reviewCount: 2,
      staleCount: 2,
    });
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

    expect(
      resolveSubscriptionRowStatus({
        candidate: {
          feedId: "feed-no-stars",
          title: "No Stars",
          folderId: null,
          folderName: null,
          latestArticleAt: "2026-04-01T00:00:00Z",
          staleDays: 4,
          unreadCount: 2,
          starredCount: 0,
          reasonKeys: ["no_stars"],
        },
      }),
    ).toEqual({ tone: "neutral", labelKey: "normal" });
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
  });

  it("orders detail preview articles by valid dates before invalid dates with stable equal-date ties", () => {
    const invalidArticle: ArticleDto = {
      ...articles[0],
      id: "art-invalid-date",
      title: "Invalid date post",
      published_at: "not-a-date",
    };
    const firstEqualDateArticle: ArticleDto = {
      ...articles[0],
      id: "art-equal-date-1",
      title: "First equal date post",
      published_at: "2026-04-02T10:00:00Z",
    };
    const secondEqualDateArticle: ArticleDto = {
      ...articles[0],
      id: "art-equal-date-2",
      title: "Second equal date post",
      published_at: "2026-04-02T10:00:00Z",
    };
    const newerValidArticle: ArticleDto = {
      ...articles[0],
      id: "art-newer-valid",
      title: "Newer valid post",
      published_at: "2026-04-03T10:00:00Z",
    };

    expect(
      buildSubscriptionDetailMetrics({
        feed: feeds[0],
        articles: [invalidArticle, newerValidArticle],
        feedArticleSummary: feedArticleSummaryMap.get("feed-stale") ?? null,
      }).previewArticles.map((article) => article.id),
    ).toEqual([newerValidArticle.id, invalidArticle.id]);

    expect(
      buildSubscriptionDetailMetrics({
        feed: feeds[0],
        articles: [firstEqualDateArticle, secondEqualDateArticle],
        feedArticleSummary: feedArticleSummaryMap.get("feed-stale") ?? null,
      }).previewArticles.map((article) => article.id),
    ).toEqual([firstEqualDateArticle.id, secondEqualDateArticle.id]);
  });

  it("keeps invalid detail preview date ties in input order behind valid articles", () => {
    const firstInvalidArticle: ArticleDto = {
      ...articles[0],
      id: "art-invalid-date-1",
      title: "First invalid date post",
      published_at: "not-a-date",
    };
    const secondInvalidArticle: ArticleDto = {
      ...articles[0],
      id: "art-invalid-date-2",
      title: "Second invalid date post",
      published_at: "",
    };
    const validArticle: ArticleDto = {
      ...articles[0],
      id: "art-valid-date",
      title: "Valid date post",
      published_at: "2026-04-03T10:00:00Z",
    };

    expect(
      buildSubscriptionDetailMetrics({
        feed: feeds[0],
        articles: [firstInvalidArticle, secondInvalidArticle, validArticle],
        feedArticleSummary: feedArticleSummaryMap.get("feed-stale") ?? null,
      }).previewArticles.map((article) => article.id),
    ).toEqual([validArticle.id, firstInvalidArticle.id]);
  });

  it("falls back to articles for missing detail summaries and preserves summary priority when present", () => {
    const newerUnstarredArticle: ArticleDto = {
      ...articles[0],
      id: "art-fallback-new",
      feed_id: "feed-stale",
      published_at: "2026-04-02T10:00:00Z",
      is_starred: false,
    };
    const olderStarredArticle: ArticleDto = {
      ...articles[1],
      id: "art-fallback-starred",
      feed_id: "feed-stale",
      published_at: "2026-03-01T10:00:00Z",
      is_starred: true,
    };
    const feedArticles = [olderStarredArticle, newerUnstarredArticle];
    const summary = {
      feed_id: "feed-stale",
      latest_article_at: "2025-01-01T00:00:00Z",
      starred_count: 7,
    };

    expect(
      buildSubscriptionDetailMetrics({
        feed: feeds[0],
        articles: feedArticles,
        feedArticleSummary: null,
      }),
    ).toEqual({
      latestArticleAt: "2026-04-02T10:00:00Z",
      starredCount: 1,
      previewArticles: [newerUnstarredArticle, olderStarredArticle],
    });

    expect(
      buildSubscriptionDetailMetrics({
        feed: feeds[0],
        articles: feedArticles,
        feedArticleSummary: summary,
      }),
    ).toEqual({
      latestArticleAt: "2025-01-01T00:00:00Z",
      starredCount: 7,
      previewArticles: [newerUnstarredArticle, olderStarredArticle],
    });
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

  it("falls back invalid summary card counts to zero before formatting labels", () => {
    const totalCaption = vi.fn((count: number) => `${count} feeds`);
    const reviewCaption = vi.fn((count: number) => `${count} candidates`);
    const staleCaption = vi.fn((count: number) => `${count} stale`);

    const summaryCards = buildSubscriptionSummaryCards({
      summary: {
        totalCount: -1,
        reviewCount: Number.NaN,
        staleCount: Number.POSITIVE_INFINITY,
      },
      activeSummaryFilter: "all",
      labels: {
        total: "All",
        totalCaption,
        review: "Review",
        reviewCaption,
        stale: "Stale",
        staleCaption,
      },
    });

    expect(summaryCards.map((card) => card.value)).toEqual(["0", "0", "0"]);
    expect(totalCaption).toHaveBeenCalledWith(0);
    expect(reviewCaption).toHaveBeenCalledWith(0);
    expect(staleCaption).toHaveBeenCalledWith(0);
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
    expect(
      resolveSelectedSubscriptionCandidate({
        selectedRow: null,
        candidateMap: new Map(),
      }),
    ).toBeNull();
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
    expect(
      resolveSelectedSubscriptionDetailMetrics({
        selectedRow: null,
        articles,
        feedArticleSummaryMap,
      }),
    ).toBeNull();
  });

  it("resolves row reason tooltip keys from flagged status or missing article history", () => {
    expect(
      resolveSubscriptionRowReasonTooltipKey({
        latestArticleAt: "2026-04-01T09:00:00Z",
        status: { tone: "medium", labelKey: "no_stars" },
      }),
    ).toBe("no_stars");
    expect(
      resolveSubscriptionRowReasonTooltipKey({
        latestArticleAt: null,
        status: { tone: "neutral", labelKey: "normal" },
      }),
    ).toBe("no_articles");
    expect(
      resolveSubscriptionRowReasonTooltipKey({
        latestArticleAt: "2026-04-01T09:00:00Z",
        status: { tone: "neutral", labelKey: "normal" },
      }),
    ).toBeNull();
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

    expect(actions).toMatchObject({
      keepLabel: "Keep",
      deferLabel: "Later",
      deleteLabel: "Delete",
    });
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

  it("does not build decision actions for null or unflagged selected rows", () => {
    const rows = buildSubscriptionListRows({
      feeds,
      candidateMap: new Map(),
      feedArticleSummaryMap,
      folderNameById: new Map([["folder-work", "Work"]]),
    });
    const onKeep = vi.fn();
    const onDefer = vi.fn();
    const onDelete = vi.fn();
    const labels = { keep: "Keep", defer: "Later", delete: "Delete" };

    expect(
      buildSubscriptionDecisionActions({
        selectedRow: null,
        isFlagged: true,
        labels,
        onKeep,
        onDefer,
        onDelete,
      }),
    ).toBeNull();
    expect(
      buildSubscriptionDecisionActions({
        selectedRow: rows[0],
        isFlagged: true,
        labels,
        onKeep,
        onDefer,
        onDelete,
      }),
    ).toBeNull();
  });

  it("captures the selected row when keep and defer callbacks are generated", () => {
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
    let selectedRow = rows[0];

    const actions = buildSubscriptionDecisionActions({
      selectedRow,
      isFlagged: true,
      labels: { keep: "Keep", defer: "Later", delete: "Delete" },
      onKeep,
      onDefer,
      onDelete: vi.fn(),
    });
    selectedRow = rows[1];

    actions?.onKeep();
    actions?.onDefer();

    expect(selectedRow.feed.id).toBe("feed-active");
    expect(onKeep).toHaveBeenCalledWith(rows[0]);
    expect(onDefer).toHaveBeenCalledWith(rows[0]);
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

  it("keeps visible row sorting from mutating the caller-owned rows", () => {
    const rows = buildSubscriptionListRows({
      feeds,
      candidateMap: new Map(),
      feedArticleSummaryMap,
      folderNameById: new Map([["folder-work", "Work"]]),
    });
    const rowOrderBeforeSort = rows.map((row) => row.feed.id);

    const visibleRows = buildVisibleSubscriptionRows({
      rows,
      activeSummaryFilter: "all",
      keptFeedIds: new Set(),
      deferredFeedIds: new Set(),
      searchQuery: "",
      sortKey: "updated_at",
    });

    expect(visibleRows.map((row) => row.feed.id)).toEqual(["feed-active", "feed-dormant", "feed-mid", "feed-stale"]);
    expect(rows.map((row) => row.feed.id)).toEqual(rowOrderBeforeSort);
  });

  it("keeps decided rows only for the all summary filter", () => {
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
    const keptFeedIds = new Set(["feed-stale"]);
    const deferredFeedIds = new Set(["feed-mid"]);

    expect(
      buildVisibleSubscriptionRows({
        rows,
        activeSummaryFilter: "all",
        keptFeedIds,
        deferredFeedIds,
        searchQuery: "",
        sortKey: "title",
      }).map((row) => row.feed.id),
    ).toEqual(["feed-active", "feed-dormant", "feed-stale", "feed-mid"]);

    expect(
      buildVisibleSubscriptionRows({
        rows,
        activeSummaryFilter: "review",
        keptFeedIds,
        deferredFeedIds,
        searchQuery: "",
        sortKey: "title",
      }).map((row) => row.feed.id),
    ).toEqual(["feed-dormant"]);

    expect(
      buildVisibleSubscriptionRows({
        rows,
        activeSummaryFilter: "stale",
        keptFeedIds,
        deferredFeedIds,
        searchQuery: "",
        sortKey: "title",
      }).map((row) => row.feed.id),
    ).toEqual([]);
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
    ).toEqual(["feed-active", "feed-dormant", "feed-mid"]);
    expect(
      buildVisibleSubscriptionRows({
        rows,
        activeSummaryFilter: "all",
        keptFeedIds: new Set(),
        deferredFeedIds: new Set(),
        searchQuery: "EXAMPLE.COM/ACTIVE",
        sortKey: "title",
      }).map((row) => row.feed.id),
    ).toEqual(["feed-active"]);
    expect(
      buildVisibleSubscriptionRows({
        rows,
        activeSummaryFilter: "all",
        keptFeedIds: new Set(),
        deferredFeedIds: new Set(),
        searchQuery: "quiet.xml",
        sortKey: "title",
      }).map((row) => row.feed.id),
    ).toEqual(["feed-mid"]);
  });

  it("normalizes subscription row search across Unicode width, accents, marks, case, and edge whitespace", () => {
    const searchableFeeds: FeedDto[] = [
      {
        ...feeds[0],
        id: "feed-search",
        title: "  Ｃａｆｅ ガイド  ",
        url: "  https://example.com/fullwidth.xml  ",
        site_url: "  https://example.com/CAFÉ  ",
      },
    ];
    const rows = buildSubscriptionListRows({
      feeds: searchableFeeds,
      candidateMap: new Map(),
      feedArticleSummaryMap: new Map(),
      folderNameById: new Map([["folder-work", "  Référence  "]]),
    });
    const matchingFeedIdsForQuery = (searchQuery: string) =>
      buildVisibleSubscriptionRows({
        rows,
        activeSummaryFilter: "all",
        keptFeedIds: new Set(),
        deferredFeedIds: new Set(),
        searchQuery,
        sortKey: "title",
      }).map((row) => row.feed.id);

    expect(matchingFeedIdsForQuery(" cafe ")).toEqual(["feed-search"]);
    expect(matchingFeedIdsForQuery("カイト")).toEqual(["feed-search"]);
    expect(matchingFeedIdsForQuery("reference")).toEqual(["feed-search"]);
    expect(matchingFeedIdsForQuery("example.com/cafe")).toEqual(["feed-search"]);
    expect(matchingFeedIdsForQuery("example.com/fullwidth.xml")).toEqual(["feed-search"]);
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

  it("sorts invalid update date rows by title and feed id after valid update dates", () => {
    const invalidDateFeeds: FeedDto[] = [
      { ...feeds[0], id: "feed-invalid-z", title: "Shared" },
      { ...feeds[1], id: "feed-valid", title: "Valid Feed" },
      { ...feeds[2], id: "feed-invalid-a", title: "Shared" },
      { ...feeds[3], id: "feed-invalid-b", title: "Alpha" },
    ];
    const rows = buildSubscriptionListRows({
      feeds: invalidDateFeeds,
      candidateMap: new Map(),
      feedArticleSummaryMap: buildFeedArticleSummaryMap([
        {
          feed_id: "feed-invalid-z",
          latest_article_at: "not-a-date",
          starred_count: 0,
        },
        {
          feed_id: "feed-valid",
          latest_article_at: "2026-04-01T09:00:00Z",
          starred_count: 0,
        },
        {
          feed_id: "feed-invalid-a",
          latest_article_at: "",
          starred_count: 0,
        },
        {
          feed_id: "feed-invalid-b",
          latest_article_at: "invalid-date",
          starred_count: 0,
        },
      ]),
      folderNameById: new Map(),
    });

    const visibleRows = buildVisibleSubscriptionRows({
      rows,
      activeSummaryFilter: "all",
      keptFeedIds: new Set(),
      deferredFeedIds: new Set(),
      searchQuery: "",
      sortKey: "updated_at",
    });

    expect(visibleRows.map((row) => row.feed.id)).toEqual([
      "feed-valid",
      "feed-invalid-b",
      "feed-invalid-a",
      "feed-invalid-z",
    ]);
  });

  it("uses title and feed id tie-breakers for rows with the same update date", () => {
    const tieFeeds: FeedDto[] = [
      { ...feeds[0], id: "feed-z", title: "Shared", unread_count: 0 },
      { ...feeds[1], id: "feed-b", title: "Alpha", unread_count: 0 },
      { ...feeds[2], id: "feed-a", title: "Shared", unread_count: 0 },
    ];
    const rows = buildSubscriptionListRows({
      feeds: tieFeeds,
      candidateMap: new Map(),
      feedArticleSummaryMap: buildFeedArticleSummaryMap(
        tieFeeds.map((feed) => ({
          feed_id: feed.id,
          latest_article_at: "2026-04-01T09:00:00Z",
          starred_count: 0,
        })),
      ),
      folderNameById: new Map(),
    });

    const visibleRows = buildVisibleSubscriptionRows({
      rows,
      activeSummaryFilter: "all",
      keptFeedIds: new Set(),
      deferredFeedIds: new Set(),
      searchQuery: "",
      sortKey: "updated_at",
    });

    expect(visibleRows.map((row) => row.feed.id)).toEqual(["feed-b", "feed-a", "feed-z"]);
  });

  it("uses title and feed id tie-breakers for rows with the same unread count", () => {
    const tieFeeds: FeedDto[] = [
      { ...feeds[0], id: "feed-z", title: "Shared", unread_count: 4 },
      { ...feeds[1], id: "feed-b", title: "Alpha", unread_count: 4 },
      { ...feeds[2], id: "feed-a", title: "Shared", unread_count: 4 },
    ];
    const rows = buildSubscriptionListRows({
      feeds: tieFeeds,
      candidateMap: new Map(),
      feedArticleSummaryMap: new Map(),
      folderNameById: new Map(),
    });

    const visibleRows = buildVisibleSubscriptionRows({
      rows,
      activeSummaryFilter: "all",
      keptFeedIds: new Set(),
      deferredFeedIds: new Set(),
      searchQuery: "",
      sortKey: "unread_count",
    });

    expect(visibleRows.map((row) => row.feed.id)).toEqual(["feed-b", "feed-a", "feed-z"]);
  });

  it("normalizes invalid unread counts before applying title and feed id tie-breakers", () => {
    const invalidUnreadFeeds: FeedDto[] = [
      { ...feeds[0], id: "feed-negative-z", title: "Shared", unread_count: -5 },
      { ...feeds[1], id: "feed-positive", title: "Positive", unread_count: 2 },
      { ...feeds[2], id: "feed-zero", title: "Zero", unread_count: 0 },
      { ...feeds[3], id: "feed-negative-a", title: "Shared", unread_count: -1 },
    ];
    const rows = buildSubscriptionListRows({
      feeds: invalidUnreadFeeds,
      candidateMap: new Map(),
      feedArticleSummaryMap: new Map(),
      folderNameById: new Map(),
    });

    const visibleRows = buildVisibleSubscriptionRows({
      rows,
      activeSummaryFilter: "all",
      keptFeedIds: new Set(),
      deferredFeedIds: new Set(),
      searchQuery: "",
      sortKey: "unread_count",
    });

    expect(visibleRows.map((row) => row.feed.id)).toEqual([
      "feed-positive",
      "feed-negative-a",
      "feed-negative-z",
      "feed-zero",
    ]);
  });

  it("groups subscription rows by folder label", () => {
    const rows = buildSubscriptionListRows({
      feeds,
      candidateMap: new Map(),
      feedArticleSummaryMap,
      folderNameById: new Map([["folder-work", "Work"]]),
    });

    expect(buildSubscriptionListGroups(rows, "No Folder")).toMatchObject([
      {
        key: "subscription-list:0-sentinel:no-folder",
        label: "No Folder",
        rows: [rows[1], rows[2], rows[3]],
        folderId: null,
      },
      {
        key: "subscription-list:1-folder:folder-work",
        label: "Work",
        rows: [rows[0]],
        folderId: "folder-work",
      },
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

  it("keeps group sorting from mutating the caller-owned row order", () => {
    const rows = buildSubscriptionListRows({
      feeds,
      candidateMap: new Map(),
      feedArticleSummaryMap,
      folderNameById: new Map([["folder-work", "AA Work"]]),
    });
    const rowOrderBeforeGrouping = rows.map((row) => row.feed.id);

    const groups = buildSubscriptionListGroups(rows, "ZZ No Folder");

    expect(groups.map((group) => group.label)).toEqual(["AA Work", "ZZ No Folder"]);
    expect(rows.map((row) => row.feed.id)).toEqual(rowOrderBeforeGrouping);
  });

  it("uses folder keys as a stable tie-breaker when folder labels match", () => {
    const sameLabelFeeds: FeedDto[] = [
      { ...feeds[0], id: "feed-z", folder_id: "folder-z", title: "Z feed" },
      { ...feeds[1], id: "feed-a", folder_id: "folder-a", title: "A feed" },
    ];
    const rows = buildSubscriptionListRows({
      feeds: sameLabelFeeds,
      candidateMap: new Map(),
      feedArticleSummaryMap: new Map(),
      folderNameById: new Map([
        ["folder-a", "Shared"],
        ["folder-z", "Shared"],
      ]),
    });

    const groups = buildSubscriptionListGroups(rows, "No Folder");

    expect(groups.map((group) => group.key)).toEqual([
      "subscription-list:1-folder:folder-a",
      "subscription-list:1-folder:folder-z",
    ]);
  });

  it("keeps the no-folder group stable when its label matches a folder label", () => {
    const sameLabelFeeds: FeedDto[] = [
      {
        ...feeds[0],
        id: "feed-folder",
        folder_id: "folder-archive",
        title: "Folder feed",
      },
      {
        ...feeds[1],
        id: "feed-no-folder",
        folder_id: null,
        title: "No folder feed",
      },
    ];
    const rows = buildSubscriptionListRows({
      feeds: sameLabelFeeds,
      candidateMap: new Map(),
      feedArticleSummaryMap: new Map(),
      folderNameById: new Map([["folder-archive", "Archive"]]),
    });

    const groups = buildSubscriptionListGroups(rows, "Archive");

    expect(groups.map((group) => group.key)).toEqual([
      "subscription-list:0-sentinel:no-folder",
      "subscription-list:1-folder:folder-archive",
    ]);
  });

  it("keeps no-folder and real folder ids in separate group key namespaces", () => {
    const collidingFeeds: FeedDto[] = [
      {
        ...feeds[0],
        id: "feed-real-folder",
        folder_id: "__ungrouped__",
        title: "Real folder feed",
      },
      {
        ...feeds[1],
        id: "feed-no-folder",
        folder_id: null,
        title: "No folder feed",
      },
    ];
    const rows = buildSubscriptionListRows({
      feeds: collidingFeeds,
      candidateMap: new Map(),
      feedArticleSummaryMap: new Map(),
      folderNameById: new Map([["__ungrouped__", "Real Ungrouped"]]),
    });

    const groups = buildSubscriptionListGroups(rows, "No Folder");

    expect(groups).toHaveLength(2);
    expect(groups).toMatchObject([
      {
        key: "subscription-list:0-sentinel:no-folder",
        label: "No Folder",
        rows: [rows[1]],
        folderId: null,
      },
      {
        key: "subscription-list:1-folder:__ungrouped__",
        label: "Real Ungrouped",
        rows: [rows[0]],
        folderId: "__ungrouped__",
      },
    ]);
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

    expect(
      resolveSelectedSubscriptionDisplayModeLabel({
        selectedRow: null,
        labels,
      }),
    ).toBe("Use default");
    expect(
      resolveSelectedSubscriptionDisplayModeLabel({
        selectedRow: baseRow,
        labels,
      }),
    ).toBe("Use default");
    expect(
      resolveSelectedSubscriptionDisplayModeLabel({
        selectedRow: {
          ...baseRow,
          feed: { ...baseRow.feed, reader_mode: "on", web_preview_mode: "off" },
        },
        labels,
      }),
    ).toBe("Standard");
    expect(
      resolveSelectedSubscriptionDisplayModeLabel({
        selectedRow: {
          ...baseRow,
          feed: { ...baseRow.feed, reader_mode: "on", web_preview_mode: "on" },
        },
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
