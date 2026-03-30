import { Result } from "@praha/byethrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppAction } from "@/lib/actions";
import { keyboardEvents } from "@/lib/keyboard-shortcuts";
import { useUiStore } from "@/stores/ui-store";

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
  triggerSync: vi.fn(async () => Result.succeed(true)),
  listAccounts: vi.fn(async () => Result.succeed([])),
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

beforeEach(async () => {
  useUiStore.setState(useUiStore.getInitialState());
  runManualUpdateCheckMock.mockReset();
  performUpdateCheckMock.mockReset();
  showUpdateAvailableToastMock.mockReset();
  const mod = await import("@/lib/actions");
  executeAction = mod.executeAction;
  isAppAction = mod.isAppAction;
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
      window.addEventListener("ultra-rss:navigate-article", handler);

      executeAction("prev-article");

      expect(handler).toHaveBeenCalledTimes(1);
      expect((handler.mock.calls[0][0] as CustomEvent).detail).toBe(-1);

      window.removeEventListener("ultra-rss:navigate-article", handler);
    });

    it("dispatches navigate-article event with direction 1 for next-article", () => {
      const handler = vi.fn();
      window.addEventListener("ultra-rss:navigate-article", handler);

      executeAction("next-article");

      expect(handler).toHaveBeenCalledTimes(1);
      expect((handler.mock.calls[0][0] as CustomEvent).detail).toBe(1);

      window.removeEventListener("ultra-rss:navigate-article", handler);
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

  describe("isAppAction", () => {
    it("returns true for valid actions", () => {
      expect(isAppAction("open-settings")).toBe(true);
      expect(isAppAction("sync-all")).toBe(true);
      expect(isAppAction("set-filter-unread")).toBe(true);
      expect(isAppAction("open-command-palette")).toBe(true);
    });

    it("returns false for unknown actions", () => {
      expect(isAppAction("unknown-action")).toBe(false);
      expect(isAppAction("")).toBe(false);
    });
  });
});
