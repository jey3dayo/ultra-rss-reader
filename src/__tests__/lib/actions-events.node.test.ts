import { Result } from "@praha/byethrow";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  i18nTMock: vi.fn((key: string) => `translated:${key}`),
  isWindowFullscreenMock: vi.fn(),
  setWindowFullscreenMock: vi.fn(),
}));

const runManualUpdateCheckMock = vi.fn();
const restartAppMock = vi.fn();
const performUpdateCheckMock = vi.fn();
const showUpdateAvailableToastMock = vi.fn();
const reloadBrowserWebviewMock = vi.fn();
const goBackBrowserWebviewMock = vi.fn();
const goForwardBrowserWebviewMock = vi.fn();

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

let executeAction: (action: AppAction) => void;
let flushPendingBrowserCloseAction: () => void;

setupBrowserTestDom();

beforeEach(async () => {
  useUiStore.setState(useUiStore.getInitialState());
  runManualUpdateCheckMock.mockReset();
  restartAppMock.mockReset();
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
  setWindowFullscreenMock.mockReset();
  reloadBrowserWebviewMock.mockClear();
  goBackBrowserWebviewMock.mockClear();
  goForwardBrowserWebviewMock.mockClear();
  const { resetManualSyncCooldownForTests } = await import("@/lib/sync/manual-sync");
  resetManualSyncCooldownForTests();
  const mod = await import("@/lib/actions");
  executeAction = mod.executeAction;
  flushPendingBrowserCloseAction = mod.flushPendingBrowserCloseAction;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("executeAction event contracts", () => {
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

  describe("placeholder action events", () => {
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
  });
});
