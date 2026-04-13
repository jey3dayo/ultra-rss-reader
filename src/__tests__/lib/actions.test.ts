import { Result } from "@praha/byethrow";
import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_EVENTS } from "@/constants/events";
import type { AppAction } from "@/lib/actions";
import { keyboardEvents } from "@/lib/keyboard-shortcuts";
import { useUiStore } from "@/stores/ui-store";

const { triggerSyncMock, i18nTMock } = vi.hoisted(() => ({
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
}));

const runManualUpdateCheckMock = vi.fn();
const performUpdateCheckMock = vi.fn();
const showUpdateAvailableToastMock = vi.fn();
const reloadBrowserWebviewMock = vi.fn(async () =>
  Result.succeed({
    url: "https://example.com/article",
    can_go_back: false,
    can_go_forward: false,
    is_loading: false,
  }),
);

vi.mock("@/api/tauri-commands", () => ({
  reloadBrowserWebview: reloadBrowserWebviewMock,
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
let isAppAction: (value: string) => value is AppAction;
let flushPendingBrowserCloseAction: () => void;

beforeEach(async () => {
  useUiStore.setState(useUiStore.getInitialState());
  runManualUpdateCheckMock.mockReset();
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
  const mod = await import("@/lib/actions");
  executeAction = mod.executeAction;
  isAppAction = mod.isAppAction;
  flushPendingBrowserCloseAction = mod.flushPendingBrowserCloseAction;
});

afterEach(() => {
  vi.restoreAllMocks();
  reloadBrowserWebviewMock.mockClear();
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
    });

    it("opens add feed dialog", () => {
      executeAction("open-add-feed");
      expect(useUiStore.getState().isAddFeedDialogOpen).toBe(true);
    });

    it("opens the feed cleanup surface", () => {
      executeAction("open-feed-cleanup");
      expect(useUiStore.getState().feedCleanupOpen).toBe(true);
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

  describe("article navigation actions", () => {
    it("dispatches navigate-article event with direction -1 for prev-article", () => {
      const handler = vi.fn();
      window.addEventListener(APP_EVENTS.navigateArticle, handler);

      executeAction("prev-article");

      expect(handler).toHaveBeenCalledTimes(1);
      expect((handler.mock.calls[0][0] as CustomEvent).detail).toBe(-1);

      window.removeEventListener(APP_EVENTS.navigateArticle, handler);
    });

    it("dispatches navigate-article event with direction 1 for next-article", () => {
      const handler = vi.fn();
      window.addEventListener(APP_EVENTS.navigateArticle, handler);

      executeAction("next-article");

      expect(handler).toHaveBeenCalledTimes(1);
      expect((handler.mock.calls[0][0] as CustomEvent).detail).toBe(1);

      window.removeEventListener(APP_EVENTS.navigateArticle, handler);
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
      expect((handler.mock.calls[0][0] as CustomEvent).detail).toBe(1);
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
    it("toggles sort_unread preference", async () => {
      const { usePreferencesStore } = vi.mocked(await import("@/stores/preferences-store"));
      const { setPref } = usePreferencesStore.getState();

      executeAction("toggle-sort-unread");

      expect(setPref).toHaveBeenCalled();
    });

    it("toggles group_by preference", async () => {
      const { usePreferencesStore } = vi.mocked(await import("@/stores/preferences-store"));
      const { setPref } = usePreferencesStore.getState();

      executeAction("toggle-group-by-feed");

      expect(setPref).toHaveBeenCalled();
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
      expect(isAppAction("set-filter-unread")).toBe(true);
      expect(isAppAction("open-command-palette")).toBe(true);
      expect(isAppAction("open-feed-cleanup")).toBe(true);
    });

    it("returns false for unknown actions", () => {
      expect(isAppAction("unknown-action")).toBe(false);
      expect(isAppAction("")).toBe(false);
    });
  });
});
