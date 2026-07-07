import { Result } from "@praha/byethrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppAction } from "@/lib/actions";
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
const reloadBrowserWebviewMock = vi.fn();
const goBackBrowserWebviewMock = vi.fn();
const goForwardBrowserWebviewMock = vi.fn();

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

beforeEach(async () => {
  useUiStore.setState(useUiStore.getInitialState());
  runManualUpdateCheckMock.mockReset();
  restartAppMock.mockReset();
  performUpdateCheckMock.mockReset();
  i18nTMock.mockClear();
  triggerSyncMock.mockReset();
  isWindowFullscreenMock.mockReset();
  setWindowFullscreenMock.mockReset();
  const mod = await import("@/lib/actions");
  executeAction = mod.executeAction;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("executeAction store actions", () => {
  describe("view filter actions", () => {
    it("sets view mode to unread", () => {
      executeAction("set-filter-unread");
      expect(useUiStore.getState().viewMode).toBe("unread");
    });

    it("sets view mode to all", () => {
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
});
