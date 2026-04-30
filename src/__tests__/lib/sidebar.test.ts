import { describe, expect, it } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import { countFeedsInFolder, countUnreadFeedsInFolder, groupFeedsByFolder, sortFeedsByPreference } from "@/lib/sidebar";
import { buildSidebarSmartViews } from "@/lib/sidebar-smart-views";

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

  it("keeps feeds alphabetical even when the preference is oldest_first", () => {
    expect(sortFeedsByPreference(feeds, "oldest_first").map((feed) => feed.id)).toEqual(["f2", "f3", "f1"]);
  });

  it("keeps feeds alphabetical even when the preference is newest_first", () => {
    expect(sortFeedsByPreference(feeds, "newest_first").map((feed) => feed.id)).toEqual(["f2", "f3", "f1"]);
  });
});

describe("folder feed counts", () => {
  const feeds = [
    makeFeed({ id: "f1", folder_id: "folder-a", unread_count: 3 }),
    makeFeed({ id: "f2", folder_id: "folder-a", unread_count: 4 }),
    makeFeed({ id: "f3", folder_id: "folder-b", unread_count: 9 }),
    makeFeed({ id: "f4", folder_id: null, unread_count: 2 }),
  ];

  it("counts feeds in a folder", () => {
    expect(countFeedsInFolder(feeds, "folder-a")).toBe(2);
    expect(countFeedsInFolder(feeds, "folder-missing")).toBe(0);
    expect(countFeedsInFolder(undefined, "folder-a")).toBe(0);
  });

  it("sums unread feeds in a folder", () => {
    expect(countUnreadFeedsInFolder(feeds, "folder-a")).toBe(7);
    expect(countUnreadFeedsInFolder(feeds, "folder-missing")).toBe(0);
    expect(countUnreadFeedsInFolder(undefined, "folder-a")).toBe(0);
  });
});

describe("buildSidebarSmartViews", () => {
  it("places recently viewed articles below unread and starred when enabled", () => {
    const views = buildSidebarSmartViews({
      selectedSmartViewKind: null,
      totalUnread: 7,
      starredCount: 2,
      showUnreadCount: true,
      showStarredCount: true,
      showSidebarUnread: true,
      showSidebarStarred: true,
      showSidebarRecentArticles: true,
      labels: {
        unread: "Unread",
        starred: "Starred",
        recent: "Recently viewed",
      },
    });

    expect(views.map((view) => view.kind)).toEqual(["unread", "starred", "recent"]);
  });

  it("hides recently viewed articles when the sidebar preference is disabled", () => {
    const views = buildSidebarSmartViews({
      selectedSmartViewKind: null,
      totalUnread: 7,
      starredCount: 2,
      showUnreadCount: true,
      showStarredCount: true,
      showSidebarUnread: true,
      showSidebarStarred: true,
      showSidebarRecentArticles: false,
      labels: {
        unread: "Unread",
        starred: "Starred",
        recent: "Recently viewed",
      },
    });

    expect(views.map((view) => view.kind)).toEqual(["unread", "starred"]);
  });
});
