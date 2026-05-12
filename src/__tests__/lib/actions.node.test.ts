import { Result } from "@praha/byethrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import type { AppAction } from "@/lib/actions";
import actionsSource from "@/lib/actions.ts?raw";
import { APP_ACTION_REGISTRY, APP_ACTIONS } from "@/lib/app-actions";
import { shortcutDefinitions } from "@/lib/keyboard/keyboard-shortcuts";
import { useUiStore } from "@/stores/ui-store";
import menuSource from "../../../src-tauri/src/menu.rs?raw";

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

function createActionIdMap(actions: readonly AppAction[]): ReadonlyMap<string, AppAction> {
  return new Map(actions.map((action) => [action, action]));
}

function extractBlock(source: string, pattern: RegExp, label: string): string {
  const matched = source.match(pattern)?.[1];
  if (!matched) {
    throw new Error(`Could not find ${label}`);
  }
  return matched;
}

function extractExecuteActionCases(source: string): string[] {
  const startIndex = source.indexOf("export function executeAction(action: AppAction): void");
  if (startIndex < 0) {
    throw new Error("Could not find executeAction function");
  }
  const block = source.slice(startIndex);

  return [...block.matchAll(/case "([^"]+)":/g)].map((match) => match[1]);
}

function extractMenuIdConstants(source: string): ReadonlyMap<string, string> {
  return new Map([...source.matchAll(/const ([A-Z0-9_]+): &str = "([^"]+)";/g)].map((match) => [match[1], match[2]]));
}

function extractResolvedMenuTuples(
  source: string,
  blockPattern: RegExp,
  blockName: string,
  tuplePattern: RegExp,
): Array<readonly [menuId: string, value: string]> {
  const block = extractBlock(source, blockPattern, blockName);
  const menuIdsByConstant = extractMenuIdConstants(source);

  return [...block.matchAll(tuplePattern)].map((match) => {
    const menuId = menuIdsByConstant.get(match[1]);
    if (!menuId) {
      throw new Error(`Could not resolve menu id constant ${match[1]}`);
    }
    return [menuId, match[2]] as const;
  });
}

function extractMenuActionContracts(source: string): Array<{ menuId: string; action: string }> {
  return extractResolvedMenuTuples(
    source,
    /fn resolve_menu_action\(menu_id: &str\) -> Option<&'static str> \{[\s\S]*?match menu_id \{([\s\S]*?)^\s*\}/m,
    "resolve_menu_action block",
    /([A-Z0-9_]+) => Some\("([^"]+)"\),/g,
  ).map(([menuId, action]) => ({
    menuId,
    action,
  }));
}

function extractMenuActionPayloads(source: string): string[] {
  return extractMenuActionContracts(source).map((contract) => contract.action);
}

function extractItemMenuShortcutHints(source: string): Array<{ menuId: string; shortcutHint: string }> {
  return extractResolvedMenuTuples(
    source,
    /const ITEM_MENU_SHORTCUT_HINTS: &\[\(&str, &str\)\] = &\[([\s\S]*?)^\];/m,
    "ITEM_MENU_SHORTCUT_HINTS block",
    /\(([A-Z0-9_]+), "([^"]+)"\),/g,
  ).map(([menuId, shortcutHint]) => ({
    menuId,
    shortcutHint,
  }));
}

function shortcutActionToAppAction(shortcutAction: string): string {
  switch (shortcutAction) {
    case "show_unread":
      return "set-filter-unread";
    case "show_all":
      return "set-filter-all";
    case "show_starred":
      return "set-filter-starred";
    case "open_in_app_browser":
      return "open-in-reader";
    case "open_external_browser":
      return "open-in-browser";
    case "close_or_clear":
      return "close-browser";
    default:
      return shortcutAction.replaceAll("_", "-");
  }
}

function isKebabCase(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isSnakeCase(value: string): boolean {
  return /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(value);
}

vi.mock("@/api/tauri-commands", () => ({
  reloadBrowserWebview: reloadBrowserWebviewMock,
  restartApp: vi.fn(async () => Result.succeed(null)),
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
let isAppAction: (value: unknown) => value is AppAction;

beforeEach(async () => {
  useUiStore.setState(useUiStore.getInitialState());
  runManualUpdateCheckMock.mockReset();
  runManualUpdateCheckMock.mockResolvedValue(undefined);
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
  reloadBrowserWebviewMock.mockClear();
  const { resetManualSyncCooldownForTests } = await import("@/lib/sync/manual-sync");
  resetManualSyncCooldownForTests();
  const mod = await import("@/lib/actions");
  executeAction = mod.executeAction;
  isAppAction = mod.isAppAction;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("executeAction node contracts", () => {
  describe("preference toggle actions", () => {
    it("toggles reading_sort preference", async () => {
      const { usePreferencesStore } = vi.mocked(await import("@/stores/preferences-store"));
      const { prefs, setPref } = usePreferencesStore.getState();
      delete prefs.reading_sort;
      delete prefs.sort_unread;
      vi.mocked(setPref).mockClear();

      executeAction("toggle-sort-unread");

      expect(setPref).toHaveBeenCalledWith("reading_sort", "oldest_first");
    });

    it("toggles reading_sort from the current reading_sort value before legacy sort_unread", async () => {
      const { usePreferencesStore } = vi.mocked(await import("@/stores/preferences-store"));
      const { prefs, setPref } = usePreferencesStore.getState();
      prefs.reading_sort = "oldest_first";
      prefs.sort_unread = "newest_first";
      vi.mocked(setPref).mockClear();

      executeAction("toggle-sort-unread");

      expect(setPref).toHaveBeenCalledWith("reading_sort", "newest_first");
    });

    it("toggles group_by preference", async () => {
      const { usePreferencesStore } = vi.mocked(await import("@/stores/preferences-store"));
      const { prefs, setPref } = usePreferencesStore.getState();
      prefs.group_by = "date";
      vi.mocked(setPref).mockClear();

      executeAction("toggle-group-by-feed");

      expect(setPref).toHaveBeenCalledWith("group_by", "feed");
    });

    it("toggles group_by feed preference back to date", async () => {
      const { usePreferencesStore } = vi.mocked(await import("@/stores/preferences-store"));
      const { prefs, setPref } = usePreferencesStore.getState();
      prefs.group_by = "feed";
      vi.mocked(setPref).mockClear();

      executeAction("toggle-group-by-feed");

      expect(setPref).toHaveBeenCalledWith("group_by", "date");
    });

    it("keeps native checked menu toggles aligned with frontend preference toggles", async () => {
      const { usePreferencesStore } = vi.mocked(await import("@/stores/preferences-store"));
      const { prefs, setPref } = usePreferencesStore.getState();

      prefs.reading_sort = "newest_first";
      prefs.group_by = "date";
      vi.mocked(setPref).mockClear();
      executeAction("toggle-sort-unread");
      executeAction("toggle-group-by-feed");
      expect(setPref).toHaveBeenNthCalledWith(1, "reading_sort", "oldest_first");
      expect(setPref).toHaveBeenNthCalledWith(2, "group_by", "feed");

      prefs.reading_sort = "oldest_first";
      prefs.group_by = "feed";
      vi.mocked(setPref).mockClear();
      executeAction("toggle-sort-unread");
      executeAction("toggle-group-by-feed");
      expect(setPref).toHaveBeenNthCalledWith(1, "reading_sort", "newest_first");
      expect(setPref).toHaveBeenNthCalledWith(2, "group_by", "date");
    });

    it("sets theme to dark", async () => {
      const { usePreferencesStore } = vi.mocked(await import("@/stores/preferences-store"));
      const { setPref } = usePreferencesStore.getState();

      executeAction("set-theme-dark");

      expect(setPref).toHaveBeenCalledWith("theme", "dark");
    });
  });

  describe("window command actions", () => {
    it("toggles fullscreen through Result-based window helpers", async () => {
      executeAction("toggle-fullscreen");

      await vi.waitFor(() => {
        expect(isWindowFullscreenMock).toHaveBeenCalledOnce();
        expect(setWindowFullscreenMock).toHaveBeenCalledWith(true);
      });
    });

    it("exits fullscreen when the window is already fullscreen", async () => {
      isWindowFullscreenMock.mockResolvedValueOnce(Result.succeed(true));

      executeAction("toggle-fullscreen");

      await vi.waitFor(() => {
        expect(isWindowFullscreenMock).toHaveBeenCalledOnce();
        expect(setWindowFullscreenMock).toHaveBeenCalledWith(false);
      });
    });

    it("does not write fullscreen state when reading fullscreen fails", async () => {
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const error = new Error("unavailable", { cause: { code: "runtime_unavailable" } });
      isWindowFullscreenMock.mockResolvedValueOnce(Result.fail(error));

      executeAction("toggle-fullscreen");

      await vi.waitFor(() => {
        expect(isWindowFullscreenMock).toHaveBeenCalledOnce();
      });
      expect(setWindowFullscreenMock).not.toHaveBeenCalled();
      expect(consoleWarn).toHaveBeenCalledWith(
        "Failed to read fullscreen state.",
        expect.objectContaining({
          message: error.message,
          cause: { code: "runtime_unavailable" },
        }),
      );
    });

    it("swallows fullscreen write failures from Result-based window helpers", async () => {
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const error = new Error("denied", { cause: { code: "permission_denied" } });
      setWindowFullscreenMock.mockResolvedValueOnce(Result.fail(error));

      executeAction("toggle-fullscreen");

      await vi.waitFor(() => {
        expect(setWindowFullscreenMock).toHaveBeenCalledWith(true);
      });
      expect(consoleWarn).toHaveBeenCalledWith(
        "Failed to update fullscreen state.",
        expect.objectContaining({
          message: error.message,
          cause: { code: "permission_denied" },
        }),
      );
    });

    it("absorbs rejected fullscreen reads at the global action boundary", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const error = new Error("fullscreen read rejected");
      isWindowFullscreenMock.mockRejectedValueOnce(error);

      executeAction("toggle-fullscreen");

      await vi.waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          "[actions:window] toggle-fullscreen failed.",
          expect.objectContaining({
            message: error.message,
            category: "unknown",
            localeKey: "app_actions.errors.unknown",
          }),
        );
      });
      expect(setWindowFullscreenMock).not.toHaveBeenCalled();
      expect(useUiStore.getState().toastMessage).toEqual({ message: error.message });
    });

    it("absorbs rejected fullscreen writes at the global action boundary", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const error = new Error("fullscreen write rejected");
      setWindowFullscreenMock.mockRejectedValueOnce(error);

      executeAction("toggle-fullscreen");

      await vi.waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          "[actions:window] toggle-fullscreen failed.",
          expect.objectContaining({
            message: error.message,
            category: "unknown",
            localeKey: "app_actions.errors.unknown",
          }),
        );
      });
      expect(useUiStore.getState().toastMessage).toEqual({ message: error.message });
    });
  });

  describe("browser, update, and sync command actions", () => {
    it("reuses reloadBrowserWebview for reload-webview", () => {
      executeAction("reload-webview");

      expect(reloadBrowserWebviewMock).toHaveBeenCalledTimes(1);
    });

    it("reports rejected webview reload dispatch as browser action diagnostics", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const error = new Error("webview reload rejected");
      reloadBrowserWebviewMock.mockRejectedValueOnce(error);

      executeAction("reload-webview");

      await vi.waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          "[actions:browser] reload-webview failed.",
          expect.objectContaining({
            message: error.message,
            category: "unknown",
            localeKey: "app_actions.errors.unknown",
          }),
        );
      });
      expect(useUiStore.getState().toastMessage).toEqual({ message: error.message });
    });

    it("reuses the shared manual update-check helper for check-for-updates", () => {
      executeAction("check-for-updates");

      expect(runManualUpdateCheckMock).toHaveBeenCalledTimes(1);
      expect(performUpdateCheckMock).not.toHaveBeenCalled();
      expect(showUpdateAvailableToastMock).not.toHaveBeenCalled();
    });

    it("reports rejected update checks as updates action diagnostics", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const error = new Error("update check rejected");
      runManualUpdateCheckMock.mockRejectedValueOnce(error);

      executeAction("check-for-updates");

      await vi.waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          "[actions:updates] check-for-updates failed.",
          expect.objectContaining({
            message: error.message,
            category: "unknown",
            localeKey: "app_actions.errors.unknown",
          }),
        );
      });
      expect(useUiStore.getState().toastMessage).toEqual({ message: error.message });
    });

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

      await vi.waitFor(() => {
        expect(useUiStore.getState().toastMessage).toEqual({
          message: "translated:sidebar:sync_already_in_progress",
        });
      });

      expect(i18nTMock).toHaveBeenCalledWith("sidebar:sync_already_in_progress");
    });

    it("uses the translated cooldown toast and skips the second sync during cooldown", async () => {
      executeAction("sync-all");

      await vi.waitFor(() => {
        expect(triggerSyncMock).toHaveBeenCalledTimes(1);
      });

      executeAction("sync-all");

      await vi.waitFor(() => {
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

      await vi.waitFor(() => {
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

      await vi.waitFor(() => {
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
          warnings: [
            {
              account_id: "acc-2",
              account_name: "FreshRSS",
              message: "Skipped 3 entries.",
            },
          ],
        }),
      );

      executeAction("sync-all");

      await vi.waitFor(() => {
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

      await vi.waitFor(() => {
        expect(useUiStore.getState().toastMessage).toEqual({
          message: "translated:sidebar:sync_completed_with_retry_pending:FreshRSS",
        });
      });

      expect(i18nTMock).toHaveBeenCalledWith("sidebar:sync_completed_with_retry_pending", {
        accounts: "FreshRSS",
      });
    });

    it("uses the translated unexpected-error toast with details", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      triggerSyncMock.mockResolvedValueOnce(Result.fail({ type: "UserVisible", message: "boom" }));

      executeAction("sync-all");

      await vi.waitFor(() => {
        expect(useUiStore.getState().toastMessage).toEqual({
          message: "translated:sidebar:sync_failed_with_message:boom",
        });
      });

      expect(i18nTMock).toHaveBeenCalledWith("sidebar:sync_failed_with_message", {
        message: "boom",
      });
      expect(consoleError).toHaveBeenCalledWith("[actions:sync] sync-all failed.", {
        type: "UserVisible",
        message: "boom",
      });
    });

    it("reports rejected manual sync dispatch as sync action diagnostics", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const error = new Error("manual sync rejected");
      triggerSyncMock.mockRejectedValueOnce(error);

      executeAction("sync-all");

      await vi.waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          "[actions:sync] sync-all failed.",
          expect.objectContaining({
            message: error.message,
            category: "unknown",
            localeKey: "app_actions.errors.unknown",
          }),
        );
      });
      expect(useUiStore.getState().toastMessage).toEqual({ message: error.message });
    });
  });
});

describe("isAppAction node contracts", () => {
  it("derives the runtime action list from the grouped action registry", () => {
    const registryActions = Object.values(APP_ACTION_REGISTRY).flat();

    expect(APP_ACTIONS).toEqual(registryActions);
  });

  it("keeps the runtime action registry duplicate-free", () => {
    expect(new Set(APP_ACTIONS).size).toBe(APP_ACTIONS.length);
  });

  it("keeps the runtime action registry aligned with executeAction cases", () => {
    const executeActionCases = extractExecuteActionCases(actionsSource);

    expect(new Set(executeActionCases)).toEqual(new Set(APP_ACTIONS));
  });

  it("accepts every action registered for runtime boundaries", () => {
    for (const action of APP_ACTIONS) {
      expect(isAppAction(action)).toBe(true);
    }
  });

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

  it("keeps native menu action payloads registered as app actions", () => {
    const menuActionPayloads = extractMenuActionPayloads(menuSource);
    const actionIds = createActionIdMap(APP_ACTIONS);

    for (const action of menuActionPayloads) {
      expect(actionIds.has(action)).toBe(true);
      expect(isAppAction(action)).toBe(true);
    }
  });

  it("keeps action, shortcut, and native menu ids in their owning naming styles", () => {
    const menuActionContracts = extractMenuActionContracts(menuSource);
    const shortcutToActionAliasAllowlist = new Map([
      ["show_unread", "set-filter-unread"],
      ["show_all", "set-filter-all"],
      ["show_starred", "set-filter-starred"],
      ["open_in_app_browser", "open-in-reader"],
      ["open_external_browser", "open-in-browser"],
      ["close_or_clear", "close-browser"],
    ]);

    for (const action of APP_ACTIONS) {
      expect(action, `AppAction must be kebab-case: ${action}`).toSatisfy(isKebabCase);
    }

    for (const definition of shortcutDefinitions) {
      const expectedAction = definition.id.replaceAll("_", "-");
      const appAction = shortcutActionToAppAction(definition.id);

      expect(definition.id, `shortcut id must be snake_case: ${definition.id}`).toSatisfy(isSnakeCase);
      expect(appAction, `shortcut action mapping must resolve to kebab-case: ${definition.id}`).toSatisfy(isKebabCase);
      expect(appAction).toBe(shortcutToActionAliasAllowlist.get(definition.id) ?? expectedAction);
    }

    for (const { menuId, action } of menuActionContracts) {
      expect(menuId, `native menu id must be kebab-case: ${menuId}`).toSatisfy(isKebabCase);
      expect(action, `native menu action payload must be kebab-case: ${action}`).toSatisfy(isKebabCase);
    }

    expect(APP_ACTIONS).toContain("sync-all");
    expect(shortcutDefinitions.map((definition) => definition.id)).not.toContain("sync_all");
    expect(menuActionContracts).toContainEqual({ menuId: "accounts-sync", action: "sync-all" });
  });

  it("snapshots the native menu action payload list for frontend registry drift detection", () => {
    expect(extractMenuActionPayloads(menuSource)).toMatchInlineSnapshot(`
      [
        "set-filter-unread",
        "set-filter-all",
        "set-filter-starred",
        "toggle-sort-unread",
        "toggle-group-by-feed",
        "toggle-fullscreen",
        "sync-all",
        "open-settings-accounts",
        "open-settings-accounts-add",
        "open-add-feed",
        "prev-feed",
        "next-feed",
        "prev-article",
        "next-article",
        "open-in-reader",
        "open-in-browser",
        "toggle-star",
        "toggle-read",
        "mark-all-read",
        "copy-link",
        "open-in-default-browser",
        "add-to-reading-list",
        "check-for-updates",
        "open-settings",
      ]
    `);
  });

  it("keeps shared shortcut and native menu action ids mapped to registered app actions", () => {
    const menuActionPayloads = new Set(extractMenuActionPayloads(menuSource));
    const sharedShortcutActions = shortcutDefinitions
      .map((definition) => shortcutActionToAppAction(definition.id))
      .filter((action) => menuActionPayloads.has(action));

    expect(sharedShortcutActions).toEqual([
      "next-article",
      "prev-article",
      "next-feed",
      "prev-feed",
      "toggle-read",
      "toggle-star",
      "open-in-reader",
      "open-in-browser",
      "mark-all-read",
      "set-filter-unread",
      "set-filter-all",
      "set-filter-starred",
      "open-settings",
    ]);

    const actionIds = createActionIdMap(APP_ACTIONS);
    for (const action of sharedShortcutActions) {
      expect(actionIds.has(action)).toBe(true);
      expect(isAppAction(action)).toBe(true);
    }
  });

  it("keeps native item shortcut hints aligned with frontend default shortcuts", () => {
    const actionByMenuId = new Map(
      extractMenuActionContracts(menuSource).map(({ menuId, action }) => [menuId, action]),
    );
    const shortcutDefaultsByAction = new Map(
      shortcutDefinitions.map((definition) => [
        shortcutActionToAppAction(definition.id),
        definition.defaultKey.toUpperCase(),
      ]),
    );

    expect(
      extractItemMenuShortcutHints(menuSource).map(({ menuId, shortcutHint }) => {
        const action = actionByMenuId.get(menuId);
        if (!action) {
          throw new Error(`Could not resolve action for ${menuId}`);
        }
        return {
          action,
          menuId,
          shortcutHint,
          frontendDefaultKey: shortcutDefaultsByAction.get(action),
        };
      }),
    ).toEqual([
      {
        action: "prev-article",
        menuId: "item-prev",
        shortcutHint: "K",
        frontendDefaultKey: "K",
      },
      {
        action: "next-article",
        menuId: "item-next",
        shortcutHint: "J",
        frontendDefaultKey: "J",
      },
      {
        action: "open-in-reader",
        menuId: "item-reader",
        shortcutHint: "V",
        frontendDefaultKey: "V",
      },
      {
        action: "open-in-browser",
        menuId: "item-browser",
        shortcutHint: "B",
        frontendDefaultKey: "B",
      },
      {
        action: "toggle-star",
        menuId: "item-toggle-star",
        shortcutHint: "S",
        frontendDefaultKey: "S",
      },
      {
        action: "toggle-read",
        menuId: "item-toggle-read",
        shortcutHint: "M",
        frontendDefaultKey: "M",
      },
      {
        action: "mark-all-read",
        menuId: "item-mark-all-read",
        shortcutHint: "A",
        frontendDefaultKey: "A",
      },
    ]);
  });
});
