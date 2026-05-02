import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { useSidebarFeedTree } from "@/components/reader/use-sidebar-feed-tree";

const folders: FolderDto[] = [
  { id: "folder-z", account_id: "acc-1", name: "Zulu Folder", sort_order: 2 },
  { id: "folder-a", account_id: "acc-1", name: "Alpha Folder", sort_order: 1 },
];

const feeds: FeedDto[] = [
  {
    id: "feed-z-2",
    account_id: "acc-1",
    folder_id: "folder-z",
    title: "Zulu Feed",
    url: "https://example.com/zulu-2.xml",
    site_url: "https://example.com/zulu-2",
    unread_count: 1,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-z-1",
    account_id: "acc-1",
    folder_id: "folder-z",
    title: "Alpha Feed",
    url: "https://example.com/zulu-1.xml",
    site_url: "https://example.com/zulu-1",
    unread_count: 2,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-a-2",
    account_id: "acc-1",
    folder_id: "folder-a",
    title: "Mike Feed",
    url: "https://example.com/alpha-2.xml",
    site_url: "https://example.com/alpha-2",
    unread_count: 3,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-a-1",
    account_id: "acc-1",
    folder_id: "folder-a",
    title: "Bravo Feed",
    url: "https://example.com/alpha-1.xml",
    site_url: "https://example.com/alpha-1",
    unread_count: 4,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-u-2",
    account_id: "acc-1",
    folder_id: null,
    title: "Charlie Feed",
    url: "https://example.com/unfoldered-2.xml",
    site_url: "https://example.com/unfoldered-2",
    unread_count: 5,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-u-1",
    account_id: "acc-1",
    folder_id: null,
    title: "Delta Feed",
    url: "https://example.com/unfoldered-1.xml",
    site_url: "https://example.com/unfoldered-1",
    unread_count: 6,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
];

describe("useSidebarFeedTree", () => {
  it("keeps folders and feeds alphabetical regardless of the subscription sort preference", () => {
    const { result } = renderHook(() =>
      useSidebarFeedTree({
        feeds,
        folders,
        selection: { type: "all" },
        viewMode: "all",
        expandedFolderIds: new Set(["folder-a", "folder-z"]),
        sortSubscriptions: "newest_first",
        grayscaleFavicons: false,
        draggedFeedId: null,
      }),
    );

    expect(result.current.sortedFolderList.map((folder) => folder.id)).toEqual(["folder-a", "folder-z"]);
    expect(result.current.feedTreeFolders.map((folder) => folder.id)).toEqual(["folder-a", "folder-z"]);
    expect(result.current.feedTreeFolders[0]?.feeds.map((feed) => feed.id)).toEqual(["feed-a-1", "feed-a-2"]);
    expect(result.current.feedTreeFolders[1]?.feeds.map((feed) => feed.id)).toEqual(["feed-z-1", "feed-z-2"]);
    expect(result.current.unfolderedFeedViews.map((feed) => feed.id)).toEqual(["feed-u-2", "feed-u-1"]);
  });

  it("shows only unread feeds and folders in unread view", () => {
    const { result } = renderHook(() =>
      useSidebarFeedTree({
        feeds: feeds.map((feed) =>
          feed.id === "feed-a-2" || feed.id === "feed-z-2" || feed.id === "feed-u-1"
            ? { ...feed, unread_count: 0 }
            : feed,
        ),
        folders,
        selection: { type: "all" },
        viewMode: "unread",
        expandedFolderIds: new Set(["folder-a", "folder-z"]),
        sortSubscriptions: "alphabetical",
        grayscaleFavicons: false,
        draggedFeedId: null,
      }),
    );

    expect(result.current.feedTreeFolders.map((folder) => folder.id)).toEqual(["folder-a", "folder-z"]);
    expect(result.current.feedTreeFolders[0]?.feeds.map((feed) => feed.id)).toEqual(["feed-a-1"]);
    expect(result.current.feedTreeFolders[1]?.feeds.map((feed) => feed.id)).toEqual(["feed-z-1"]);
    expect(result.current.unfolderedFeedViews.map((feed) => feed.id)).toEqual(["feed-u-2"]);
  });

  it("shows starred feed counts and visible feed counts for folders in starred view", () => {
    const { result } = renderHook(() =>
      useSidebarFeedTree({
        feeds,
        folders,
        selection: { type: "all" },
        viewMode: "starred",
        expandedFolderIds: new Set(["folder-a", "folder-z"]),
        sortSubscriptions: "alphabetical",
        grayscaleFavicons: false,
        draggedFeedId: null,
        starredCountByFeedId: new Map([
          ["feed-a-2", 2],
          ["feed-u-1", 1],
        ]),
      }),
    );

    expect(result.current.feedTreeFolders.map((folder) => folder.id)).toEqual(["folder-a"]);
    expect(result.current.feedTreeFolders[0]?.unreadCount).toBe(1);
    expect(result.current.feedTreeFolders[0]?.feeds.map((feed) => feed.id)).toEqual(["feed-a-2"]);
    expect(result.current.feedTreeFolders[0]?.feeds[0]?.unreadCount).toBe(2);
    expect(result.current.unfolderedFeedViews.map((feed) => feed.id)).toEqual(["feed-u-1"]);
    expect(result.current.unfolderedFeedViews[0]?.unreadCount).toBe(1);
  });

  it("keeps starred feeds visible even when they have no unread articles", () => {
    const { result } = renderHook(() =>
      useSidebarFeedTree({
        feeds: feeds.map((feed) => (feed.id === "feed-a-2" ? { ...feed, unread_count: 0 } : feed)),
        folders,
        selection: { type: "all" },
        viewMode: "starred",
        expandedFolderIds: new Set(["folder-a"]),
        sortSubscriptions: "alphabetical",
        grayscaleFavicons: false,
        draggedFeedId: null,
        starredCountByFeedId: new Map([["feed-a-2", 1]]),
      }),
    );

    expect(result.current.feedTreeFolders.map((folder) => folder.id)).toEqual(["folder-a"]);
    expect(result.current.feedTreeFolders[0]?.feeds.map((feed) => feed.id)).toEqual(["feed-a-2"]);
    expect(result.current.feedTreeFolders[0]?.feeds[0]?.unreadCount).toBe(1);
  });
});
