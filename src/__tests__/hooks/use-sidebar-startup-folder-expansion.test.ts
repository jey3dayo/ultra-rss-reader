import { renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import {
  resolveSidebarStartupExpandedFolderIds,
  useSidebarStartupFolderExpansion,
} from "@/components/reader/hooks/sidebar/use-sidebar-startup-folder-expansion";
import { STORAGE_KEYS } from "@/constants/storage";

const folders: FolderDto[] = [
  { id: "folder-unread", account_id: "acc-1", name: "Unread", sort_order: 0 },
  { id: "folder-read", account_id: "acc-1", name: "Read", sort_order: 1 },
  { id: "folder-restored", account_id: "acc-1", name: "Restored", sort_order: 2 },
  { id: "folder-acc-2", account_id: "acc-2", name: "Second Account", sort_order: 3 },
];

const makeFeed = (overrides: Partial<FeedDto>): FeedDto => ({
  id: "feed-1",
  account_id: "acc-1",
  folder_id: null,
  remote_id: null,
  title: "Feed",
  url: "https://example.com/feed.xml",
  site_url: "https://example.com",
  unread_count: 0,
  reader_mode: "inherit",
  web_preview_mode: "inherit",
  ...overrides,
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("resolveSidebarStartupExpandedFolderIds", () => {
  it("expands only valid folders that contain unread feeds", () => {
    const result = resolveSidebarStartupExpandedFolderIds({
      startupFolderExpansion: "unread_folders",
      folderList: folders,
      feedList: [
        makeFeed({ id: "feed-unread", folder_id: "folder-unread", unread_count: 2 }),
        makeFeed({ id: "feed-read", folder_id: "folder-read", unread_count: 0 }),
        makeFeed({ id: "feed-missing-folder", folder_id: "folder-missing", unread_count: 3 }),
        makeFeed({ id: "feed-unfoldered", folder_id: null, unread_count: 4 }),
      ],
    });

    expect(result).toEqual(new Set(["folder-unread"]));
  });

  it("restores user-triggered folder expansion separately from unread startup candidates", () => {
    const result = resolveSidebarStartupExpandedFolderIds({
      startupFolderExpansion: "restore_previous",
      folderList: folders,
      feedList: [makeFeed({ id: "feed-unread", folder_id: "folder-unread", unread_count: 2 })],
      storedFolderIds: ["folder-restored", "folder-missing", "folder-restored"],
    });

    expect(result).toEqual(new Set(["folder-restored"]));
  });

  it("keeps all folders collapsed for the collapsed startup policy", () => {
    const result = resolveSidebarStartupExpandedFolderIds({
      startupFolderExpansion: "all_collapsed",
      folderList: folders,
      feedList: [makeFeed({ id: "feed-unread", folder_id: "folder-unread", unread_count: 2 })],
      storedFolderIds: ["folder-restored"],
    });

    expect(result).toEqual(new Set());
  });
});

describe("useSidebarStartupFolderExpansion", () => {
  it("expands unread folders on startup", async () => {
    const { result } = renderHook(() => {
      const [expandedFolderIds, setExpandedFolderIds] = useState(new Set<string>());
      useSidebarStartupFolderExpansion({
        selectedAccountId: "acc-1",
        expandedFolderIds,
        feedList: [makeFeed({ id: "feed-unread", folder_id: "folder-unread", unread_count: 2 })],
        folderList: folders,
        startupFolderExpansion: "unread_folders",
        feedsReady: true,
        foldersReady: true,
        setExpandedFolders: (folderIds) => setExpandedFolderIds(new Set(folderIds)),
      });

      return expandedFolderIds;
    });

    await waitFor(() => {
      expect(result.current).toEqual(new Set(["folder-unread"]));
    });
  });

  it("does not reopen an unread folder after the user has manually changed expansion", async () => {
    const { result } = renderHook(() => {
      const [expandedFolderIds, setExpandedFolderIds] = useState(new Set(["folder-read"]));
      useSidebarStartupFolderExpansion({
        selectedAccountId: "acc-1",
        expandedFolderIds,
        feedList: [makeFeed({ id: "feed-unread", folder_id: "folder-unread", unread_count: 2 })],
        folderList: folders,
        startupFolderExpansion: "unread_folders",
        feedsReady: true,
        foldersReady: true,
        setExpandedFolders: (folderIds) => setExpandedFolderIds(new Set(folderIds)),
      });

      return expandedFolderIds;
    });

    await waitFor(() => {
      expect(result.current).toEqual(new Set(["folder-read"]));
    });
  });

  it("restores expansion for the selected account after an account switch", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.sidebarExpandedFolders,
      JSON.stringify({
        "acc-1": ["folder-restored"],
        "acc-2": ["folder-acc-2"],
      }),
    );

    const { result, rerender } = renderHook(
      ({ selectedAccountId }: { selectedAccountId: string }) => {
        const [expandedFolderIds, setExpandedFolderIds] = useState(new Set<string>());
        useSidebarStartupFolderExpansion({
          selectedAccountId,
          expandedFolderIds,
          feedList: [],
          folderList: folders,
          startupFolderExpansion: "restore_previous",
          feedsReady: true,
          foldersReady: true,
          setExpandedFolders: (folderIds) => setExpandedFolderIds(new Set(folderIds)),
        });

        return expandedFolderIds;
      },
      { initialProps: { selectedAccountId: "acc-1" } },
    );

    await waitFor(() => {
      expect(result.current).toEqual(new Set(["folder-restored"]));
    });

    rerender({ selectedAccountId: "acc-2" });

    await waitFor(() => {
      expect(result.current).toEqual(new Set(["folder-acc-2"]));
    });
  });

  it("keeps UI expansion state when localStorage persistence fails", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });

    const { result } = renderHook(() => {
      const [expandedFolderIds, setExpandedFolderIds] = useState(new Set<string>());
      useSidebarStartupFolderExpansion({
        selectedAccountId: "acc-1",
        expandedFolderIds,
        feedList: [makeFeed({ id: "feed-unread", folder_id: "folder-unread", unread_count: 2 })],
        folderList: folders,
        startupFolderExpansion: "unread_folders",
        feedsReady: true,
        foldersReady: true,
        setExpandedFolders: (folderIds) => setExpandedFolderIds(new Set(folderIds)),
      });

      return expandedFolderIds;
    });

    await waitFor(() => {
      expect(result.current).toEqual(new Set(["folder-unread"]));
    });
  });
});
