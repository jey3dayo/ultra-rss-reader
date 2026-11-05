import { Result } from "@praha/byethrow";
import { waitFor } from "@testing-library/react";
import { createSampleFeeds } from "@tests/helpers/fixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import type { AppAction } from "@/lib/actions";
import { keyboardEvents } from "@/lib/keyboard/keyboard-shortcuts";
import { queryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/query-invalidation";
import { TAGS_QUERY_KEY } from "@/lib/query/query-keys";
import { getVisibleSidebarFeeds } from "@/lib/sidebar/sidebar-feed-tree";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const { triggerSyncMock, i18nTMock, isWindowFullscreenMock, setWindowFullscreenMock } = vi.hoisted(() => ({
  triggerSyncMock: vi.fn(),
  i18nTMock: vi.fn((key: string, options?: Record<string, string>) => {
    if (options?.accounts) {
      return `translated:${key}:${options.accounts}`;
    }
    if (options?.message) {
      return `translated:${key}:${options.message}`;
    }
    return `translated:${key}`;
  }),
  isWindowFullscreenMock: vi.fn(),
  setWindowFullscreenMock: vi.fn(),
}));

const runManualUpdateCheckMock = vi.fn();
const restartAppMock = vi.fn();
const performUpdateCheckMock = vi.fn();
const reloadBrowserWebviewMock = vi.fn<() => Promise<Result.Result<BrowserWebviewState, never>>>(async () =>
  Result.succeed({
    url: "https://example.com/article",
    can_go_back: false,
    can_go_forward: false,
    is_loading: false,
    load_generation: 1,
  }),
);
const goBackBrowserWebviewMock = vi.fn<() => Promise<Result.Result<BrowserWebviewState, never>>>(async () =>
  Result.succeed({
    url: "https://example.com/article",
    can_go_back: true,
    can_go_forward: false,
    is_loading: false,
    load_generation: 1,
  }),
);
const goForwardBrowserWebviewMock = vi.fn<() => Promise<Result.Result<BrowserWebviewState, never>>>(async () =>
  Result.succeed({
    url: "https://example.com/article",
    can_go_back: true,
    can_go_forward: false,
    is_loading: false,
    load_generation: 1,
  }),
);

function stubWindowLocationReload(reload: Location["reload"]) {
  const location: Location = {
    ...window.location,
    reload,
  };
  return vi.spyOn(window, "location", "get").mockReturnValue(location);
}

vi.mock("@/api/tauri-commands", () => ({
  goBackBrowserWebview: goBackBrowserWebviewMock,
  goForwardBrowserWebview: goForwardBrowserWebviewMock,
  reloadBrowserWebview: reloadBrowserWebviewMock,
  restartApp: restartAppMock,
  triggerSync: triggerSyncMock,
  listAccounts: vi.fn(async () => Result.succeed([])),
}));

vi.mock("@/lib/i18n", () => ({
  default: {
    t: i18nTMock,
  },
}));

vi.mock("@/hooks/use-updater", () => ({
  runManualUpdateCheck: runManualUpdateCheckMock,
  performUpdateCheck: performUpdateCheckMock,
}));

vi.mock("@/lib/window/tauri-window", () => ({
  isWindowFullscreen: isWindowFullscreenMock,
  setWindowFullscreen: setWindowFullscreenMock,
}));

// Mock preferences store
vi.mock("@/stores/preferences-store", () => {
  const prefs: Record<string, string> = {};
  const setPref = vi.fn((key: string, value: string) => {
    prefs[key] = value;
  });
  return {
    usePreferencesStore: {
      getState: () => ({ prefs, setPref }),
    },
  };
});

// Dynamic import of actions after mocks are set up
let executeAction: (action: AppAction) => void;

beforeEach(async () => {
  useUiStore.setState(useUiStore.getInitialState());
  runManualUpdateCheckMock.mockReset();
  runManualUpdateCheckMock.mockResolvedValue(undefined);
  restartAppMock.mockReset();
  restartAppMock.mockResolvedValue(Result.succeed(null));
  performUpdateCheckMock.mockReset();
  i18nTMock.mockClear();
  triggerSyncMock.mockReset();
  triggerSyncMock.mockResolvedValue(
    Result.succeed({
      synced: true,
      total: 1,
      succeeded: 1,
      failed: [],
      warnings: [],
    }),
  );
  isWindowFullscreenMock.mockReset();
  isWindowFullscreenMock.mockResolvedValue(Result.succeed(false));
  setWindowFullscreenMock.mockReset();
  setWindowFullscreenMock.mockResolvedValue(Result.succeed(undefined));
  const { resetManualSyncCooldownForTests } = await import("@/lib/sync/manual-sync");
  resetManualSyncCooldownForTests();
  const mod = await import("@/lib/actions");
  executeAction = mod.executeAction;
});

afterEach(() => {
  vi.restoreAllMocks();
  reloadBrowserWebviewMock.mockClear();
  goBackBrowserWebviewMock.mockClear();
  goForwardBrowserWebviewMock.mockClear();
  queryClient.clear();
});

describe("executeAction", () => {
  describe("development actions", () => {
    it("asks for confirmation before reloading the current window in dev builds", async () => {
      vi.stubEnv("DEV", true);
      const reloadSpy = vi.fn();
      stubWindowLocationReload(reloadSpy);

      executeAction("restart-app");

      expect(reloadSpy).not.toHaveBeenCalled();
      expect(useUiStore.getState().confirmDialog).toMatchObject({
        open: true,
        message: "translated:reader:confirm_restart_app",
        actionLabel: "translated:reader:command_palette.restart_app",
        variant: "warning",
      });

      await useUiStore.getState().confirmDialog.onConfirm?.();

      await waitFor(() => {
        expect(reloadSpy).toHaveBeenCalledTimes(1);
      });
      expect(restartAppMock).not.toHaveBeenCalled();
    });

    it("asks for confirmation before calling the native restart outside dev builds", async () => {
      vi.stubEnv("DEV", false);
      const reloadSpy = vi.fn();
      stubWindowLocationReload(reloadSpy);

      executeAction("restart-app");

      expect(restartAppMock).not.toHaveBeenCalled();
      expect(useUiStore.getState().confirmDialog).toMatchObject({
        open: true,
        message: "translated:reader:confirm_restart_app",
        actionLabel: "translated:reader:command_palette.restart_app",
        variant: "warning",
      });

      await useUiStore.getState().confirmDialog.onConfirm?.();

      await waitFor(() => {
        expect(restartAppMock).toHaveBeenCalledTimes(1);
      });
      expect(reloadSpy).not.toHaveBeenCalled();
    });

    it("surfaces native restart guard failures to the user", async () => {
      vi.stubEnv("DEV", false);
      restartAppMock.mockResolvedValueOnce(
        Result.fail({
          type: "UserVisible",
          message: "Database maintenance is unavailable while syncing. Try again after sync completes.",
        }),
      );

      executeAction("restart-app");
      await useUiStore.getState().confirmDialog.onConfirm?.();

      await waitFor(() => {
        expect(useUiStore.getState().toastMessage).toEqual({
          message: "translated:errors.database_maintenance_busy",
          severity: "error",
          persistent: true,
        });
      });
    });
  });

  describe("article navigation actions", () => {
    it("clears the selected article and focuses the list target for mouse-back outside browser mode", async () => {
      document.body.innerHTML = '<div data-article-id="art-1" tabindex="-1"></div>';
      useUiStore.setState({
        ...useUiStore.getInitialState(),
        selectedArticleId: "art-1",
        contentMode: "reader",
        focusedPane: "content",
      });

      executeAction("mouse-back");

      await waitFor(() => {
        expect(useUiStore.getState().selectedArticleId).toBeNull();
        expect(useUiStore.getState().contentMode).toBe("empty");
        expect(useUiStore.getState().focusedPane).toBe("list");
        expect(document.activeElement).toHaveAttribute("data-article-id", "art-1");
      });
    });

    it("focuses the selected sidebar target for mouse-back from the article list", async () => {
      document.body.innerHTML = '<button data-sidebar-selected-target="true" data-feed-id="feed-1">Feed</button>';
      useUiStore.setState({
        ...useUiStore.getInitialState(),
        selection: { type: "feed", feedId: "feed-1" },
        focusedPane: "list",
      });

      executeAction("mouse-back");

      await waitFor(() => {
        expect(useUiStore.getState().selection).toEqual({
          type: "feed",
          feedId: "feed-1",
        });
        expect(useUiStore.getState().focusedPane).toBe("sidebar");
        expect(document.activeElement).toHaveAttribute("data-feed-id", "feed-1");
      });
    });

    it("goes back to the containing folder for mouse-back when a folder feed is selected", async () => {
      document.body.innerHTML = '<button data-sidebar-selected-target="true" data-feed-id="folder-1">Folder</button>';
      queryClient.setQueryData(queryKeys.feeds.byAccount("acc-1"), [
        { id: "feed-1", account_id: "acc-1", folder_id: "folder-1" },
      ]);
      useUiStore.setState({
        ...useUiStore.getInitialState(),
        selectedAccountId: "acc-1",
        selection: { type: "feed", feedId: "feed-1" },
        focusedPane: "list",
      });

      executeAction("mouse-back");

      await waitFor(() => {
        expect(useUiStore.getState().selection).toEqual({
          type: "folder",
          folderId: "folder-1",
        });
        expect(useUiStore.getState().focusedPane).toBe("sidebar");
      });
    });

    it("falls back to focusing the sidebar for mouse-back when the selected feed has no folder", async () => {
      document.body.innerHTML = '<button data-sidebar-selected-target="true" data-feed-id="feed-1">Feed</button>';
      queryClient.setQueryData(queryKeys.feeds.byAccount("acc-1"), [
        { id: "feed-1", account_id: "acc-1", folder_id: null },
      ]);
      useUiStore.setState({
        ...useUiStore.getInitialState(),
        selectedAccountId: "acc-1",
        selection: { type: "feed", feedId: "feed-1" },
        focusedPane: "list",
      });

      executeAction("mouse-back");

      await waitFor(() => {
        expect(useUiStore.getState().selection).toEqual({
          type: "feed",
          feedId: "feed-1",
        });
        expect(useUiStore.getState().focusedPane).toBe("sidebar");
      });
    });
  });

  describe("selection history for mouse back / forward", () => {
    function seedFeeds(feedIds: string[]) {
      queryClient.setQueryData(
        queryKeys.feeds.byAccount("acc-1"),
        feedIds.map((id) => ({ id, account_id: "acc-1", folder_id: "folder-1" })),
      );
    }

    function startInAccount() {
      useUiStore.setState({ ...useUiStore.getInitialState(), selectedAccountId: "acc-1", focusedPane: "list" });
    }

    it("goes back to the feed that dropped out of the unread sidebar, then forward again", () => {
      seedFeeds(["feed-a", "feed-b"]);
      startInAccount();
      useUiStore.getState().selectFeed("feed-a");
      useUiStore.getState().selectFeed("feed-b");

      executeAction("mouse-back");

      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-a" });
      expect(useUiStore.getState().focusedPane).toBe("sidebar");
      expect(useUiStore.getState().expandedFolderIds.has("folder-1")).toBe(true);

      executeAction("mouse-forward");

      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-b" });
    });

    it("does not record history entries while stepping back and forward", () => {
      seedFeeds(["feed-a", "feed-b"]);
      startInAccount();
      useUiStore.getState().selectFeed("feed-a");
      useUiStore.getState().selectFeed("feed-b");

      executeAction("mouse-back");
      executeAction("mouse-back");
      expect(useUiStore.getState().selection).toEqual({ type: "all" });
      executeAction("mouse-forward");
      executeAction("mouse-forward");

      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-b" });
      expect(useUiStore.getState().selectionHistory.entries).toHaveLength(3);
    });

    it("drops the forward side when a new selection is made after going back", () => {
      seedFeeds(["feed-a", "feed-b", "feed-c"]);
      startInAccount();
      useUiStore.getState().selectFeed("feed-a");
      useUiStore.getState().selectFeed("feed-b");
      executeAction("mouse-back");
      useUiStore.getState().selectFeed("feed-c");

      executeAction("mouse-forward");

      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-c" });
    });

    it("restores non-feed selections such as smart views and tags", () => {
      startInAccount();
      useUiStore.getState().selectSmartView("starred");
      useUiStore.getState().selectTag("tag-1");

      executeAction("mouse-back");

      expect(useUiStore.getState().selection).toEqual({ type: "smart", kind: "starred" });
      expect(useUiStore.getState().viewMode).toBe("starred");
    });

    it("closes the open article first and keeps the selection history untouched", () => {
      seedFeeds(["feed-a", "feed-b"]);
      startInAccount();
      useUiStore.getState().selectFeed("feed-a");
      useUiStore.getState().selectFeed("feed-b");
      useUiStore.getState().selectArticle("art-1");

      executeAction("mouse-back");

      expect(useUiStore.getState().selectedArticleId).toBeNull();
      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-b" });

      executeAction("mouse-back");

      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-a" });
    });

    it("skips history entries whose feed was deleted", () => {
      seedFeeds(["feed-a", "feed-b"]);
      startInAccount();
      useUiStore.getState().selectFeed("feed-a");
      useUiStore.getState().selectFeed("feed-b");
      seedFeeds(["feed-b"]);

      executeAction("mouse-back");

      expect(useUiStore.getState().selection).toEqual({ type: "all" });
    });

    it("shows the feed that was read down to zero unread in the unread sidebar after going back", () => {
      const [template] = createSampleFeeds();
      if (!template) {
        throw new Error("sample feed fixture is empty");
      }
      const feeds = [
        { ...template, id: "feed-a", account_id: "acc-1", folder_id: "folder-1", unread_count: 0 },
        { ...template, id: "feed-b", account_id: "acc-1", folder_id: "folder-1", unread_count: 3 },
      ];
      const visibleFeedIds = (selectedFeedId: string | null) =>
        getVisibleSidebarFeeds(feeds, "unread", (list) => list, selectedFeedId).map((feed) => feed.id);
      queryClient.setQueryData(queryKeys.feeds.byAccount("acc-1"), feeds);
      startInAccount();
      useUiStore.getState().selectFeed("feed-a");
      useUiStore.getState().selectFeed("feed-b");
      expect(visibleFeedIds("feed-b")).toEqual(["feed-b"]);

      executeAction("mouse-back");

      const { selection } = useUiStore.getState();
      expect(visibleFeedIds(selection.type === "feed" ? selection.feedId : null)).toEqual(["feed-a", "feed-b"]);
    });

    it("reopens the collapsed sidebar section that holds the restored selection", () => {
      seedFeeds(["feed-a", "feed-b"]);
      startInAccount();
      useUiStore.getState().selectFeed("feed-a");
      useUiStore.getState().selectTag("tag-1");
      useUiStore.getState().selectFeed("feed-b");
      useUiStore.getState().setIsFeedsSectionOpen(false);
      useUiStore.getState().setIsTagsSectionOpen(false);

      executeAction("mouse-back");

      expect(useUiStore.getState().selection).toEqual({ type: "tag", tagId: "tag-1" });
      expect(useUiStore.getState().isTagsSectionOpen).toBe(true);

      executeAction("mouse-back");

      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-a" });
      expect(useUiStore.getState().isFeedsSectionOpen).toBe(true);
    });

    it("skips smart views hidden by sidebar preferences", () => {
      const { prefs } = usePreferencesStore.getState();
      prefs.show_sidebar_starred = "false";
      try {
        startInAccount();
        useUiStore.getState().selectSmartView("starred");
        useUiStore.getState().selectSmartView("recent");

        executeAction("mouse-back");

        expect(useUiStore.getState().selection).toEqual({ type: "all" });
      } finally {
        delete prefs.show_sidebar_starred;
      }
    });

    it("never restores a deleted tag, even while the cached tag list is still stale", () => {
      queryClient.setQueryData(TAGS_QUERY_KEY, [
        { id: "tag-1", name: "one" },
        { id: "tag-2", name: "two" },
      ]);
      startInAccount();
      useUiStore.getState().selectTag("tag-1");
      useUiStore.getState().selectTag("tag-2");

      useUiStore.getState().handleTagDeleted("tag-1");
      executeAction("mouse-back");

      expect(useUiStore.getState().selection).toEqual({ type: "all" });
    });

    it("skips history entries whose folder was deleted", () => {
      queryClient.setQueryData([...queryKeys.folders.root, "acc-1"], [{ id: "folder-2", account_id: "acc-1" }]);
      startInAccount();
      useUiStore.getState().selectFolder("folder-1");
      useUiStore.getState().selectFolder("folder-2");

      executeAction("mouse-back");

      expect(useUiStore.getState().selection).toEqual({ type: "all" });
    });

    it("falls back to the parent folder when there is no earlier selection to return to", () => {
      seedFeeds(["feed-a"]);
      useUiStore.setState({
        ...useUiStore.getInitialState(),
        selectedAccountId: "acc-1",
        selection: { type: "feed", feedId: "feed-a" },
        selectionHistory: { entries: [{ type: "feed", feedId: "feed-a" }], index: 0 },
        focusedPane: "list",
      });

      executeAction("mouse-back");

      expect(useUiStore.getState().selection).toEqual({ type: "folder", folderId: "folder-1" });
    });

    it("clears the history when the account changes", () => {
      seedFeeds(["feed-a"]);
      startInAccount();
      useUiStore.getState().selectFeed("feed-a");

      useUiStore.getState().selectAccount("acc-2");
      executeAction("mouse-back");

      expect(useUiStore.getState().selection).toEqual({ type: "all" });
      expect(useUiStore.getState().selectionHistory.entries).toEqual([{ type: "all" }]);
    });

    it("keeps at most 50 entries", () => {
      startInAccount();
      for (let index = 0; index < 60; index += 1) {
        useUiStore.getState().selectFeed(`feed-${index}`);
      }

      const { entries, index } = useUiStore.getState().selectionHistory;

      expect(entries).toHaveLength(50);
      expect(entries[index]).toEqual({ type: "feed", feedId: "feed-59" });
    });
  });

  describe("placeholder actions", () => {
    it("routes mouse-back to native browser back when history is available", async () => {
      useUiStore.setState({
        ...useUiStore.getInitialState(),
        contentMode: "browser",
        browserUrl: "https://example.com/article",
        browserNavigationState: { canGoBack: true, canGoForward: false },
      });

      executeAction("mouse-back");

      await waitFor(() => {
        expect(goBackBrowserWebviewMock).toHaveBeenCalledTimes(1);
      });
    });

    it("closes browser mode when native back reports the history edge", async () => {
      goBackBrowserWebviewMock.mockResolvedValueOnce(
        Result.succeed({
          url: "https://example.com/article",
          can_go_back: false,
          can_go_forward: true,
          is_loading: false,
          load_generation: 1,
        } satisfies BrowserWebviewState),
      );
      useUiStore.setState({
        ...useUiStore.getInitialState(),
        selectedArticleId: "art-1",
        contentMode: "browser",
        browserUrl: "https://example.com/article",
        browserNavigationState: { canGoBack: true, canGoForward: false },
      });
      const handler = vi.fn();
      window.addEventListener(keyboardEvents.closeBrowserOverlay, handler);

      executeAction("mouse-back");

      await waitFor(() => {
        expect(handler).toHaveBeenCalledTimes(1);
      });
      expect(useUiStore.getState().browserNavigationState).toEqual({
        canGoBack: false,
        canGoForward: true,
      });

      window.removeEventListener(keyboardEvents.closeBrowserOverlay, handler);
    });

    it("routes mouse-forward to native browser forward when history is available", async () => {
      useUiStore.setState({
        ...useUiStore.getInitialState(),
        contentMode: "browser",
        browserUrl: "https://example.com/article",
        browserNavigationState: { canGoBack: true, canGoForward: true },
      });

      executeAction("mouse-forward");

      await waitFor(() => {
        expect(goForwardBrowserWebviewMock).toHaveBeenCalledTimes(1);
      });
    });

    it("treats mouse-back like browser close when no browser history is available", () => {
      useUiStore.setState({
        ...useUiStore.getInitialState(),
        selectedArticleId: "art-1",
        contentMode: "browser",
        browserUrl: "https://example.com/article",
        browserNavigationState: { canGoBack: false, canGoForward: false },
      });
      const handler = vi.fn();
      window.addEventListener(keyboardEvents.closeBrowserOverlay, handler);

      executeAction("mouse-back");

      expect(handler).toHaveBeenCalledTimes(1);
      expect(goBackBrowserWebviewMock).not.toHaveBeenCalled();

      window.removeEventListener(keyboardEvents.closeBrowserOverlay, handler);
    });
  });
});
