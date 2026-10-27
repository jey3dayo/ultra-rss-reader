import { Result } from "@praha/byethrow";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import * as tauriCommands from "@/api/tauri-commands";
import { countSameSiteFeeds, useMarkSameSiteFeedsRead } from "./use-mark-same-site-feeds-read";

vi.mock("@/api/tauri-commands", () => ({
  markFeedRead: vi.fn(),
}));

const createTestFeed = (overrides: Partial<FeedDto> = {}): FeedDto => ({
  id: "feed-1",
  account_id: "account-1",
  folder_id: null,
  remote_id: null,
  title: "Test Feed",
  url: "https://example.com/feed",
  site_url: "https://example.com",
  icon_url: null,
  unread_count: 0,
  reader_mode: "inherit",
  web_preview_mode: "inherit",
  ...overrides,
});

describe("countSameSiteFeeds", () => {
  it("counts feeds with the same normalized host", () => {
    const targetFeed = createTestFeed({ id: "feed-1", site_url: "https://www.example.com" });
    const allFeeds = [
      targetFeed,
      createTestFeed({ id: "feed-2", site_url: "https://example.com" }),
      createTestFeed({ id: "feed-3", site_url: "https://WWW.EXAMPLE.COM" }),
      createTestFeed({ id: "feed-4", site_url: "https://other.com" }),
    ];

    expect(countSameSiteFeeds(targetFeed, allFeeds)).toBe(3);
  });

  it("counts feeds using feed URL as fallback", () => {
    const targetFeed = createTestFeed({ id: "feed-1", site_url: "", url: "https://www.example.com/feed" });
    const allFeeds = [
      targetFeed,
      createTestFeed({ id: "feed-2", site_url: "", url: "https://example.com/rss" }),
      createTestFeed({ id: "feed-3", site_url: "https://other.com", url: "https://other.com/feed" }),
    ];

    expect(countSameSiteFeeds(targetFeed, allFeeds)).toBe(2);
  });

  it("only matches feeds from the same account", () => {
    const targetFeed = createTestFeed({ id: "feed-1", account_id: "account-1", site_url: "https://example.com" });
    const allFeeds = [
      targetFeed,
      createTestFeed({ id: "feed-2", account_id: "account-1", site_url: "https://example.com" }),
      createTestFeed({ id: "feed-3", account_id: "account-2", site_url: "https://example.com" }),
    ];

    expect(countSameSiteFeeds(targetFeed, allFeeds)).toBe(2);
  });

  it("only matches itself when host cannot be determined", () => {
    const targetFeed = createTestFeed({ id: "feed-1", site_url: "", url: "invalid-url" });
    const allFeeds = [
      targetFeed,
      createTestFeed({ id: "feed-2", site_url: "", url: "also-invalid" }),
      createTestFeed({ id: "feed-3", site_url: "https://example.com" }),
    ];

    expect(countSameSiteFeeds(targetFeed, allFeeds)).toBe(1);
  });

  it("returns 1 when the target feed is the only feed", () => {
    const targetFeed = createTestFeed({ id: "feed-1", site_url: "https://example.com" });
    const allFeeds = [targetFeed];

    expect(countSameSiteFeeds(targetFeed, allFeeds)).toBe(1);
  });

  it("returns 1 when no other feeds match", () => {
    const targetFeed = createTestFeed({ id: "feed-1", site_url: "https://example.com" });
    const allFeeds = [
      targetFeed,
      createTestFeed({ id: "feed-2", site_url: "https://other.com" }),
      createTestFeed({ id: "feed-3", site_url: "https://another.com" }),
    ];

    expect(countSameSiteFeeds(targetFeed, allFeeds)).toBe(1);
  });
});

describe("useMarkSameSiteFeedsRead", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  it("marks all feeds with the same site as read", async () => {
    const targetFeed = createTestFeed({ id: "feed-1", site_url: "https://www.example.com" });
    const allAccountFeeds = [
      targetFeed,
      createTestFeed({ id: "feed-2", site_url: "https://example.com" }),
      createTestFeed({ id: "feed-3", site_url: "https://WWW.EXAMPLE.COM" }),
      createTestFeed({ id: "feed-4", site_url: "https://other.com" }),
    ];

    const mockMarkFeedRead = vi.mocked(tauriCommands.markFeedRead);
    mockMarkFeedRead.mockImplementation((feedId) => {
      if (feedId === "feed-1") {
        return Promise.resolve(Result.succeed(["article-1", "article-2"]));
      }
      if (feedId === "feed-2") {
        return Promise.resolve(Result.succeed(["article-3"]));
      }
      if (feedId === "feed-3") {
        return Promise.resolve(Result.succeed([]));
      }
      return Promise.resolve(Result.succeed([]));
    });

    const { result } = renderHook(() => useMarkSameSiteFeedsRead(), { wrapper });

    const markResult = await result.current({ targetFeed, allAccountFeeds });

    expect(markResult.succeededFeedIds).toHaveLength(3);
    expect(markResult.succeededFeedIds).toContain("feed-1");
    expect(markResult.succeededFeedIds).toContain("feed-2");
    expect(markResult.succeededFeedIds).toContain("feed-3");
    expect(markResult.succeededFeedIds).not.toContain("feed-4");
    expect(markResult.failedFeedIds).toHaveLength(0);

    await waitFor(() => {
      expect(mockMarkFeedRead).toHaveBeenCalledTimes(3);
      expect(mockMarkFeedRead).toHaveBeenCalledWith("feed-1");
      expect(mockMarkFeedRead).toHaveBeenCalledWith("feed-2");
      expect(mockMarkFeedRead).toHaveBeenCalledWith("feed-3");
    });
  });

  it("only marks feeds from the same account", async () => {
    const targetFeed = createTestFeed({ id: "feed-1", account_id: "account-1", site_url: "https://example.com" });
    const allAccountFeeds = [
      targetFeed,
      createTestFeed({ id: "feed-2", account_id: "account-1", site_url: "https://example.com" }),
      createTestFeed({ id: "feed-3", account_id: "account-2", site_url: "https://example.com" }),
    ];

    const mockMarkFeedRead = vi.mocked(tauriCommands.markFeedRead);
    mockMarkFeedRead.mockResolvedValue(Result.succeed([]));

    const { result } = renderHook(() => useMarkSameSiteFeedsRead(), { wrapper });

    const markResult = await result.current({ targetFeed, allAccountFeeds });

    expect(markResult.succeededFeedIds).toHaveLength(2);
    expect(markResult.succeededFeedIds).toContain("feed-1");
    expect(markResult.succeededFeedIds).toContain("feed-2");
    expect(markResult.succeededFeedIds).not.toContain("feed-3");
  });

  it("continues marking feeds even if one fails", async () => {
    const targetFeed = createTestFeed({ id: "feed-1", site_url: "https://example.com" });
    const allAccountFeeds = [
      targetFeed,
      createTestFeed({ id: "feed-2", site_url: "https://example.com" }),
      createTestFeed({ id: "feed-3", site_url: "https://example.com" }),
    ];

    const mockMarkFeedRead = vi.mocked(tauriCommands.markFeedRead);
    mockMarkFeedRead.mockImplementation((feedId) => {
      if (feedId === "feed-2") {
        return Promise.resolve(Result.fail({ type: "UserVisible", message: "Failed" }));
      }
      return Promise.resolve(Result.succeed([]));
    });

    const { result } = renderHook(() => useMarkSameSiteFeedsRead(), { wrapper });

    const markResult = await result.current({ targetFeed, allAccountFeeds });

    expect(markResult.succeededFeedIds).toHaveLength(2);
    expect(markResult.succeededFeedIds).toContain("feed-1");
    expect(markResult.succeededFeedIds).toContain("feed-3");
    expect(markResult.failedFeedIds).toHaveLength(1);
    expect(markResult.failedFeedIds).toContain("feed-2");
    expect(mockMarkFeedRead).toHaveBeenCalledTimes(3);
  });
});
