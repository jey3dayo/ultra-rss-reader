import { describe, expect, it } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import { groupFeedsByFolder, sortFeedsByPreference } from "@/lib/sidebar";

const makeFeed = (overrides: Partial<FeedDto> & { id: string }): FeedDto => ({
  account_id: "acc-1",
  folder_id: null,
  title: "Feed",
  url: "https://example.com/feed.xml",
  site_url: "https://example.com",
  unread_count: 0,
  reader_mode: "on",
  web_preview_mode: "off",
  ...overrides,
});

describe("groupFeedsByFolder", () => {
  it("returns empty map and empty array for empty input", () => {
    const { feedsByFolder, unfolderedFeeds } = groupFeedsByFolder([]);
    expect(feedsByFolder.size).toBe(0);
    expect(unfolderedFeeds).toEqual([]);
  });

  it("puts feeds without folder_id into unfolderedFeeds", () => {
    const feeds = [makeFeed({ id: "f1" }), makeFeed({ id: "f2" })];
    const { feedsByFolder, unfolderedFeeds } = groupFeedsByFolder(feeds);
    expect(feedsByFolder.size).toBe(0);
    expect(unfolderedFeeds).toHaveLength(2);
    expect(unfolderedFeeds.map((f) => f.id)).toEqual(["f1", "f2"]);
  });

  it("groups feeds by folder_id", () => {
    const feeds = [
      makeFeed({ id: "f1", folder_id: "folder-a" }),
      makeFeed({ id: "f2", folder_id: "folder-a" }),
      makeFeed({ id: "f3", folder_id: "folder-b" }),
    ];
    const { feedsByFolder, unfolderedFeeds } = groupFeedsByFolder(feeds);
    expect(unfolderedFeeds).toHaveLength(0);
    expect(feedsByFolder.get("folder-a")).toHaveLength(2);
    expect(feedsByFolder.get("folder-b")).toHaveLength(1);
  });

  it("splits feeds between folders and unfoldered", () => {
    const feeds = [
      makeFeed({ id: "f1", folder_id: "folder-a" }),
      makeFeed({ id: "f2" }),
      makeFeed({ id: "f3", folder_id: "folder-a" }),
    ];
    const { feedsByFolder, unfolderedFeeds } = groupFeedsByFolder(feeds);
    expect(feedsByFolder.get("folder-a")).toHaveLength(2);
    expect(unfolderedFeeds).toHaveLength(1);
    expect(unfolderedFeeds[0].id).toBe("f2");
  });
});

describe("sortFeedsByPreference", () => {
  const feeds = [
    makeFeed({ id: "f1", title: "Zulu" }),
    makeFeed({ id: "f2", title: "Alpha" }),
    makeFeed({ id: "f3", title: "Mike" }),
  ];

  it("sorts alphabetically by title when requested", () => {
    expect(sortFeedsByPreference(feeds, "alphabetical").map((feed) => feed.id)).toEqual(["f2", "f3", "f1"]);
  });

  it("preserves source order for oldest_first instead of mapping to title order", () => {
    expect(sortFeedsByPreference(feeds, "oldest_first").map((feed) => feed.id)).toEqual(["f1", "f2", "f3"]);
  });

  it("reverses source order for newest_first instead of mapping to reverse title order", () => {
    expect(sortFeedsByPreference(feeds, "newest_first").map((feed) => feed.id)).toEqual(["f3", "f2", "f1"]);
  });
});
