import { renderHook, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedArticleSummaryDto, FeedDto } from "@/api/tauri-commands";
import { useSidebarSources } from "@/components/reader/hooks/sidebar/use-sidebar-sources";

setupBrowserTestDom();

const {
  useAccountsMock,
  useFeedsMock,
  useFoldersMock,
  useTagsMock,
  useTagArticleCountsMock,
  useFeedArticleSummariesMock,
  useAccountStarredCountMock,
  useSidebarAccountStatusLabelsMock,
} = vi.hoisted(() => ({
  useAccountsMock: vi.fn(),
  useFeedsMock: vi.fn(),
  useFoldersMock: vi.fn(),
  useTagsMock: vi.fn(),
  useTagArticleCountsMock: vi.fn(),
  useFeedArticleSummariesMock: vi.fn(),
  useAccountStarredCountMock: vi.fn(),
  useSidebarAccountStatusLabelsMock: vi.fn(),
}));

vi.mock("@/hooks/use-accounts", () => ({
  useAccounts: (...args: unknown[]) => useAccountsMock(...args),
}));

vi.mock("@/hooks/use-feeds", () => ({
  useFeeds: (...args: unknown[]) => useFeedsMock(...args),
}));

vi.mock("@/hooks/use-folders", () => ({
  useFolders: (...args: unknown[]) => useFoldersMock(...args),
}));

vi.mock("@/hooks/use-tags", () => ({
  useTags: (...args: unknown[]) => useTagsMock(...args),
  useTagArticleCounts: (...args: unknown[]) => useTagArticleCountsMock(...args),
}));

vi.mock("@/hooks/use-articles", () => ({
  useAccountStarredCount: (...args: unknown[]) => useAccountStarredCountMock(...args),
}));

vi.mock("@/components/subscriptions-index/hooks/use-feed-article-summaries", () => ({
  useFeedArticleSummaries: (...args: unknown[]) => useFeedArticleSummariesMock(...args),
}));

vi.mock("@/components/reader/hooks/sidebar/use-sidebar-account-status-labels", () => ({
  useSidebarAccountStatusLabels: (...args: unknown[]) => useSidebarAccountStatusLabelsMock(...args),
}));

const makeFeed = (overrides: Partial<FeedDto> & { id: string }): FeedDto => ({
  account_id: "acc-1",
  folder_id: null,
  remote_id: null,
  title: "Feed",
  url: "https://example.com/feed.xml",
  site_url: "https://example.com",
  unread_count: 0,
  reader_mode: "on",
  web_preview_mode: "off",
  icon_url: null,
  ...overrides,
});

const makeFeedArticleSummary = (
  overrides: Partial<FeedArticleSummaryDto> & { feed_id: string },
): FeedArticleSummaryDto => ({
  latest_article_at: null,
  starred_count: 0,
  recent_article_count: 0,
  ...overrides,
});

describe("useSidebarSources starredCountByFeedId", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAccountsMock.mockReturnValue({ data: [] });
    useFoldersMock.mockReturnValue({ data: [] });
    useTagsMock.mockReturnValue({ data: [] });
    useTagArticleCountsMock.mockReturnValue({ data: {} });
    useAccountStarredCountMock.mockReturnValue({ data: 0 });
    useSidebarAccountStatusLabelsMock.mockReturnValue({});
  });

  it("derives per-feed starred counts from feed article summaries, matching the full DB count past the starred list's default page size", async () => {
    // Regression for improve-005: 51 starred articles split across two feeds (30 / 21).
    // list_starred_articles defaults to a 50-row page, so deriving counts from that
    // capped list previously under-counted one of the feeds. Deriving from
    // list_feed_article_summaries (a COUNT-based query) matches the DB truth instead.
    useFeedsMock.mockReturnValue({
      data: [makeFeed({ id: "feed-a" }), makeFeed({ id: "feed-b" })],
    });
    useFeedArticleSummariesMock.mockReturnValue({
      data: [
        makeFeedArticleSummary({ feed_id: "feed-a", starred_count: 30 }),
        makeFeedArticleSummary({ feed_id: "feed-b", starred_count: 21 }),
      ],
    });

    const { result } = renderHook(() => useSidebarSources({ selectedAccountId: "acc-1" }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.starredCountByFeedId.get("feed-a")).toBe(30);
    });
    expect(result.current.starredCountByFeedId.get("feed-b")).toBe(21);
    expect(Array.from(result.current.starredCountByFeedId.values()).reduce((sum, count) => sum + count, 0)).toBe(51);
  });

  it("omits feeds with a zero starred count", async () => {
    useFeedsMock.mockReturnValue({
      data: [makeFeed({ id: "feed-a" }), makeFeed({ id: "feed-b" })],
    });
    useFeedArticleSummariesMock.mockReturnValue({
      data: [
        makeFeedArticleSummary({ feed_id: "feed-a", starred_count: 0 }),
        makeFeedArticleSummary({ feed_id: "feed-b", starred_count: 4 }),
      ],
    });

    const { result } = renderHook(() => useSidebarSources({ selectedAccountId: "acc-1" }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.starredCountByFeedId.has("feed-b")).toBe(true);
    });
    expect(result.current.starredCountByFeedId.has("feed-a")).toBe(false);
  });
});
