import { Result } from "@praha/byethrow";
import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { APP_EVENTS } from "@/constants/events";
import type { AppAction } from "@/lib/actions";
import { keyboardEvents } from "@/lib/keyboard-shortcuts";
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
const showUpdateAvailableToastMock = vi.fn();
const reloadBrowserWebviewMock = vi.fn<() => Promise<Result.Result<BrowserWebviewState, never>>>(async () =>
  Result.succeed({
    url: "https://example.com/article",
    can_go_back: false,
    can_go_forward: false,
    is_loading: false,
  }),
);
const goBackBrowserWebviewMock = vi.fn<() => Promise<Result.Result<BrowserWebviewState, never>>>(async () =>
  Result.succeed({
    url: "https://example.com/article",
    can_go_back: true,
    can_go_forward: false,
    is_loading: false,
  }),
);
const goForwardBrowserWebviewMock = vi.fn<() => Promise<Result.Result<BrowserWebviewState, never>>>(async () =>
  Result.succeed({
    url: "https://example.com/article",
    can_go_back: true,
    can_go_forward: false,
    is_loading: false,
  }),
);

function expectCustomEvent<T>(value: unknown): asserts value is CustomEvent<T> {
  expect(value).toBeInstanceOf(CustomEvent);
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
  showUpdateAvailableToast: showUpdateAvailableToastMock,
}));

vi.mock("@/lib/windows", () => ({
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
let isAppAction: (value: unknown) => value is AppAction;
let flushPendingBrowserCloseAction: () => void;

beforeEach(async () => {
  useUiStore.setState(useUiStore.getInitialState());
  runManualUpdateCheckMock.mockReset();
  restartAppMock.mockReset();
  restartAppMock.mockResolvedValue(Result.succeed(null));
  performUpdateCheckMock.mockReset();
  showUpdateAvailableToastMock.mockReset();
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
  const { resetManualSyncCooldownForTests } = await import("@/lib/manual-sync");
  resetManualSyncCooldownForTests();
  const mod = await import("@/lib/actions");
  executeAction = mod.executeAction;
  isAppAction = mod.isAppAction;
  flushPendingBrowserCloseAction = mod.flushPendingBrowserCloseAction;
});

afterEach(() => {
  vi.restoreAllMocks();
  reloadBrowserWebviewMock.mockClear();
  goBackBrowserWebviewMock.mockClear();
  goForwardBrowserWebviewMock.mockClear();
});

describe("executeAction", () => {
  describe("view filter actions", () => {
    it("sets view mode to unread", () => {
      executeAction("set-filter-unread");
      expect(useUiStore.getState().viewMode).toBe("unread");
    });

    it("sets view mode to all", () => {
      // First set to unread, then back to all
      executeAction("set-filter-unread");
      executeAction("set-filter-all");
      expect(useUiStore.getState().viewMode).toBe("all");
    });

    it("sets view mode to starred", () => {
      executeAction("set-filter-starred");
      expect(useUiStore.getState().viewMode).toBe("starred");
    });
  });

  describe("settings and dialog actions", () => {
    it("opens settings", () => {
      executeAction("open-settings");
      expect(useUiStore.getState().settingsOpen).toBe(true);
    });

    it("opens current account settings when an account is selected", () => {
      useUiStore.setState({ selectedAccountId: "acc-1" });

      executeAction("open-current-account-settings");

      expect(useUiStore.getState().settingsOpen).toBe(true);
      expect(useUiStore.getState().settingsCategory).toBe("accounts");
      expect(useUiStore.getState().settingsAccountId).toBe("acc-1");
      expect(useUiStore.getState().settingsAddAccount).toBe(false);
    });

    it("opens the accounts settings category when no account is selected", () => {
      useUiStore.setState({ selectedAccountId: null });

      executeAction("open-current-account-settings");

      expect(useUiStore.getState().settingsOpen).toBe(true);
      expect(useUiStore.getState().settingsCategory).toBe("accounts");
      expect(useUiStore.getState().settingsAccountId).toBeNull();
      expect(useUiStore.getState().settingsAddAccount).toBe(false);
    });

    it("opens settings at accounts tab", () => {
      executeAction("open-settings-accounts");
      expect(useUiStore.getState().settingsOpen).toBe(true);
      expect(useUiStore.getState().settingsCategory).toBe("accounts");
    });

    it("opens settings at accounts tab with add account form", () => {
      executeAction("open-settings-accounts-add");
      expect(useUiStore.getState().settingsOpen).toBe(true);
      expect(useUiStore.getState().settingsCategory).toBe("accounts");
      expect(useUiStore.getState().settingsAddAccount).toBe(true);
      expect(useUiStore.getState().settingsAddAccountInitialKind).toBeNull();
    });

    it("opens settings at the FreshRSS config form for account debugging", () => {
      executeAction("open-settings-accounts-add-freshrss");
      expect(useUiStore.getState().settingsOpen).toBe(true);
      expect(useUiStore.getState().settingsCategory).toBe("accounts");
      expect(useUiStore.getState().settingsAddAccount).toBe(true);
      expect(useUiStore.getState().settingsAddAccountInitialKind).toBe("FreshRss");
    });

    it("opens add feed dialog", () => {
      executeAction("open-add-feed");
      expect(useUiStore.getState().isAddFeedDialogOpen).toBe(true);
    });

    it("opens the subscriptions index workspace", () => {
      executeAction("open-subscriptions-index");
      expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
        kind: "index",
      });
      expect(useUiStore.getState().focusedPane).toBe("content");
    });
  });

  describe("command palette actions", () => {
    it("toggles commandPaletteOpen when opening the command palette", () => {
      expect(useUiStore.getState().commandPaletteOpen).toBe(false);

      executeAction("open-command-palette");

      expect(useUiStore.getState().commandPaletteOpen).toBe(true);
    });
  });

  describe("development actions", () => {
    it("reloads the current window instead of calling the native app restart in dev builds", async () => {
      vi.stubEnv("DEV", true);
      const reloadSpy = vi.fn();
      vi.spyOn(window, "location", "get").mockReturnValue({
        ...window.location,
        reload: reloadSpy,
      } as Location);

      executeAction("restart-app");

      await waitFor(() => {
        expect(reloadSpy).toHaveBeenCalledTimes(1);
      });
      expect(restartAppMock).not.toHaveBeenCalled();
    });

    it("does not restart the app outside dev builds", async () => {
      vi.stubEnv("DEV", false);
      const reloadSpy = vi.fn();
      vi.spyOn(window, "location", "get").mockReturnValue({
        ...window.location,
        reload: reloadSpy,
      } as Location);

      executeAction("restart-app");

      await waitFor(() => {
        expect(restartAppMock).not.toHaveBeenCalled();
      });
      expect(reloadSpy).not.toHaveBeenCalled();
    });
  });

  describe("article navigation actions", () => {
    it("dispatches navigate-article event with direction -1 for prev-article", () => {
      const handler = vi.fn();
      window.addEventListener(APP_EVENTS.navigateArticle, handler);

      executeAction("prev-article");

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0]?.[0];
      expectCustomEvent<number>(event);
      expect(event.detail).toBe(-1);

      window.removeEventListener(APP_EVENTS.navigateArticle, handler);
    });

    it("dispatches navigate-article event with direction 1 for next-article", () => {
      const handler = vi.fn();
      window.addEventListener(APP_EVENTS.navigateArticle, handler);

      executeAction("next-article");

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0]?.[0];
      expectCustomEvent<number>(event);
      expect(event.detail).toBe(1);

      window.removeEventListener(APP_EVENTS.navigateArticle, handler);
    });

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
        expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
        expect(useUiStore.getState().focusedPane).toBe("sidebar");
        expect(document.activeElement).toHaveAttribute("data-feed-id", "feed-1");
      });
    });

    it("buffers article navigation while browser close is in flight and flushes it later", () => {
      const handler = vi.fn();
      window.addEventListener(APP_EVENTS.navigateArticle, handler);
      useUiStore.setState({ browserCloseInFlight: true, pendingBrowserCloseAction: null });

      executeAction("next-article");

      expect(handler).not.toHaveBeenCalled();
      expect(useUiStore.getState().pendingBrowserCloseAction).toBe("next-article");

      flushPendingBrowserCloseAction();

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0]?.[0];
      expectCustomEvent<number>(event);
      expect(event.detail).toBe(1);
      expect(useUiStore.getState().pendingBrowserCloseAction).toBeNull();
      expect(useUiStore.getState().browserCloseInFlight).toBe(false);

      window.removeEventListener(APP_EVENTS.navigateArticle, handler);
    });
  });

  describe("article action events", () => {
    it("emits toggle-star event", () => {
      const handler = vi.fn();
      window.addEventListener(keyboardEvents.toggleStar, handler);

      executeAction("toggle-star");

      expect(handler).toHaveBeenCalledTimes(1);

      window.removeEventListener(keyboardEvents.toggleStar, handler);
    });

    it("emits toggle-read event", () => {
      const handler = vi.fn();
      window.addEventListener(keyboardEvents.toggleRead, handler);

      executeAction("toggle-read");

      expect(handler).toHaveBeenCalledTimes(1);

      window.removeEventListener(keyboardEvents.toggleRead, handler);
    });

    it("emits mark-all-read event", () => {
      const handler = vi.fn();
      window.addEventListener(keyboardEvents.markAllRead, handler);

      executeAction("mark-all-read");

      expect(handler).toHaveBeenCalledTimes(1);

      window.removeEventListener(keyboardEvents.markAllRead, handler);
    });

    it("emits open-in-app-browser event for open-in-reader", () => {
      const handler = vi.fn();
      window.addEventListener(keyboardEvents.openInAppBrowser, handler);

      executeAction("open-in-reader");

      expect(handler).toHaveBeenCalledTimes(1);

      window.removeEventListener(keyboardEvents.openInAppBrowser, handler);
    });

    it("emits open-external-browser event for open-in-browser", () => {
      const handler = vi.fn();
      window.addEventListener(keyboardEvents.openExternalBrowser, handler);

      executeAction("open-in-browser");

      expect(handler).toHaveBeenCalledTimes(1);

      window.removeEventListener(keyboardEvents.openExternalBrowser, handler);
    });
  });

  describe("preference toggle actions", () => {
    it("toggles reading_sort preference", async () => {
      const { usePreferencesStore } = vi.mocked(await import("@/stores/preferences-store"));
      const { setPref } = usePreferencesStore.getState();
      vi.mocked(setPref).mockClear();

      executeAction("toggle-sort-unread");

      expect(setPref).toHaveBeenCalledWith("reading_sort", "oldest_first");
    });

    it("toggles group_by preference", async () => {
      const { usePreferencesStore } = vi.mocked(await import("@/stores/preferences-store"));
      const { setPref } = usePreferencesStore.getState();

      executeAction("toggle-group-by-feed");

      expect(setPref).toHaveBeenCalled();
    });

    it("sets theme to dark", async () => {
      const { usePreferencesStore } = vi.mocked(await import("@/stores/preferences-store"));
      const { setPref } = usePreferencesStore.getState();

      executeAction("set-theme-dark");

      expect(setPref).toHaveBeenCalledWith("theme", "dark");
    });

    it("toggles fullscreen through Result-based window helpers", async () => {
      executeAction("toggle-fullscreen");

      await waitFor(() => {
        expect(isWindowFullscreenMock).toHaveBeenCalledOnce();
        expect(setWindowFullscreenMock).toHaveBeenCalledWith(true);
      });
    });
  });

  describe("placeholder actions", () => {
    it("reuses reloadBrowserWebview for reload-webview", () => {
      executeAction("reload-webview");

      expect(reloadBrowserWebviewMock).toHaveBeenCalledTimes(1);
    });

    it("closes browser mode for close-browser", () => {
      useUiStore.setState({
        ...useUiStore.getInitialState(),
        selectedArticleId: "art-1",
        contentMode: "browser",
        browserUrl: "https://example.com/article",
      });
      const handler = vi.fn();
      window.addEventListener(keyboardEvents.closeBrowserOverlay, handler);

      executeAction("close-browser");

      expect(handler).toHaveBeenCalledTimes(1);
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/article");

      window.removeEventListener(keyboardEvents.closeBrowserOverlay, handler);
    });

    it("falls back to closing browser-only mode directly for close-browser", () => {
      useUiStore.setState({
        ...useUiStore.getInitialState(),
        contentMode: "browser",
        browserUrl: "https://example.com/article",
      });

      executeAction("close-browser");

      expect(useUiStore.getState().contentMode).toBe("empty");
      expect(useUiStore.getState().browserUrl).toBeNull();
    });

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

    it("does not throw for copy-link", () => {
      expect(() => executeAction("copy-link")).not.toThrow();
    });

    it("does not throw for open-in-default-browser", () => {
      expect(() => executeAction("open-in-default-browser")).not.toThrow();
    });

    it("does not throw for add-to-reading-list", () => {
      expect(() => executeAction("add-to-reading-list")).not.toThrow();
    });

    it("reuses the shared manual update-check helper for check-for-updates", () => {
      executeAction("check-for-updates");

      expect(runManualUpdateCheckMock).toHaveBeenCalledTimes(1);
      expect(performUpdateCheckMock).not.toHaveBeenCalled();
      expect(showUpdateAvailableToastMock).not.toHaveBeenCalled();
    });
  });

  describe("sync-all", () => {
    it("uses the translated already-in-progress toast", async () => {
      triggerSyncMock.mockResolvedValueOnce(
        Result.succeed({
          synced: false,
          total: 0,
          succeeded: 0,
          failed: [],
          warnings: [],
        }),
      );

      executeAction("sync-all");

      await waitFor(() => {
        expect(useUiStore.getState().toastMessage).toEqual({
          message: "translated:sidebar:sync_already_in_progress",
        });
      });

      expect(i18nTMock).toHaveBeenCalledWith("sidebar:sync_already_in_progress");
    });

    it("uses the translated cooldown toast and skips the second sync during cooldown", async () => {
      executeAction("sync-all");

      await waitFor(() => {
        expect(triggerSyncMock).toHaveBeenCalledTimes(1);
      });

      executeAction("sync-all");

      await waitFor(() => {
        expect(useUiStore.getState().toastMessage).toEqual({
          message: "translated:sidebar:sync_cooldown_active",
        });
      });

      expect(triggerSyncMock).toHaveBeenCalledTimes(1);
      expect(i18nTMock).toHaveBeenCalledWith("sidebar:sync_cooldown_active");
    });

    it("uses the translated partial-failure toast with account names", async () => {
      triggerSyncMock.mockResolvedValueOnce(
        Result.succeed({
          synced: true,
          total: 2,
          succeeded: 1,
          failed: [{ account_name: "Local" }],
          warnings: [],
        }),
      );

      executeAction("sync-all");

      await waitFor(() => {
        expect(useUiStore.getState().toastMessage).toEqual({
          message: "translated:sidebar:sync_partial_failure:Local",
        });
      });

      expect(i18nTMock).toHaveBeenCalledWith("sidebar:sync_partial_failure", {
        accounts: "Local",
      });
    });

    it("uses the translated success toast", async () => {
      triggerSyncMock.mockResolvedValueOnce(
        Result.succeed({
          synced: true,
          total: 1,
          succeeded: 1,
          failed: [],
          warnings: [],
        }),
      );

      executeAction("sync-all");

      await waitFor(() => {
        expect(useUiStore.getState().toastMessage).toEqual({
          message: "translated:sidebar:sync_completed",
        });
      });

      expect(i18nTMock).toHaveBeenCalledWith("sidebar:sync_completed");
    });

    it("uses the translated warning toast when sync completes with anomalies", async () => {
      triggerSyncMock.mockResolvedValueOnce(
        Result.succeed({
          synced: true,
          total: 1,
          succeeded: 1,
          failed: [],
          warnings: [{ account_id: "acc-2", account_name: "FreshRSS", message: "Skipped 3 entries." }],
        }),
      );

      executeAction("sync-all");

      await waitFor(() => {
        expect(useUiStore.getState().toastMessage).toEqual({
          message: "translated:sidebar:sync_completed_with_warnings:FreshRSS",
        });
      });

      expect(i18nTMock).toHaveBeenCalledWith("sidebar:sync_completed_with_warnings", {
        accounts: "FreshRSS",
      });
    });

    it("uses the translated retry-pending toast when sync queues a retry", async () => {
      triggerSyncMock.mockResolvedValueOnce(
        Result.succeed({
          synced: true,
          total: 1,
          succeeded: 1,
          failed: [],
          warnings: [
            {
              account_id: "acc-2",
              account_name: "FreshRSS",
              message: "Local change will retry on the next sync.",
              kind: "retry_pending",
            },
          ],
        }),
      );

      executeAction("sync-all");

      await waitFor(() => {
        expect(useUiStore.getState().toastMessage).toEqual({
          message: "translated:sidebar:sync_completed_with_retry_pending:FreshRSS",
        });
      });

      expect(i18nTMock).toHaveBeenCalledWith("sidebar:sync_completed_with_retry_pending", {
        accounts: "FreshRSS",
      });
    });

    it("uses the translated unexpected-error toast with details", async () => {
      triggerSyncMock.mockResolvedValueOnce(Result.fail({ type: "UserVisible", message: "boom" }));

      executeAction("sync-all");

      await waitFor(() => {
        expect(useUiStore.getState().toastMessage).toEqual({
          message: "translated:sidebar:sync_failed_with_message:boom",
        });
      });

      expect(i18nTMock).toHaveBeenCalledWith("sidebar:sync_failed_with_message", {
        message: "boom",
      });
    });
  });

  describe("isAppAction", () => {
    it("returns true for valid actions", () => {
      expect(isAppAction("open-settings")).toBe(true);
      expect(isAppAction("sync-all")).toBe(true);
      expect(isAppAction("close-browser")).toBe(true);
      expect(isAppAction("mouse-back")).toBe(true);
      expect(isAppAction("mouse-forward")).toBe(true);
      expect(isAppAction("set-filter-unread")).toBe(true);
      expect(isAppAction("open-command-palette")).toBe(true);
      expect(isAppAction("restart-app")).toBe(true);
      expect(isAppAction("set-theme-dark")).toBe(true);
      expect(isAppAction("open-subscriptions-index")).toBe(true);
    });

    it("returns false for unknown actions", () => {
      expect(isAppAction("unknown-action")).toBe(false);
      expect(isAppAction("open-feed-cleanup")).toBe(false);
      expect(isAppAction("")).toBe(false);
    });

    it("returns false for non-string values", () => {
      expect(isAppAction(null)).toBe(false);
      expect(isAppAction(undefined)).toBe(false);
      expect(isAppAction(1)).toBe(false);
      expect(isAppAction({ type: "open-settings" })).toBe(false);
    });
  });
});
