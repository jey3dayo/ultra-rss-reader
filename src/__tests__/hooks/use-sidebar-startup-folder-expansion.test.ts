import { renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import {
  resolveSidebarStartupExpandedFolderIds,
  useSidebarStartupFolderExpansion,
} from "@/components/reader/hooks/sidebar/use-sidebar-startup-folder-expansion";
import {
  MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS,
  MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT,
  MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_STORAGE_LENGTH,
  SIDEBAR_EXPANDED_FOLDERS_STORAGE_VERSION,
  STORAGE_KEYS,
} from "@/constants/storage";

const folders: FolderDto[] = [
  { id: "folder-unread", account_id: "acc-1", name: "Unread", sort_order: 0 },
  { id: "folder-read", account_id: "acc-1", name: "Read", sort_order: 1 },
  {
    id: "folder-restored",
    account_id: "acc-1",
    name: "Restored",
    sort_order: 2,
  },
  {
    id: "folder-acc-2",
    account_id: "acc-2",
    name: "Second Account",
    sort_order: 3,
  },
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

const readStoredExpansion = (): unknown =>
  JSON.parse(window.localStorage.getItem(STORAGE_KEYS.sidebarExpandedFolders) ?? "{}");

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
        makeFeed({
          id: "feed-unread",
          folder_id: "folder-unread",
          unread_count: 2,
        }),
        makeFeed({
          id: "feed-read",
          folder_id: "folder-read",
          unread_count: 0,
        }),
        makeFeed({
          id: "feed-missing-folder",
          folder_id: "folder-missing",
          unread_count: 3,
        }),
        makeFeed({ id: "feed-unfoldered", folder_id: null, unread_count: 4 }),
      ],
    });

    expect(result).toEqual(new Set(["folder-unread"]));
  });

  it("restores user-triggered folder expansion separately from unread startup candidates", () => {
    const result = resolveSidebarStartupExpandedFolderIds({
      startupFolderExpansion: "restore_previous",
      folderList: folders,
      feedList: [
        makeFeed({
          id: "feed-unread",
          folder_id: "folder-unread",
          unread_count: 2,
        }),
      ],
      storedFolderIds: ["folder-restored", "folder-missing", "folder-restored"],
    });

    expect(result).toEqual(new Set(["folder-restored"]));
  });

  it("uses unread startup candidates separately from restored user folder toggles", () => {
    const result = resolveSidebarStartupExpandedFolderIds({
      startupFolderExpansion: "unread_folders",
      folderList: folders,
      feedList: [
        makeFeed({
          id: "feed-unread",
          folder_id: "folder-unread",
          unread_count: 2,
        }),
      ],
      storedFolderIds: ["folder-restored"],
    });

    expect(result).toEqual(new Set(["folder-unread"]));
  });

  it("uses the provided feed filter as the unread startup candidate boundary", () => {
    const result = resolveSidebarStartupExpandedFolderIds({
      startupFolderExpansion: "unread_folders",
      folderList: folders,
      feedList: [
        makeFeed({
          id: "feed-read",
          folder_id: "folder-read",
          unread_count: 1,
        }),
      ],
    });

    expect(result).toEqual(new Set(["folder-read"]));
  });

  it("does not expand unread folders that are outside the provided feed filter", () => {
    const result = resolveSidebarStartupExpandedFolderIds({
      startupFolderExpansion: "unread_folders",
      folderList: folders,
      feedList: [
        makeFeed({
          id: "feed-read",
          folder_id: "folder-read",
          unread_count: 0,
        }),
      ],
    });

    expect(result).toEqual(new Set());
  });

  it("keeps all folders collapsed for the collapsed startup policy", () => {
    const result = resolveSidebarStartupExpandedFolderIds({
      startupFolderExpansion: "all_collapsed",
      folderList: folders,
      feedList: [
        makeFeed({
          id: "feed-unread",
          folder_id: "folder-unread",
          unread_count: 2,
        }),
      ],
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
        feedList: [
          makeFeed({
            id: "feed-unread",
            folder_id: "folder-unread",
            unread_count: 2,
          }),
        ],
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

  it("waits for last selected account feeds and folders before applying startup expansion", async () => {
    const { result, rerender } = renderHook(
      ({ feedsReady, foldersReady }: { feedsReady: boolean; foldersReady: boolean }) => {
        const [expandedFolderIds, setExpandedFolderIds] = useState(new Set<string>());
        useSidebarStartupFolderExpansion({
          selectedAccountId: "acc-1",
          expandedFolderIds,
          feedList: feedsReady
            ? [
                makeFeed({
                  id: "feed-unread",
                  folder_id: "folder-unread",
                  unread_count: 2,
                }),
              ]
            : [],
          folderList: foldersReady ? folders : [],
          startupFolderExpansion: "unread_folders",
          feedsReady,
          foldersReady,
          setExpandedFolders: (folderIds) => setExpandedFolderIds(new Set(folderIds)),
        });

        return expandedFolderIds;
      },
      { initialProps: { feedsReady: false, foldersReady: false } },
    );

    expect(result.current).toEqual(new Set());

    rerender({ feedsReady: true, foldersReady: true });

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
        feedList: [
          makeFeed({
            id: "feed-unread",
            folder_id: "folder-unread",
            unread_count: 2,
          }),
        ],
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

  it("does not persist startup restore before user-triggered folder toggles", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.sidebarExpandedFolders,
      JSON.stringify({
        "acc-1": ["folder-restored"],
      }),
    );

    const { result, rerender } = renderHook(
      ({ expandedFolderIds }: { expandedFolderIds: Set<string> }) => {
        useSidebarStartupFolderExpansion({
          selectedAccountId: "acc-1",
          expandedFolderIds,
          feedList: [],
          folderList: folders,
          startupFolderExpansion: "restore_previous",
          feedsReady: true,
          foldersReady: true,
          setExpandedFolders: vi.fn(),
        });

        return expandedFolderIds;
      },
      { initialProps: { expandedFolderIds: new Set<string>() } },
    );

    await waitFor(() => {
      expect(result.current).toEqual(new Set());
    });
    expect(readStoredExpansion()).toEqual({
      version: SIDEBAR_EXPANDED_FOLDERS_STORAGE_VERSION,
      accounts: {
        "acc-1": ["folder-restored"],
      },
    });

    rerender({ expandedFolderIds: new Set(["folder-read"]) });

    await waitFor(() => {
      expect(readStoredExpansion()).toEqual({
        version: SIDEBAR_EXPANDED_FOLDERS_STORAGE_VERSION,
        accounts: {
          "acc-1": ["folder-read"],
        },
      });
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
        feedList: [
          makeFeed({
            id: "feed-unread",
            folder_id: "folder-unread",
            unread_count: 2,
          }),
        ],
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

  it("keeps the UI usable when localStorage reads are unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("storage unavailable", "SecurityError");
    });

    const { result } = renderHook(() => {
      const [expandedFolderIds, setExpandedFolderIds] = useState(new Set<string>());
      useSidebarStartupFolderExpansion({
        selectedAccountId: "acc-1",
        expandedFolderIds,
        feedList: [],
        folderList: folders,
        startupFolderExpansion: "restore_previous",
        feedsReady: true,
        foldersReady: true,
        setExpandedFolders: (folderIds) => setExpandedFolderIds(new Set(folderIds)),
      });

      return expandedFolderIds;
    });

    await waitFor(() => {
      expect(result.current).toEqual(new Set());
    });
  });

  it("prunes oversized sidebar expansion storage on write", async () => {
    const folderIds = Array.from(
      { length: MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_PER_ACCOUNT + 5 },
      (_, index) => `folder-${index}`,
    );
    const storedEntries = Array.from(
      { length: MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS + 5 },
      (_, index): [string, string[]] => [`stale-account-${index}`, folderIds],
    );
    window.localStorage.setItem(STORAGE_KEYS.sidebarExpandedFolders, JSON.stringify(Object.fromEntries(storedEntries)));

    const { rerender } = renderHook(
      ({ expandedFolderIds }: { expandedFolderIds: Set<string> }) => {
        useSidebarStartupFolderExpansion({
          selectedAccountId: "stale-account-0",
          expandedFolderIds,
          feedList: [],
          folderList: folders,
          startupFolderExpansion: "unread_folders",
          feedsReady: true,
          foldersReady: true,
          setExpandedFolders: vi.fn(),
        });
      },
      { initialProps: { expandedFolderIds: new Set<string>() } },
    );

    rerender({ expandedFolderIds: new Set(folderIds) });

    await waitFor(() => {
      const stored = readStoredExpansion();

      expect(stored).toEqual({
        version: SIDEBAR_EXPANDED_FOLDERS_STORAGE_VERSION,
        accounts: {},
      });
    });
  });

  it("migrates legacy account folder maps to the versioned storage contract", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.sidebarExpandedFolders,
      JSON.stringify({
        "acc-1": ["folder-restored", "", null, "folder-missing", "folder-restored"],
        "acc-2": "folder-acc-2",
      }),
    );

    const { result } = renderHook(() => {
      const [expandedFolderIds, setExpandedFolderIds] = useState(new Set<string>());
      useSidebarStartupFolderExpansion({
        selectedAccountId: "acc-1",
        expandedFolderIds,
        feedList: [],
        folderList: folders,
        startupFolderExpansion: "restore_previous",
        feedsReady: true,
        foldersReady: true,
        setExpandedFolders: (folderIds) => setExpandedFolderIds(new Set(folderIds)),
      });

      return expandedFolderIds;
    });

    await waitFor(() => {
      expect(result.current).toEqual(new Set(["folder-restored"]));
    });
    expect(readStoredExpansion()).toEqual({
      version: SIDEBAR_EXPANDED_FOLDERS_STORAGE_VERSION,
      accounts: {
        "acc-1": ["folder-restored"],
      },
    });
  });

  it("cleans corrupted sidebar expansion storage before restoring folders", async () => {
    window.localStorage.setItem(STORAGE_KEYS.sidebarExpandedFolders, "not-json");

    const { result } = renderHook(() => {
      const [expandedFolderIds, setExpandedFolderIds] = useState(new Set<string>());
      useSidebarStartupFolderExpansion({
        selectedAccountId: "acc-1",
        expandedFolderIds,
        feedList: [],
        folderList: folders,
        startupFolderExpansion: "restore_previous",
        feedsReady: true,
        foldersReady: true,
        setExpandedFolders: (folderIds) => setExpandedFolderIds(new Set(folderIds)),
      });

      return expandedFolderIds;
    });

    await waitFor(() => {
      expect(result.current).toEqual(new Set());
    });
    expect(readStoredExpansion()).toEqual({
      version: SIDEBAR_EXPANDED_FOLDERS_STORAGE_VERSION,
      accounts: {},
    });
  });

  it("cleans oversized raw sidebar expansion storage before parsing it", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.sidebarExpandedFolders,
      `"${"x".repeat(MAX_STORED_SIDEBAR_EXPANDED_FOLDERS_STORAGE_LENGTH + 1)}"`,
    );

    const { result } = renderHook(() => {
      const [expandedFolderIds, setExpandedFolderIds] = useState(new Set<string>());
      useSidebarStartupFolderExpansion({
        selectedAccountId: "acc-1",
        expandedFolderIds,
        feedList: [],
        folderList: folders,
        startupFolderExpansion: "restore_previous",
        feedsReady: true,
        foldersReady: true,
        setExpandedFolders: (folderIds) => setExpandedFolderIds(new Set(folderIds)),
      });

      return expandedFolderIds;
    });

    await waitFor(() => {
      expect(result.current).toEqual(new Set());
    });
    expect(readStoredExpansion()).toEqual({
      version: SIDEBAR_EXPANDED_FOLDERS_STORAGE_VERSION,
      accounts: {},
    });
  });

  it("keeps the active account inside oversized sidebar expansion storage", async () => {
    const storedEntries = Array.from(
      { length: MAX_STORED_SIDEBAR_EXPANDED_ACCOUNTS },
      (_, index): [string, string[]] => [`stale-account-${index}`, [`stale-folder-${index}`]],
    );
    window.localStorage.setItem(STORAGE_KEYS.sidebarExpandedFolders, JSON.stringify(Object.fromEntries(storedEntries)));

    const { rerender } = renderHook(
      ({ expandedFolderIds }: { expandedFolderIds: Set<string> }) => {
        useSidebarStartupFolderExpansion({
          selectedAccountId: "acc-new",
          expandedFolderIds,
          feedList: [],
          folderList: folders,
          startupFolderExpansion: "unread_folders",
          feedsReady: true,
          foldersReady: true,
          setExpandedFolders: vi.fn(),
        });
      },
      { initialProps: { expandedFolderIds: new Set<string>() } },
    );

    rerender({ expandedFolderIds: new Set(["folder-restored"]) });

    await waitFor(() => {
      const stored = readStoredExpansion();

      expect(stored).toEqual({
        version: SIDEBAR_EXPANDED_FOLDERS_STORAGE_VERSION,
        accounts: {},
      });
    });
  });

  it("prunes missing accounts and missing folders from versioned storage", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.sidebarExpandedFolders,
      JSON.stringify({
        version: SIDEBAR_EXPANDED_FOLDERS_STORAGE_VERSION,
        accounts: {
          "acc-1": ["folder-restored", "folder-missing", "folder-acc-2"],
          "acc-missing": ["folder-restored"],
        },
      }),
    );

    const { result } = renderHook(() => {
      const [expandedFolderIds, setExpandedFolderIds] = useState(new Set<string>());
      useSidebarStartupFolderExpansion({
        selectedAccountId: "acc-1",
        expandedFolderIds,
        feedList: [],
        folderList: folders,
        startupFolderExpansion: "restore_previous",
        feedsReady: true,
        foldersReady: true,
        setExpandedFolders: (folderIds) => setExpandedFolderIds(new Set(folderIds)),
      });

      return expandedFolderIds;
    });

    await waitFor(() => {
      expect(result.current).toEqual(new Set(["folder-restored"]));
    });
    expect(readStoredExpansion()).toEqual({
      version: SIDEBAR_EXPANDED_FOLDERS_STORAGE_VERSION,
      accounts: {
        "acc-1": ["folder-restored"],
      },
    });
  });
});
