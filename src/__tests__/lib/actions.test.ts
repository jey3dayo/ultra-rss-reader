import { Result } from "@praha/byethrow";
import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import type { AppAction } from "@/lib/actions";
import { keyboardEvents } from "@/lib/keyboard/keyboard-shortcuts";
import { queryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/query-invalidation";
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
        message: "translated:reader:command_palette.restart_app",
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
        message: "translated:reader:command_palette.restart_app",
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
          message: "Database maintenance is unavailable while syncing. Try again after sync completes.",
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
