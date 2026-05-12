import { Result } from "@praha/byethrow";
import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { APP_EVENTS } from "@/constants/events";
import type { AppAction } from "@/lib/actions";
import { keyboardEvents } from "@/lib/keyboard/keyboard-shortcuts";
import {
  bindWindowEvents,
  createCustomEventDetailListener,
  isWindowNavigationDirection,
} from "@/lib/window/window-events";
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

function captureNavigationDetails(eventName: typeof APP_EVENTS.navigateArticle | typeof APP_EVENTS.navigateFeed) {
  const details: Array<1 | -1> = [];
  const cleanup = bindWindowEvents([
    {
      type: eventName,
      listener: createCustomEventDetailListener(isWindowNavigationDirection, (detail) => {
        details.push(detail);
      }),
    },
  ]);

  return { details, cleanup };
}

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
  showUpdateAvailableToast: showUpdateAvailableToastMock,
}));

vi.mock("@/lib/window/windows", () => ({
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
let flushPendingBrowserCloseAction: () => void;

beforeEach(async () => {
  useUiStore.setState(useUiStore.getInitialState());
  runManualUpdateCheckMock.mockReset();
  runManualUpdateCheckMock.mockResolvedValue(undefined);
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
  const { resetManualSyncCooldownForTests } = await import("@/lib/sync/manual-sync");
  resetManualSyncCooldownForTests();
  const mod = await import("@/lib/actions");
  executeAction = mod.executeAction;
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

    it("does not route settings actions away from a locked account setup view", () => {
      useUiStore.setState({
        selectedAccountId: "acc-other",
        settingsOpen: true,
        settingsCategory: "accounts",
        settingsAccountId: "acc-setup",
        settingsAddAccount: false,
        accountSetupSession: {
          accountId: "acc-setup",
          owner: "account-detail",
          state: "syncing",
        },
      });

      executeAction("open-current-account-settings");
      executeAction("open-settings-accounts-add");

      expect(useUiStore.getState()).toEqual(
        expect.objectContaining({
          settingsOpen: true,
          settingsCategory: "accounts",
          settingsAccountId: "acc-setup",
          settingsAddAccount: false,
          settingsAddAccountInitialKind: null,
        }),
      );
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
    it("dispatches navigate-article event with direction -1 for prev-article", () => {
      const { details, cleanup } = captureNavigationDetails(APP_EVENTS.navigateArticle);

      try {
        executeAction("prev-article");

        expect(details).toEqual([-1]);
      } finally {
        cleanup();
      }
    });

    it("dispatches navigate-article event with direction 1 for next-article", () => {
      const { details, cleanup } = captureNavigationDetails(APP_EVENTS.navigateArticle);

      try {
        executeAction("next-article");

        expect(details).toEqual([1]);
      } finally {
        cleanup();
      }
    });

    it("keeps article and feed navigation actions inert while subscriptions workspace is open", () => {
      const articleEvents = captureNavigationDetails(APP_EVENTS.navigateArticle);
      const feedEvents = captureNavigationDetails(APP_EVENTS.navigateFeed);
      useUiStore.setState({
        ...useUiStore.getInitialState(),
        subscriptionsWorkspace: { kind: "index" },
      });

      try {
        executeAction("next-article");
        executeAction("prev-article");
        executeAction("next-feed");
        executeAction("prev-feed");

        expect(articleEvents.details).toEqual([]);
        expect(feedEvents.details).toEqual([]);
        expect(useUiStore.getState().pendingBrowserCloseAction).toBeNull();
      } finally {
        articleEvents.cleanup();
        feedEvents.cleanup();
      }
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
        expect(useUiStore.getState().selection).toEqual({
          type: "feed",
          feedId: "feed-1",
        });
        expect(useUiStore.getState().focusedPane).toBe("sidebar");
        expect(document.activeElement).toHaveAttribute("data-feed-id", "feed-1");
      });
    });

    it("buffers article navigation while browser close is in flight and flushes it later", () => {
      const { details, cleanup } = captureNavigationDetails(APP_EVENTS.navigateArticle);
      useUiStore.setState({
        browserCloseInFlight: true,
        pendingBrowserCloseAction: null,
      });

      try {
        executeAction("next-article");

        expect(details).toEqual([]);
        expect(useUiStore.getState().pendingBrowserCloseAction).toBe("next-article");

        flushPendingBrowserCloseAction();

        expect(details).toEqual([1]);
        expect(useUiStore.getState().pendingBrowserCloseAction).toBeNull();
        expect(useUiStore.getState().browserCloseInFlight).toBe(false);
      } finally {
        cleanup();
      }
    });

    it("flushes pending browser close navigation in the order it was queued", () => {
      const articleEvents = captureNavigationDetails(APP_EVENTS.navigateArticle);
      const feedEvents = captureNavigationDetails(APP_EVENTS.navigateFeed);
      useUiStore.setState({
        browserCloseInFlight: true,
        pendingBrowserCloseAction: null,
      });

      try {
        executeAction("next-article");
        executeAction("prev-feed");

        expect(articleEvents.details).toEqual([]);
        expect(feedEvents.details).toEqual([]);
        expect(useUiStore.getState().pendingBrowserCloseAction).toBe("prev-feed");
        expect(useUiStore.getState().pendingBrowserCloseActionQueue).toEqual(["next-article", "prev-feed"]);

        flushPendingBrowserCloseAction();

        expect(articleEvents.details).toEqual([1]);
        expect(feedEvents.details).toEqual([-1]);
        expect(useUiStore.getState().pendingBrowserCloseAction).toBeNull();
        expect(useUiStore.getState().pendingBrowserCloseActionQueue).toEqual([]);
        expect(useUiStore.getState().browserCloseInFlight).toBe(false);

        flushPendingBrowserCloseAction();

        expect(feedEvents.details).toEqual([-1]);
      } finally {
        articleEvents.cleanup();
        feedEvents.cleanup();
      }
    });

    it("keeps rapid repeated browser close navigation as consecutive queued actions", () => {
      const { details, cleanup } = captureNavigationDetails(APP_EVENTS.navigateArticle);
      useUiStore.setState({
        browserCloseInFlight: true,
        pendingBrowserCloseAction: null,
      });

      try {
        executeAction("next-article");
        executeAction("next-article");
        executeAction("next-article");

        expect(details).toEqual([]);
        expect(useUiStore.getState().pendingBrowserCloseAction).toBe("next-article");
        expect(useUiStore.getState().pendingBrowserCloseActionQueue).toEqual([
          "next-article",
          "next-article",
          "next-article",
        ]);

        flushPendingBrowserCloseAction();

        expect(details).toEqual([1, 1, 1]);
        expect(useUiStore.getState().pendingBrowserCloseAction).toBeNull();
        expect(useUiStore.getState().pendingBrowserCloseActionQueue).toEqual([]);
        expect(useUiStore.getState().browserCloseInFlight).toBe(false);
      } finally {
        cleanup();
      }
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

    it("keeps share action targets delegated to article keyboard handlers after Web Preview navigation", () => {
      const copyHandler = vi.fn();
      const externalHandler = vi.fn();
      const readingListHandler = vi.fn();
      useUiStore.setState({
        ...useUiStore.getInitialState(),
        selectedArticleId: "art-1",
        contentMode: "browser",
        browserUrl: "https://example.com/webview-navigation-target",
        browserNavigationState: { canGoBack: true, canGoForward: false },
      });
      window.addEventListener(keyboardEvents.copyLink, copyHandler);
      window.addEventListener(keyboardEvents.openExternalBrowser, externalHandler);
      window.addEventListener(keyboardEvents.addToReadingList, readingListHandler);

      executeAction("copy-link");
      executeAction("open-in-default-browser");
      executeAction("add-to-reading-list");

      expect(copyHandler).toHaveBeenCalledTimes(1);
      expect(externalHandler).toHaveBeenCalledTimes(1);
      expect(readingListHandler).toHaveBeenCalledTimes(1);
      expect(copyHandler.mock.calls[0]?.[0]).toBeInstanceOf(Event);
      expect(externalHandler.mock.calls[0]?.[0]).toBeInstanceOf(Event);
      expect(readingListHandler.mock.calls[0]?.[0]).toBeInstanceOf(Event);
      expect(copyHandler.mock.calls[0]?.[0]).not.toBeInstanceOf(CustomEvent);
      expect(externalHandler.mock.calls[0]?.[0]).not.toBeInstanceOf(CustomEvent);
      expect(readingListHandler.mock.calls[0]?.[0]).not.toBeInstanceOf(CustomEvent);
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/webview-navigation-target");

      window.removeEventListener(keyboardEvents.copyLink, copyHandler);
      window.removeEventListener(keyboardEvents.openExternalBrowser, externalHandler);
      window.removeEventListener(keyboardEvents.addToReadingList, readingListHandler);
    });
  });

  describe("placeholder actions", () => {
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

    it("does not throw for copy-link", () => {
      expect(() => executeAction("copy-link")).not.toThrow();
    });

    it("does not throw for open-in-default-browser", () => {
      expect(() => executeAction("open-in-default-browser")).not.toThrow();
    });

    it("does not throw for add-to-reading-list", () => {
      expect(() => executeAction("add-to-reading-list")).not.toThrow();
    });
  });
});
