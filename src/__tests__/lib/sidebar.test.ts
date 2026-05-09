import { sampleArticles } from "@tests/helpers/fixtures";
import { describe, expect, it } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import {
  buildStarredCountByFeedId,
  countFeedsInFolder,
  countUnreadFeedsInFolder,
  groupFeedsByFolder,
  sortFeedsByPreference,
  sumUnreadCounts,
} from "@/lib/sidebar/sidebar";
import { buildSidebarSmartViews } from "@/lib/sidebar/sidebar-smart-views";

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
  ...overrides,
});

const sampleArticle = sampleArticles[0];

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

  it("treats blank folder ids as unfoldered", () => {
    const feeds = [
      makeFeed({ id: "f1", folder_id: "" }),
      makeFeed({ id: "f2", folder_id: "   " }),
      makeFeed({ id: "f3", folder_id: " folder-a " }),
    ];
    const { feedsByFolder, unfolderedFeeds } = groupFeedsByFolder(feeds);

    expect(unfolderedFeeds.map((feed) => feed.id)).toEqual(["f1", "f2"]);
    expect(feedsByFolder.get("folder-a")?.map((feed) => feed.id)).toEqual(["f3"]);
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

  it("does not reorder the caller-owned feeds array", () => {
    const originalOrder = feeds.map((feed) => feed.id);

    sortFeedsByPreference(feeds, "alphabetical");

    expect(feeds.map((feed) => feed.id)).toEqual(originalOrder);
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
    expect(countFeedsInFolder(feeds, " folder-a ")).toBe(2);
    expect(countFeedsInFolder(feeds, "folder-missing")).toBe(0);
    expect(countFeedsInFolder([makeFeed({ id: "blank", folder_id: " " })], " ")).toBe(0);
    expect(countFeedsInFolder(undefined, "folder-a")).toBe(0);
  });

  it("sums unread feeds in a folder", () => {
    expect(countUnreadFeedsInFolder(feeds, "folder-a")).toBe(7);
    expect(countUnreadFeedsInFolder(feeds, " folder-a ")).toBe(7);
    expect(countUnreadFeedsInFolder(feeds, "folder-missing")).toBe(0);
    expect(countUnreadFeedsInFolder([makeFeed({ id: "blank", folder_id: " ", unread_count: 9 })], " ")).toBe(0);
    expect(countUnreadFeedsInFolder(undefined, "folder-a")).toBe(0);
  });

  it("keeps blank folder ids unfoldered when counting a real folder", () => {
    const mixedFeeds = [
      makeFeed({ id: "f1", folder_id: "folder-a", unread_count: 3 }),
      makeFeed({ id: "f2", folder_id: "", unread_count: 5 }),
      makeFeed({ id: "f3", folder_id: "   ", unread_count: 7 }),
      makeFeed({ id: "f4", folder_id: " folder-a ", unread_count: 11 }),
    ];

    expect(countFeedsInFolder(mixedFeeds, "folder-a")).toBe(2);
    expect(countUnreadFeedsInFolder(mixedFeeds, "folder-a")).toBe(14);
  });

  it("sums unread counts without filtering by folder", () => {
    expect(sumUnreadCounts(feeds)).toBe(18);
    expect(sumUnreadCounts(undefined)).toBe(0);
  });
});

describe("buildStarredCountByFeedId", () => {
  it("counts only starred articles by feed id", () => {
    const counts = buildStarredCountByFeedId([
      { ...sampleArticle, id: "art-1", feed_id: "feed-a", is_starred: true },
      { ...sampleArticle, id: "art-2", feed_id: "feed-a", is_starred: false },
      { ...sampleArticle, id: "art-3", feed_id: "feed-a", is_starred: true },
      { ...sampleArticle, id: "art-4", feed_id: "feed-b", is_starred: true },
    ]);

    expect(counts).toEqual(
      new Map([
        ["feed-a", 2],
        ["feed-b", 1],
      ]),
    );
  });

  it("omits starred articles with blank feed ids", () => {
    const counts = buildStarredCountByFeedId([
      { ...sampleArticle, id: "art-1", feed_id: "", is_starred: true },
      { ...sampleArticle, id: "art-2", feed_id: "   ", is_starred: true },
      { ...sampleArticle, id: "art-3", feed_id: "feed-a", is_starred: true },
      { ...sampleArticle, id: "art-4", feed_id: "feed-a", is_starred: true },
    ]);

    expect(counts).toEqual(new Map([["feed-a", 2]]));
  });

  it("returns an empty count map when articles are unavailable", () => {
    expect(buildStarredCountByFeedId(undefined)).toEqual(new Map());
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

  it("marks the selected smart view and hides a zero starred count", () => {
    const views = buildSidebarSmartViews({
      selectedSmartViewKind: "starred",
      totalUnread: 7,
      starredCount: 0,
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

    expect(views).toEqual([
      {
        kind: "unread",
        label: "Unread",
        count: 7,
        showCount: true,
        isSelected: false,
      },
      {
        kind: "starred",
        label: "Starred",
        count: 0,
        showCount: false,
        isSelected: true,
      },
      {
        kind: "recent",
        label: "Recently viewed",
        count: 0,
        showCount: false,
        isSelected: false,
      },
    ]);
  });

  it("projects the unread smart view count from the provided total unread source", () => {
    const views = buildSidebarSmartViews({
      selectedSmartViewKind: "unread",
      totalUnread: 11,
      starredCount: 3,
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

    expect(views.find((view) => view.kind === "unread")).toEqual({
      kind: "unread",
      label: "Unread",
      count: 11,
      showCount: true,
      isSelected: true,
    });
  });
});
