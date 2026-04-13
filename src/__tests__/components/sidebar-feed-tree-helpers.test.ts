import { describe, expect, it } from "vitest";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { getVisibleSidebarFeedTreeData } from "@/components/reader/sidebar-feed-tree-helpers";

const folders: FolderDto[] = [
  { id: "folder-1", account_id: "acc-1", name: "Folder 1", sort_order: 0 },
  { id: "folder-2", account_id: "acc-1", name: "Folder 2", sort_order: 1 },
];

const feeds: FeedDto[] = [
  {
    id: "feed-a",
    account_id: "acc-1",
    folder_id: "folder-1",
    title: "Feed A",
    url: "https://example.com/a.xml",
    site_url: "https://example.com/a",
    unread_count: 3,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-b",
    account_id: "acc-1",
    folder_id: "folder-1",
    title: "Feed B",
    url: "https://example.com/b.xml",
    site_url: "https://example.com/b",
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-c",
    account_id: "acc-1",
    folder_id: null,
    title: "Feed C",
    url: "https://example.com/c.xml",
    site_url: "https://example.com/c",
    unread_count: 1,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
];

const feedsByFolder = new Map<string, FeedDto[]>([["folder-1", feeds.filter((feed) => feed.folder_id === "folder-1")]]);

describe("getVisibleSidebarFeedTreeData", () => {
  it("builds ordered ids from visible folder and unfoldered feeds", () => {
    const result = getVisibleSidebarFeedTreeData({
      sortedFolderList: folders,
      selectedFolderId: null,
      feedsByFolder,
      unfolderedFeeds: feeds.filter((feed) => feed.folder_id === null),
      getVisibleFeeds: (candidateFeeds) => candidateFeeds.filter((feed) => feed.unread_count > 0),
    });

    expect(result.visibleFolderFeedsById.get("folder-1")?.map((feed) => feed.id)).toEqual(["feed-a"]);
    expect(result.visibleFolderFeedsById.get("folder-2")).toEqual([]);
    expect(result.visibleUnfolderedFeeds.map((feed) => feed.id)).toEqual(["feed-c"]);
    expect(result.orderedFeedIds).toEqual(["feed-a", "feed-c"]);
  });

  it("scopes visibility to the selected folder", () => {
    const result = getVisibleSidebarFeedTreeData({
      sortedFolderList: folders,
      selectedFolderId: "folder-1",
      feedsByFolder,
      unfolderedFeeds: feeds.filter((feed) => feed.folder_id === null),
      getVisibleFeeds: (candidateFeeds) => candidateFeeds,
    });

    expect(result.visibleFolderFeedsById.get("folder-1")?.map((feed) => feed.id)).toEqual(["feed-a", "feed-b"]);
    expect(result.visibleFolderFeedsById.get("folder-2")).toEqual([]);
    expect(result.visibleUnfolderedFeeds).toEqual([]);
    expect(result.orderedFeedIds).toEqual(["feed-a", "feed-b"]);
  });
});
