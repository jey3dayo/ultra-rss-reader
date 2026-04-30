import { describe, expect, it } from "vitest";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import {
  buildSidebarFeedTreeFolders,
  getVisibleSidebarFeeds,
  getVisibleSidebarFeedTreeData,
} from "@/components/reader/sidebar-feed-tree-helpers";

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
  it("sorts feeds before applying the unread filter", () => {
    expect(
      getVisibleSidebarFeeds(feeds, "unread", (candidateFeeds) => [...candidateFeeds].reverse()).map((feed) => feed.id),
    ).toEqual(["feed-c", "feed-a"]);
  });

  it("builds ordered ids from visible folder and unfoldered feeds", () => {
    const result = getVisibleSidebarFeedTreeData({
      sortedFolderList: folders,
      feedsByFolder,
      unfolderedFeeds: feeds.filter((feed) => feed.folder_id === null),
      getVisibleFeeds: (candidateFeeds) => candidateFeeds.filter((feed) => feed.unread_count > 0),
    });

    expect(result.visibleFolderFeedsById.get("folder-1")?.map((feed) => feed.id)).toEqual(["feed-a"]);
    expect(result.visibleFolderFeedsById.get("folder-2")).toEqual([]);
    expect(result.visibleUnfolderedFeeds.map((feed) => feed.id)).toEqual(["feed-c"]);
    expect(result.orderedFeedIds).toEqual(["feed-a", "feed-c"]);
  });

  it("keeps other folders visible when a folder is selected", () => {
    const result = getVisibleSidebarFeedTreeData({
      sortedFolderList: folders,
      feedsByFolder,
      unfolderedFeeds: feeds.filter((feed) => feed.folder_id === null),
      getVisibleFeeds: (candidateFeeds) => candidateFeeds,
    });

    expect(result.visibleFolderFeedsById.get("folder-1")?.map((feed) => feed.id)).toEqual(["feed-a", "feed-b"]);
    expect(result.visibleFolderFeedsById.get("folder-2")).toEqual([]);
    expect(result.visibleUnfolderedFeeds.map((feed) => feed.id)).toEqual(["feed-c"]);
    expect(result.orderedFeedIds).toEqual(["feed-a", "feed-b", "feed-c"]);
  });

  it("keeps folders with visible unread feeds visible even when another folder is selected", () => {
    const result = getVisibleSidebarFeedTreeData({
      sortedFolderList: folders,
      feedsByFolder: new Map([
        ["folder-1", feeds.filter((feed) => feed.folder_id === "folder-1")],
        [
          "folder-2",
          [
            {
              ...feeds[1],
              id: "feed-d",
              folder_id: "folder-2",
              title: "Feed D",
              url: "https://example.com/d.xml",
              site_url: "https://example.com/d",
              unread_count: 2,
            },
          ],
        ],
      ]),
      unfolderedFeeds: feeds.filter((feed) => feed.folder_id === null),
      getVisibleFeeds: (candidateFeeds) => candidateFeeds.filter((feed) => feed.unread_count > 0),
    });

    expect(result.visibleFolderFeedsById.get("folder-1")?.map((feed) => feed.id)).toEqual(["feed-a"]);
    expect(result.visibleFolderFeedsById.get("folder-2")?.map((feed) => feed.id)).toEqual(["feed-d"]);
    expect(result.visibleUnfolderedFeeds.map((feed) => feed.id)).toEqual(["feed-c"]);
    expect(result.orderedFeedIds).toEqual(["feed-a", "feed-d", "feed-c"]);
  });

  it("builds folder view models from raw and visible feed collections", () => {
    const visibleFolderFeedsById = new Map<string, FeedDto[]>([["folder-1", [feeds[0]]]]);

    const folderModels = buildSidebarFeedTreeFolders({
      sortedFolderList: folders,
      feedsByFolder,
      visibleFolderFeedsById,
      expandedFolderIds: new Set(["folder-1"]),
      selectedFolderId: "folder-2",
      selectedFeedId: "feed-a",
      grayscaleFavicons: true,
      hideEmptyFoldersInCurrentView: true,
    });

    expect(folderModels).toMatchObject([
      {
        id: "folder-1",
        unreadCount: 3,
        isExpanded: true,
        isSelected: false,
        feeds: [{ id: "feed-a", isSelected: true, grayscaleFavicon: true }],
      },
      {
        id: "folder-2",
        unreadCount: 0,
        isExpanded: false,
        isSelected: true,
        feeds: [],
      },
    ]);
  });
});
