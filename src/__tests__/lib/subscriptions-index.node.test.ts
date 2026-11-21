import { describe, expect, it, vi } from "vitest";
import type {
  ArticleDto,
  FeedArticleSummaryDto,
  FeedDto,
  FolderDto,
  LocalFeedSyncStatusDto,
} from "@/api/tauri-commands";
import type { SubscriptionReviewCandidate } from "@/lib/subscriptions/subscription-review-candidates";
import { buildSubscriptionReviewCandidates } from "@/lib/subscriptions/subscription-review-candidates";
import {
  buildFeedArticleSummaryMap,
  buildSubscriptionActionRail,
  buildSubscriptionDetailCandidate,
  buildSubscriptionDetailMetrics,
  buildSubscriptionListGroups,
  buildSubscriptionListRows,
  buildSubscriptionReviewCandidateMap,
  buildVisibleSubscriptionRows,
  countSubscriptionFilterRows,
  formatSubscriptionDate,
  resolveSelectedSubscriptionCandidate,
  resolveSelectedSubscriptionDetailMetrics,
  resolveSelectedSubscriptionDisplayModeLabel,
  resolveSubscriptionRowReasonTooltipKey,
  resolveSubscriptionRowStatus,
  resolveSubscriptionsInventoryHeading,
} from "@/lib/subscriptions/subscriptions-index";
import type { SubscriptionFilterOption } from "@/lib/subscriptions/subscriptions-index.types";

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
  },
  {
    id: "feed-dormant",
    account_id: "acc-1",
    folder_id: null,
    remote_id: null,
    title: "Dormant Feed",
    url: "https://example.com/dormant.xml",
    site_url: "https://example.com/dormant",
    icon_url: null,
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
    last_seen_article_at: null,
    starred_count: 1,
    recent_article_count: 0,
  },
  {
    feed_id: "feed-active",
    latest_article_at: "2026-04-01T09:00:00Z",
    last_seen_article_at: null,
    starred_count: 1,
    recent_article_count: 0,
  },
  {
    feed_id: "feed-mid",
    latest_article_at: "2026-01-01T12:00:00Z",
    last_seen_article_at: null,
    starred_count: 0,
    recent_article_count: 0,
  },
  {
    feed_id: "feed-dormant",
    latest_article_at: "2026-03-15T12:00:00Z",
    last_seen_article_at: null,
    starred_count: 0,
    recent_article_count: 0,
  },
];

const feedArticleSummaryMap = buildFeedArticleSummaryMap(feedArticleSummaries);

describe("subscriptions index helpers", () => {
  it("counts each filter as the rows it lists without search, ignoring the show-kept toggle", () => {
    const fixtureFeeds = [
      "stale-open",
      "stale-kept",
      "stale-kept-error",
      "stale-attention",
      "frequent-kept",
      "plain",
    ].map(
      (id): FeedDto => ({
        ...feeds[0],
        id,
        title: id,
        folder_id: null,
        unread_count: id === "frequent-kept" ? 100 : 0,
      }),
    );
    const staleCandidate = (feedId: string, reasonKeys: SubscriptionReviewCandidate["reasonKeys"]) => ({
      feedId,
      title: feedId,
      folderId: null,
      folderName: null,
      latestArticleAt: null,
      staleDays: 120,
      unreadCount: 0,
      starredCount: 0,
      reasonKeys,
    });
    const fetchError: LocalFeedSyncStatusDto = {
      feed_id: "stale-kept-error",
      last_attempt_at: "2026-04-04T12:00:00Z",
      last_success_at: null,
      error_kind: "network",
      error_count: 1,
      diagnostic_id: "b52e8e15-b8c0-46d3-9949-44a6e5aab0b1",
    };
    const rows = buildSubscriptionListRows({
      feeds: fixtureFeeds,
      candidateMap: buildSubscriptionReviewCandidateMap([
        staleCandidate("stale-open", ["stale_90d"]),
        staleCandidate("stale-kept", ["stale_90d"]),
        staleCandidate("stale-kept-error", ["stale_90d"]),
        staleCandidate("stale-attention", ["attention_30d", "stale_90d"]),
      ]),
      feedArticleSummaryMap: new Map([
        [
          "frequent-kept",
          {
            feed_id: "frequent-kept",
            latest_article_at: null,
            last_seen_article_at: null,
            starred_count: 0,
            recent_article_count: 90,
          },
        ],
      ]),
      folderNameById: new Map(),
    }).map((row) => (row.feed.id === fetchError.feed_id ? { ...row, fetchError } : row));
    const keptFeedIds = new Set(["stale-kept", "stale-kept-error", "frequent-kept"]);

    const counts = countSubscriptionFilterRows(rows, keptFeedIds);

    expect(counts).toEqual({ all: 6, stale: 2, frequent: 1, fetch_errors: 1 });
    for (const filterKey of ["all", "stale", "frequent", "fetch_errors"] as const) {
      expect(counts[filterKey]).toBe(
        buildVisibleSubscriptionRows({
          rows,
          activeSummaryFilter: filterKey,
          keptFeedIds,
          showKept: false,
          searchQuery: "",
          sortKey: "title",
        }).length,
      );
    }
  });

  it("calculates stale days from UTC calendar days across timezone offsets", () => {
    const [candidate] = buildSubscriptionReviewCandidates({
      feeds: [{ ...feeds[0], unread_count: 1 }],
      folders,
      feedArticleSummaries: [
        {
          feed_id: "feed-stale",
          latest_article_at: "2026-01-01T23:30:00-02:00",
          last_seen_article_at: null,
          starred_count: 1,
          recent_article_count: 0,
        },
      ],
      now: new Date("2026-04-02T00:30:00+02:00"),
    });

    expect(candidate).toMatchObject({
      feedId: "feed-stale",
      staleDays: 89,
      reasonKeys: ["attention_30d"],
    });
  });

  it("uses the last duplicate review candidate for a feed id", () => {
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
      reasonKeys: ["stale_90d", "quiet_no_unread"],
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
          latestArticleDays: firstCandidate.staleDays,
          recentArticleCount: 0,
          status: { labelKey: "stale_90d" },
          reasonTooltipKey: "stale_90d",
        },
        candidateMap,
      }),
    ).toBe(secondCandidate);
    expect(resolveSelectedSubscriptionCandidate({ selectedRow: null, candidateMap })).toBeNull();
  });

  it("derives row status from review candidates only", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds,
      folders,
      feedArticleSummaries,
      now: new Date("2026-04-05T00:00:00Z"),
    });
    const candidateMap = buildSubscriptionReviewCandidateMap(candidates);

    expect(
      resolveSubscriptionRowStatus({
        candidate: candidateMap.get("feed-stale"),
      }),
    ).toEqual({ labelKey: "stale_90d" });

    expect(
      resolveSubscriptionRowStatus({
        candidate: candidateMap.get("feed-active"),
      }),
    ).toEqual({ labelKey: "normal" });

    expect(
      resolveSubscriptionRowStatus({
        candidate: candidateMap.get("feed-dormant"),
      }),
    ).toEqual({ labelKey: "normal" });

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
          reasonKeys: [],
        },
      }),
    ).toEqual({ labelKey: "normal" });
  });

  it("labels 30-day feeds as attention without making them decision candidates", () => {
    const [attentionCandidate] = buildSubscriptionReviewCandidates({
      feeds: [{ ...feeds[0], id: "feed-attention", unread_count: 0 }],
      folders,
      feedArticleSummaries: [
        {
          feed_id: "feed-attention",
          latest_article_at: "2026-03-06T00:00:00Z",
          last_seen_article_at: null,
          starred_count: 0,
          recent_article_count: 0,
        },
      ],
      now: new Date("2026-04-05T00:00:00Z"),
    });

    expect(resolveSubscriptionRowStatus({ candidate: attentionCandidate })).toEqual({ labelKey: "attention_30d" });
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
      recentArticleCount: 0,
      previewArticles: [articles[0], articles[1]],
    });
  });

  it("orders detail preview articles by valid dates before invalid dates with title and id tie-breakers", () => {
    const invalidArticle: ArticleDto = {
      ...articles[0],
      id: "art-invalid-date",
      title: "Invalid date post",
      published_at: "not-a-date",
    };
    const firstEqualDateArticle: ArticleDto = {
      ...articles[0],
      id: "art-equal-date-b",
      title: "Second equal date post",
      published_at: "2026-04-02T10:00:00Z",
    };
    const secondEqualDateArticle: ArticleDto = {
      ...articles[0],
      id: "art-equal-date-a",
      title: "First equal date post",
      published_at: "2026-04-02T10:00:00Z",
    };
    const sameTitleEqualDateArticle: ArticleDto = {
      ...articles[0],
      id: "art-equal-date-c",
      title: "First equal date post",
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
        articles: [firstEqualDateArticle, sameTitleEqualDateArticle, secondEqualDateArticle],
        feedArticleSummary: feedArticleSummaryMap.get("feed-stale") ?? null,
      }).previewArticles.map((article) => article.id),
    ).toEqual([secondEqualDateArticle.id, sameTitleEqualDateArticle.id]);
  });

  it("keeps invalid detail preview date ties sorted by title behind valid articles", () => {
    const firstInvalidArticle: ArticleDto = {
      ...articles[0],
      id: "art-invalid-date-1",
      title: "Second invalid date post",
      published_at: "not-a-date",
    };
    const secondInvalidArticle: ArticleDto = {
      ...articles[0],
      id: "art-invalid-date-2",
      title: "First invalid date post",
      published_at: "also-not-a-date",
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
    ).toEqual([validArticle.id, secondInvalidArticle.id]);
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
      last_seen_article_at: null,
      starred_count: 7,
      recent_article_count: 0,
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
      recentArticleCount: 0,
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
      recentArticleCount: 0,
      previewArticles: [newerUnstarredArticle, olderStarredArticle],
    });
  });

  it("derives the inventory heading from the active filter option", () => {
    const filterOptions = [
      { filterKey: "all", label: "All", count: 4, isActive: false },
      { filterKey: "stale", label: "Stale", count: 2, isActive: true },
    ] satisfies SubscriptionFilterOption[];

    expect(
      resolveSubscriptionsInventoryHeading({
        activeSummaryFilter: "stale",
        filterOptions,
        defaultHeading: "Inventory",
      }),
    ).toBe("Stale");
    expect(
      resolveSubscriptionsInventoryHeading({ activeSummaryFilter: "all", filterOptions, defaultHeading: "Inventory" }),
    ).toBe("Inventory");
  });

  it("builds list rows with folder names and candidate status", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds,
      folders,
      feedArticleSummaries,
      now: new Date("2026-04-05T00:00:00Z"),
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
      latestArticleDays: 155,
      status: { labelKey: "stale_90d" },
      reasonTooltipKey: "stale_90d",
    });
    expect(rows[0].latestArticleDays).toBe(
      candidates.find((candidate) => candidate.feedId === "feed-stale")?.staleDays,
    );
    expect(
      buildSubscriptionListRows({
        feeds,
        candidateMap: new Map(),
        feedArticleSummaryMap,
        folderNameById: new Map(),
      })[0].latestArticleDays,
    ).toBeNull();
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

  it("groups feeds with missing folder ids into the no-folder bucket", () => {
    const staleFolderFeed: FeedDto = {
      ...feeds[0],
      id: "feed-missing-folder-a",
      folder_id: "folder-deleted-a",
      title: "Missing folder A",
    };
    const otherStaleFolderFeed: FeedDto = {
      ...feeds[0],
      id: "feed-missing-folder-b",
      folder_id: "folder-deleted-b",
      title: "Missing folder B",
    };
    const rows = buildSubscriptionListRows({
      feeds: [staleFolderFeed, otherStaleFolderFeed, feeds[1]],
      candidateMap: new Map(),
      feedArticleSummaryMap,
      folderNameById: new Map(),
    });
    const groups = buildSubscriptionListGroups(rows, "No folder");

    expect(rows.map((row) => ({ feedId: row.feed.id, folderId: row.folderId, folderName: row.folderName }))).toEqual([
      { feedId: "feed-missing-folder-a", folderId: null, folderName: null },
      { feedId: "feed-missing-folder-b", folderId: null, folderName: null },
      { feedId: "feed-active", folderId: null, folderName: null },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      key: "subscription-list:0-sentinel:no-folder",
      label: "No folder",
      folderId: null,
    });
    expect(groups[0]?.rows.map((row) => row.feed.id)).toEqual([
      "feed-missing-folder-a",
      "feed-missing-folder-b",
      "feed-active",
    ]);
  });

  it("resolves row reason tooltip keys from flagged status or missing article history", () => {
    expect(
      resolveSubscriptionRowReasonTooltipKey({
        latestArticleAt: "2026-04-01T09:00:00Z",
        status: { labelKey: "quiet_no_unread" },
      }),
    ).toBe("quiet_no_unread");
    expect(
      resolveSubscriptionRowReasonTooltipKey({
        latestArticleAt: null,
        status: { labelKey: "normal" },
      }),
    ).toBe("no_articles");
    expect(
      resolveSubscriptionRowReasonTooltipKey({
        latestArticleAt: "2026-04-01T09:00:00Z",
        status: { labelKey: "normal" },
      }),
    ).toBeNull();
  });

  describe("buildSubscriptionActionRail", () => {
    const labels = {
      keep: "Exclude from review",
      unkeep: "Remove review exclusion",
      delete: "Delete",
      edit: "Edit",
      keptChip: "Excluded from review",
      keptEffect: "Left out of lists",
    };

    function buildRowsWithFlaggedFirst(reasonKey: "stale_90d" | "attention_30d" = "stale_90d") {
      return buildSubscriptionListRows({
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
              reasonKeys: [reasonKey],
            },
          ],
        ]),
        feedArticleSummaryMap,
        folderNameById: new Map([["folder-work", "Work"]]),
      });
    }

    function buildCallbacks() {
      return { onKeep: vi.fn(), onUnkeep: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };
    }

    it("builds no rail without a selected row", () => {
      expect(buildSubscriptionActionRail({ selectedRow: null, isKept: false, labels, ...buildCallbacks() })).toBeNull();
      expect(buildSubscriptionActionRail({ selectedRow: null, isKept: true, labels, ...buildCallbacks() })).toBeNull();
    });

    it("offers keep for flagged rows, including attention rows, and always keeps edit and delete reachable", () => {
      for (const reasonKey of ["stale_90d", "attention_30d"] as const) {
        const rows = buildRowsWithFlaggedFirst(reasonKey);
        const callbacks = buildCallbacks();

        const rail = buildSubscriptionActionRail({ selectedRow: rows[0], isKept: false, labels, ...callbacks });

        expect(rail).toMatchObject({
          decision: { kind: "keep", label: "Exclude from review" },
          editLabel: "Edit",
          deleteLabel: "Delete",
        });
        rail?.decision?.onClick();
        rail?.onEdit();
        rail?.onDelete();
        expect(callbacks.onKeep).toHaveBeenCalledWith(rows[0]);
        expect(callbacks.onEdit).toHaveBeenCalledTimes(1);
        expect(callbacks.onDelete).toHaveBeenCalledTimes(1);
      }
    });

    it("offers no decision for an unflagged row that is not kept", () => {
      const rows = buildRowsWithFlaggedFirst();
      const callbacks = buildCallbacks();

      const rail = buildSubscriptionActionRail({ selectedRow: rows[1], isKept: false, labels, ...callbacks });

      expect(rail?.decision).toBeNull();
      rail?.onEdit();
      rail?.onDelete();
      expect(callbacks.onEdit).toHaveBeenCalledTimes(1);
      expect(callbacks.onDelete).toHaveBeenCalledTimes(1);
    });

    it("offers unkeep for a kept row and reports whether the decision stays after the click", () => {
      const rows = buildRowsWithFlaggedFirst();
      const cases = [
        { selectedRow: rows[0], remainsAfterClick: true },
        { selectedRow: rows[1], remainsAfterClick: false },
      ];

      for (const { selectedRow, remainsAfterClick } of cases) {
        const callbacks = buildCallbacks();
        const rail = buildSubscriptionActionRail({ selectedRow, isKept: true, labels, ...callbacks });

        expect(rail?.decision).toMatchObject({
          kind: "unkeep",
          label: "Remove review exclusion",
          keptChipLabel: "Excluded from review",
          keptEffectLabel: "Left out of lists",
          remainsAfterClick,
        });
        rail?.decision?.onClick();
        expect(callbacks.onUnkeep).toHaveBeenCalledWith(selectedRow);
      }
    });
  });

  it("hides a kept stale feed from the stale filter", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds,
      folders,
      feedArticleSummaries,
      now: new Date("2026-04-05T00:00:00Z"),
    });
    const rows = buildSubscriptionListRows({
      feeds,
      candidateMap: buildSubscriptionReviewCandidateMap(candidates),
      feedArticleSummaryMap,
      folderNameById: new Map([["folder-work", "Work"]]),
    });

    const visibleRows = buildVisibleSubscriptionRows({
      rows,
      activeSummaryFilter: "stale",
      keptFeedIds: new Set(),
      showKept: false,
      searchQuery: "",
      sortKey: "updated_at",
    });

    expect(visibleRows.map((row) => row.feed.id)).toEqual(["feed-mid", "feed-stale"]);

    expect(
      buildVisibleSubscriptionRows({
        rows,
        activeSummaryFilter: "stale",
        keptFeedIds: new Set(["feed-stale"]),
        showKept: false,
        searchQuery: "",
        sortKey: "updated_at",
      }).map((row) => row.feed.id),
    ).toEqual(["feed-mid"]);
  });

  it("keeps a failed stale feed in activity filters and visible after a review decision", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds,
      folders,
      feedArticleSummaries,
      now: new Date("2026-04-05T00:00:00Z"),
    });
    const rows = buildSubscriptionListRows({
      feeds,
      candidateMap: buildSubscriptionReviewCandidateMap(candidates),
      feedArticleSummaryMap,
      folderNameById: new Map([["folder-work", "Work"]]),
    }).map((row) =>
      row.feed.id === "feed-stale"
        ? {
            ...row,
            fetchError: {
              feed_id: row.feed.id,
              last_attempt_at: "2026-04-04T12:00:00Z",
              last_success_at: null,
              error_kind: "network" as const,
              error_count: 2,
              diagnostic_id: "b52e8e15-b8c0-46d3-9949-44a6e5aab0b1",
            },
            reasonTooltipKey: "fetch_error" as const,
          }
        : row,
    );

    const visibleIdsFor = (activeSummaryFilter: "stale" | "fetch_errors") =>
      buildVisibleSubscriptionRows({
        rows,
        activeSummaryFilter,
        keptFeedIds: new Set(["feed-stale"]),
        showKept: false,
        searchQuery: "",
        sortKey: "title",
      }).map((row) => row.feed.id);

    expect(rows.find((row) => row.feed.id === "feed-stale")?.status.labelKey).toBe("stale_90d");
    expect(visibleIdsFor("stale")).toContain("feed-stale");
    expect(visibleIdsFor("fetch_errors")).toEqual(["feed-stale"]);
  });

  it("treats a remote fetch failure like a fetch error in filters and kept visibility", () => {
    const candidates = buildSubscriptionReviewCandidates({
      feeds,
      folders,
      feedArticleSummaries,
      now: new Date("2026-04-05T00:00:00Z"),
    });
    const rows = buildSubscriptionListRows({
      feeds,
      candidateMap: buildSubscriptionReviewCandidateMap(candidates),
      feedArticleSummaryMap,
      folderNameById: new Map([["folder-work", "Work"]]),
    }).map((row) =>
      row.feed.id === "feed-stale"
        ? {
            ...row,
            remoteFetchFailure: { lastSuccessAt: "2026-03-01T00:00:00Z" },
            reasonTooltipKey: "remote_fetch_error" as const,
          }
        : row,
    );

    const visibleIdsFor = (activeSummaryFilter: "stale" | "fetch_errors") =>
      buildVisibleSubscriptionRows({
        rows,
        activeSummaryFilter,
        keptFeedIds: new Set(["feed-stale"]),
        showKept: false,
        searchQuery: "",
        sortKey: "title",
      }).map((row) => row.feed.id);

    expect(visibleIdsFor("stale")).toContain("feed-stale");
    expect(visibleIdsFor("fetch_errors")).toEqual(["feed-stale"]);
    expect(countSubscriptionFilterRows(rows, new Set(["feed-stale"])).fetch_errors).toBe(1);
  });

  it("treats a legacy other error with a clamped zero count as a fetch failure", () => {
    const rows = buildSubscriptionListRows({
      feeds: feeds.filter((feed) => feed.id === "feed-active"),
      candidateMap: new Map(),
      feedArticleSummaryMap,
      folderNameById: new Map(),
    }).map((row) => ({
      ...row,
      reasonTooltipKey: "fetch_error" as const,
      fetchError: {
        feed_id: row.feed.id,
        last_attempt_at: "2026-04-04T12:00:00Z",
        last_success_at: null,
        error_kind: "other" as const,
        error_count: 0,
        diagnostic_id: null,
      },
    }));

    expect(
      buildVisibleSubscriptionRows({
        rows,
        activeSummaryFilter: "fetch_errors",
        keptFeedIds: new Set(),
        showKept: false,
        searchQuery: "",
        sortKey: "title",
      }).map((row) => row.feed.id),
    ).toEqual(["feed-active"]);
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
      showKept: false,
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
    });
    const rows = buildSubscriptionListRows({
      feeds,
      candidateMap: buildSubscriptionReviewCandidateMap(candidates),
      feedArticleSummaryMap,
      folderNameById: new Map([["folder-work", "Work"]]),
    });
    const keptFeedIds = new Set(["feed-stale", "feed-mid"]);

    expect(
      buildVisibleSubscriptionRows({
        rows,
        activeSummaryFilter: "all",
        keptFeedIds,
        showKept: false,
        searchQuery: "",
        sortKey: "title",
      }).map((row) => row.feed.id),
    ).toEqual(["feed-active", "feed-dormant", "feed-stale", "feed-mid"]);

    expect(
      buildVisibleSubscriptionRows({
        rows,
        activeSummaryFilter: "stale",
        keptFeedIds,
        showKept: false,
        searchQuery: "",
        sortKey: "title",
      }).map((row) => row.feed.id),
    ).toEqual([]);
  });

  it("filters visible rows to overloaded feeds for the frequent card", () => {
    const overloadedFeeds = [
      { ...feeds[0], id: "feed-quiet-overloaded", title: "Quiet Overloaded Feed", unread_count: 100 },
      feeds[1],
    ];
    const rows = buildSubscriptionListRows({
      feeds: overloadedFeeds,
      candidateMap: new Map(),
      feedArticleSummaryMap: new Map([
        [
          "feed-quiet-overloaded",
          {
            feed_id: "feed-quiet-overloaded",
            latest_article_at: null,
            last_seen_article_at: null,
            starred_count: 0,
            recent_article_count: 90,
          },
        ],
        [
          "feed-active",
          {
            feed_id: "feed-active",
            latest_article_at: null,
            last_seen_article_at: null,
            starred_count: 0,
            recent_article_count: 89,
          },
        ],
      ]),
      folderNameById: new Map([["folder-work", "Work"]]),
    });

    expect(
      buildVisibleSubscriptionRows({
        rows,
        activeSummaryFilter: "frequent",
        keptFeedIds: new Set(),
        showKept: false,
        searchQuery: "",
        sortKey: "title",
      }).map((row) => row.feed.id),
    ).toEqual(["feed-quiet-overloaded"]);
  });

  it("keeps the frequent filter count consistent with the filtered list and does not hide kept overloaded feeds", () => {
    const overloadedFeeds = [{ ...feeds[1], unread_count: 100 }, feeds[0], feeds[2], feeds[3]];
    const frequentSummaryMap = new Map([
      [
        "feed-active",
        {
          feed_id: "feed-active",
          latest_article_at: null,
          last_seen_article_at: null,
          starred_count: 0,
          recent_article_count: 90,
        },
      ],
      [
        "feed-mid",
        {
          feed_id: "feed-mid",
          latest_article_at: null,
          last_seen_article_at: null,
          starred_count: 0,
          recent_article_count: 95,
        },
      ],
      [
        "feed-stale",
        {
          feed_id: "feed-stale",
          latest_article_at: null,
          last_seen_article_at: null,
          starred_count: 0,
          recent_article_count: 95,
        },
      ],
      [
        "feed-dormant",
        {
          feed_id: "feed-dormant",
          latest_article_at: null,
          last_seen_article_at: null,
          starred_count: 0,
          recent_article_count: 95,
        },
      ],
    ]);
    const rows = buildSubscriptionListRows({
      feeds: overloadedFeeds,
      candidateMap: new Map(),
      feedArticleSummaryMap: frequentSummaryMap,
      folderNameById: new Map([["folder-work", "Work"]]),
    });

    // An overloaded feed that was kept must still appear under the
    // informational "frequent" filter (only review/stale hide decided feeds).
    const visibleFeedIds = buildVisibleSubscriptionRows({
      rows,
      activeSummaryFilter: "frequent",
      keptFeedIds: new Set(["feed-active"]),
      showKept: false,
      searchQuery: "",
      sortKey: "title",
    }).map((row) => row.feed.id);

    const frequentCount = countSubscriptionFilterRows(rows, new Set(["feed-active"])).frequent;

    // Count side (filter button) and list side agree on the same input.
    expect(frequentCount).toBe(1);
    expect(visibleFeedIds).toEqual(["feed-active"]);
    expect(visibleFeedIds).toHaveLength(frequentCount);
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
        showKept: false,
        searchQuery: "work",
        sortKey: "title",
      }).map((row) => row.feed.id),
    ).toEqual(["feed-stale"]);
    expect(
      buildVisibleSubscriptionRows({
        rows,
        activeSummaryFilter: "all",
        keptFeedIds: new Set(),
        showKept: false,
        searchQuery: "feed",
        sortKey: "unread_count",
      }).map((row) => row.feed.id),
    ).toEqual(["feed-active", "feed-dormant", "feed-mid"]);
    expect(
      buildVisibleSubscriptionRows({
        rows,
        activeSummaryFilter: "all",
        keptFeedIds: new Set(),
        showKept: false,
        searchQuery: "EXAMPLE.COM/ACTIVE",
        sortKey: "title",
      }).map((row) => row.feed.id),
    ).toEqual(["feed-active"]);
    expect(
      buildVisibleSubscriptionRows({
        rows,
        activeSummaryFilter: "all",
        keptFeedIds: new Set(),
        showKept: false,
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
        showKept: false,
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
      showKept: false,
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
          last_seen_article_at: null,
          starred_count: 0,
          recent_article_count: 0,
        },
        {
          feed_id: "feed-valid",
          latest_article_at: "2026-04-01T09:00:00Z",
          last_seen_article_at: null,
          starred_count: 0,
          recent_article_count: 0,
        },
        {
          feed_id: "feed-invalid-a",
          latest_article_at: "",
          last_seen_article_at: null,
          starred_count: 0,
          recent_article_count: 0,
        },
        {
          feed_id: "feed-invalid-b",
          latest_article_at: "invalid-date",
          last_seen_article_at: null,
          starred_count: 0,
          recent_article_count: 0,
        },
      ]),
      folderNameById: new Map(),
    });

    const visibleRows = buildVisibleSubscriptionRows({
      rows,
      activeSummaryFilter: "all",
      keptFeedIds: new Set(),
      showKept: false,
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
          last_seen_article_at: null,
          starred_count: 0,
          recent_article_count: 0,
        })),
      ),
      folderNameById: new Map(),
    });

    const visibleRows = buildVisibleSubscriptionRows({
      rows,
      activeSummaryFilter: "all",
      keptFeedIds: new Set(),
      showKept: false,
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
      showKept: false,
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
      showKept: false,
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
        key: "subscription-list:1-folder:folder-work",
        label: "Work",
        rows: [rows[0]],
        folderId: "folder-work",
      },
      {
        key: "subscription-list:0-sentinel:no-folder",
        label: "No Folder",
        rows: [rows[1], rows[2], rows[3]],
        folderId: null,
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
      showKept: false,
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

  it("keeps the no-folder group last even when its label sorts before every folder label", () => {
    const rows = buildSubscriptionListRows({
      feeds: [
        { ...feeds[0], id: "feed-folder", folder_id: "folder-zeta", title: "Folder feed" },
        { ...feeds[1], id: "feed-no-folder", folder_id: null, title: "No folder feed" },
      ],
      candidateMap: new Map(),
      feedArticleSummaryMap: new Map(),
      folderNameById: new Map([["folder-zeta", "Zeta"]]),
    });

    const groups = buildSubscriptionListGroups(rows, "Alpha");

    expect(groups.map((group) => group.folderId)).toEqual(["folder-zeta", null]);
  });

  it("keeps the no-folder group last when its label matches a folder label", () => {
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
      "subscription-list:1-folder:folder-archive",
      "subscription-list:0-sentinel:no-folder",
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
        key: "subscription-list:1-folder:__ungrouped__",
        label: "Real Ungrouped",
        rows: [rows[0]],
        folderId: "__ungrouped__",
      },
      {
        key: "subscription-list:0-sentinel:no-folder",
        label: "No Folder",
        rows: [rows[1]],
        folderId: null,
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
    });
    const selectedCandidate = candidates.find((candidate) => candidate.feedId === "feed-stale") ?? null;

    const detail = buildSubscriptionDetailCandidate({
      selectedRow: {
        feed: feeds[0],
        folderId: "folder-work",
        folderName: "Work",
        latestArticleAt: selectedCandidate?.latestArticleAt ?? null,
        latestArticleDays: selectedCandidate?.staleDays ?? null,
        recentArticleCount: 0,
        status: { labelKey: "stale_90d" },
        reasonTooltipKey: "stale_90d",
      },
      selectedCandidate,
      labels: {
        statusLabel: (labelKey) => labelKey,
        summaryText: (summaryKey) => summaryKey,
        reasonFact: (fact) => `${fact.key}:${fact.value}`,
        reasonLabel: (reasonKey, staleDays) => `${reasonKey}:${staleDays}`,
      },
    });

    expect(detail).toMatchObject({
      candidate: selectedCandidate,
      tone: "danger",
      statusLabel: "stale_90d",
      reasonBoxBody: "stale_90d:155 / unread_count:0",
    });
  });

  it("builds no reason box body when the selected feed is not a review candidate", () => {
    const detail = buildSubscriptionDetailCandidate({
      selectedRow: {
        feed: feeds[0],
        folderId: "folder-work",
        folderName: "Work",
        latestArticleAt: null,
        latestArticleDays: null,
        recentArticleCount: 0,
        status: { labelKey: "normal" },
        reasonTooltipKey: "normal",
      },
      selectedCandidate: null,
      labels: {
        statusLabel: (labelKey) => labelKey,
        summaryText: (summaryKey) => summaryKey,
        reasonFact: (fact) => `${fact.key}:${fact.value}`,
        reasonLabel: (reasonKey, staleDays) => `${reasonKey}:${staleDays}`,
      },
    });

    expect(detail).toEqual({ candidate: null, tone: "neutral", statusLabel: "normal", reasonBoxBody: null });
  });

  it("builds no reason box body for a candidate record without review reasons", () => {
    const detail = buildSubscriptionDetailCandidate({
      selectedRow: {
        feed: feeds[1],
        folderId: null,
        folderName: null,
        latestArticleAt: null,
        latestArticleDays: null,
        recentArticleCount: 0,
        status: { labelKey: "normal" },
        reasonTooltipKey: "normal",
      },
      selectedCandidate: {
        feedId: "feed-active",
        title: "Active Feed",
        folderId: null,
        folderName: null,
        latestArticleAt: null,
        staleDays: null,
        unreadCount: 3,
        starredCount: 0,
        reasonKeys: [],
      },
      labels: {
        statusLabel: (labelKey) => labelKey,
        summaryText: (summaryKey) => summaryKey,
        reasonFact: (fact) => `${fact.key}:${fact.value}`,
        reasonLabel: (reasonKey, staleDays) => `${reasonKey}:${staleDays}`,
      },
    });

    expect(detail?.reasonBoxBody).toBeNull();
  });
});
