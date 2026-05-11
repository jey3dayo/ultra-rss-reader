import { Result } from "@praha/byethrow";
import { renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { setPreference } from "@/api/tauri-commands";
import {
  addToHistory,
  getHistory,
  resetCommandHistoryStorageFailureWarnings,
} from "@/components/reader/hooks/command-palette/use-command-history";
import { useSidebarStartupFolderExpansion } from "@/components/reader/hooks/sidebar/use-sidebar-startup-folder-expansion";
import { STORAGE_KEYS } from "@/constants/storage";
import { logRuntimeDiagnostic, resetRuntimeDiagnosticOnceSuppressionForTests } from "@/lib/runtime/diagnostics";
import { resetPreferencesStoreRuntimeForTests, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

vi.mock("@/api/tauri-commands", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/tauri-commands")>()),
  setPreference: vi.fn(async () => Result.succeed(null)),
}));

const folders: FolderDto[] = [{ id: "folder-1", account_id: "acc-1", name: "Folder", sort_order: 0 }];

const feeds: FeedDto[] = [
  {
    id: "feed-1",
    account_id: "acc-1",
    folder_id: "folder-1",
    remote_id: null,
    title: "Feed",
    url: "https://example.com/feed.xml",
    site_url: "https://example.com",
    unread_count: 1,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
];

function renderSidebarExpansionContract() {
  return renderHook(() => {
    const [expandedFolderIds, setExpandedFolderIds] = useState(new Set<string>());
    useSidebarStartupFolderExpansion({
      selectedAccountId: "acc-1",
      expandedFolderIds,
      feedList: feeds,
      folderList: folders,
      startupFolderExpansion: "unread_folders",
      feedsReady: true,
      foldersReady: true,
      setExpandedFolders: (folderIds) => setExpandedFolderIds(new Set(folderIds)),
    });

    return expandedFolderIds;
  });
}

describe("storage quota cascade contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPreferencesStoreRuntimeForTests();
    resetCommandHistoryStorageFailureWarnings();
    resetRuntimeDiagnosticOnceSuppressionForTests();
    usePreferencesStore.setState({
      prefs: {},
      loaded: false,
      pendingPreferenceSaves: 0,
    });
    useUiStore.setState({ toastMessage: null });
    window.localStorage.clear();
    vi.mocked(setPreference).mockResolvedValue(Result.succeed(null));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetPreferencesStoreRuntimeForTests();
    resetCommandHistoryStorageFailureWarnings();
    resetRuntimeDiagnosticOnceSuppressionForTests();
    window.localStorage.clear();
  });

  it("keeps preferences, sidebar expansion, command history, and diagnostics independent when storage quota is exhausted", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const originalSetItem = Storage.prototype.setItem;

    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
      if (
        key === STORAGE_KEYS.theme ||
        key === STORAGE_KEYS.sidebarExpandedFolders ||
        key === STORAGE_KEYS.commandHistory
      ) {
        throw new DOMException("quota exceeded", "QuotaExceededError");
      }

      return Reflect.apply(originalSetItem, window.localStorage, [key, value]);
    });

    expect(() => usePreferencesStore.getState().setPref("theme", "dark")).not.toThrow();
    expect(() => usePreferencesStore.getState().setPref("show_sidebar_unread", "false")).not.toThrow();

    const sidebar = renderSidebarExpansionContract();

    await waitFor(() => {
      expect(sidebar.result.current).toEqual(new Set(["folder-1"]));
    });

    expect(() => addToHistory("feed:feed-1")).not.toThrow();
    expect(getHistory()).toEqual([]);
    expect(() =>
      logRuntimeDiagnostic("sidebar-expanded-folders-storage", "Sidebar expanded folders storage failed", {
        operation: "write",
        storageKey: STORAGE_KEYS.sidebarExpandedFolders,
        error: new DOMException("quota exceeded", "QuotaExceededError"),
      }),
    ).not.toThrow();

    expect(usePreferencesStore.getState().prefs).toMatchObject({
      theme: "dark",
      show_sidebar_unread: "false",
    });
    expect(setPreference).toHaveBeenCalledWith("theme", "dark");
    expect(setPreference).toHaveBeenCalledWith("show_sidebar_unread", "false");
    expect(consoleError).toHaveBeenCalledWith("Failed to mirror theme preference:", expect.any(DOMException));
    expect(consoleWarn).toHaveBeenCalledWith(
      "Sidebar expanded folders storage failed",
      expect.objectContaining({
        operation: "write",
        storageKey: STORAGE_KEYS.sidebarExpandedFolders,
      }),
    );
    expect(consoleWarn).toHaveBeenCalledWith("Failed to write command history to localStorage.", expect.any(Object));
    expect(
      consoleError.mock.calls.filter(([message]) => message === "Failed to mirror theme preference:"),
    ).toHaveLength(1);
    expect(
      consoleWarn.mock.calls.filter(([message]) => message === "Sidebar expanded folders storage failed"),
    ).toHaveLength(1);
    expect(
      consoleWarn.mock.calls.filter(([message]) => message === "Failed to write command history to localStorage."),
    ).toHaveLength(1);
  });
});
