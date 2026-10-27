import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import { useSameSiteFeedIndex } from "./use-same-site-feed-index";

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

describe("useSameSiteFeedIndex", () => {
  it("groups feeds by normalized host", () => {
    const feeds = [
      createTestFeed({ id: "feed-1", site_url: "https://www.example.com", unread_count: 5 }),
      createTestFeed({ id: "feed-2", site_url: "https://example.com", unread_count: 3 }),
      createTestFeed({ id: "feed-3", site_url: "https://WWW.EXAMPLE.COM", unread_count: 2 }),
      createTestFeed({ id: "feed-4", site_url: "https://other.com", unread_count: 1 }),
    ];

    const { result } = renderHook(() => useSameSiteFeedIndex(feeds));

    expect(result.current.get("example.com")).toEqual({
      feedIds: ["feed-1", "feed-2", "feed-3"],
      unreadCount: 10,
    });
    expect(result.current.get("other.com")).toEqual({
      feedIds: ["feed-4"],
      unreadCount: 1,
    });
  });

  it("uses feed URL as fallback when site_url is empty", () => {
    const feeds = [
      createTestFeed({ id: "feed-1", site_url: "", url: "https://www.example.com/feed", unread_count: 5 }),
      createTestFeed({ id: "feed-2", site_url: "", url: "https://example.com/rss", unread_count: 3 }),
    ];

    const { result } = renderHook(() => useSameSiteFeedIndex(feeds));

    expect(result.current.get("example.com")).toEqual({
      feedIds: ["feed-1", "feed-2"],
      unreadCount: 8,
    });
  });

  it("excludes feeds with no determinable host from the index", () => {
    const feeds = [
      createTestFeed({ id: "feed-1", site_url: "https://example.com", unread_count: 5 }),
      createTestFeed({ id: "feed-2", site_url: "", url: "invalid-url", unread_count: 3 }),
      createTestFeed({ id: "feed-3", site_url: "", url: "also-invalid", unread_count: 2 }),
      createTestFeed({ id: "feed-4", site_url: "https://example.com", unread_count: 7 }),
    ];

    const { result } = renderHook(() => useSameSiteFeedIndex(feeds));

    // Only valid hosts should be in the index
    expect(result.current.get("example.com")).toEqual({
      feedIds: ["feed-1", "feed-4"],
      unreadCount: 12,
    });

    // Null-host feeds should not be grouped together
    expect(result.current.has(null as unknown as string)).toBe(false);
    expect(result.current.size).toBe(1);
  });

  it("returns empty map when feeds is undefined", () => {
    const { result } = renderHook(() => useSameSiteFeedIndex(undefined));

    expect(result.current.size).toBe(0);
  });

  it("returns empty map when feeds array is empty", () => {
    const { result } = renderHook(() => useSameSiteFeedIndex([]));

    expect(result.current.size).toBe(0);
  });

  it("accumulates unread counts correctly", () => {
    const feeds = [
      createTestFeed({ id: "feed-1", site_url: "https://example.com", unread_count: 10 }),
      createTestFeed({ id: "feed-2", site_url: "https://example.com", unread_count: 0 }),
      createTestFeed({ id: "feed-3", site_url: "https://example.com", unread_count: 25 }),
    ];

    const { result } = renderHook(() => useSameSiteFeedIndex(feeds));

    expect(result.current.get("example.com")?.unreadCount).toBe(35);
  });
});
