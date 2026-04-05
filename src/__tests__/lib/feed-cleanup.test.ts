import { describe, expect, it } from "vitest";
import type { ArticleDto, FeedDto, FolderDto } from "@/api/tauri-commands";
import { buildFeedCleanupCandidates, summarizeCleanupCandidate } from "@/lib/feed-cleanup";

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
];

describe("buildFeedCleanupCandidates", () => {
  it("derives one candidate per feed with latest article, folder name, and signal counts", () => {
    const candidates = buildFeedCleanupCandidates({
      feeds,
      folders,
      articles,
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

  it("marks stale low-signal feeds with cleanup reasons and sorts the strongest candidate first", () => {
    const candidates = buildFeedCleanupCandidates({
      feeds,
      folders,
      articles,
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });

    expect(candidates.map((candidate) => candidate.feedId)).toEqual(["feed-stale", "feed-mid", "feed-active"]);
    expect(candidates[0]?.reasonKeys).toEqual(["stale_90d", "no_unread"]);
    expect(candidates[1]?.reasonKeys).toEqual(["stale_90d", "no_unread", "no_stars"]);
    expect(candidates[2]?.reasonKeys).toEqual([]);
    expect(candidates[0]?.staleDays).toBeGreaterThan(90);
  });

  it("excludes candidates removed by keep or later local state", () => {
    const candidates = buildFeedCleanupCandidates({
      feeds,
      folders,
      articles,
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(["feed-stale", "feed-mid"]),
    });

    expect(candidates.map((candidate) => candidate.feedId)).toEqual(["feed-active"]);
  });

  it("summarizes candidate urgency for the review panel", () => {
    const candidates = buildFeedCleanupCandidates({
      feeds,
      folders,
      articles,
      now: new Date("2026-04-05T00:00:00Z"),
      hiddenFeedIds: new Set(),
    });

    expect(summarizeCleanupCandidate(candidates[0]!)).toEqual({
      tone: "high",
      titleKey: "review_now",
      summaryKey: "stale_and_inactive",
    });
    expect(summarizeCleanupCandidate(candidates[2]!)).toEqual({
      tone: "low",
      titleKey: "keep",
      summaryKey: "healthy_feed",
    });
  });
});
