import { describe, expect, it } from "vitest";
import type { ArticleDto, FeedDto, FolderDto } from "@/api/tauri-commands";
import { buildSubscriptionReviewCandidates } from "@/lib/subscription-review-candidates";
import {
  buildSubscriptionDetailMetrics,
  buildSubscriptionReviewCandidateMap,
  buildSubscriptionsIndexSummary,
  resolveSubscriptionRowStatus,
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
  });
});
