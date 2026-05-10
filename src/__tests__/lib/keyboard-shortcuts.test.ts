import { Result } from "@praha/byethrow";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APP_ACTIONS,
  type AppActionAvailabilityContext,
  isAppActionAvailable,
} from "@/lib/app-actions";
import {
  buildKeyToActionMap,
  formatKeyForDisplay,
  getRenamedShortcutPreferenceKey,
  getShortcutConflict,
  keyboardEvents,
  resolveKeyboardAction,
  shortcutDefinitions,
} from "@/lib/keyboard/keyboard-shortcuts";

describe("keyboard shortcut resolver", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("opens settings on command comma even when an input is focused", () => {
    const result = resolveKeyboardAction({
      key: ",",
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "INPUT",
      selectedArticleId: null,
      contentMode: "empty",
      viewMode: "all",
    });

    expect(Result.unwrap(result)).toEqual({ type: "open-settings" });
  });

  it("ignores a single-key open settings remap when an input is focused", () => {
    const result = resolveKeyboardAction({
      key: "o",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "INPUT",
      selectedArticleId: null,
      contentMode: "empty",
      viewMode: "all",
      keyToAction: buildKeyToActionMap({
        shortcut_open_settings: "o",
      }),
    });

    expect(Result.unwrapError(result)).toBe("ignored_input");
  });

  it("resolves Cmd+K to open-command-palette", () => {
    const result = resolveKeyboardAction({
      key: "k",
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: null,
      contentMode: "empty",
      viewMode: "all",
    });

    expect(Result.unwrap(result)).toEqual({ type: "open-command-palette" });
  });

  it("does not reserve Cmd+Shift+R in dev builds", () => {
    vi.stubEnv("DEV", true);

    const result = resolveKeyboardAction({
      key: "R",
      metaKey: true,
      ctrlKey: false,
      shiftKey: true,
      targetTag: "DIV",
      selectedArticleId: null,
      contentMode: "reader",
      viewMode: "all",
    });

    expect(Result.unwrapError(result)).toBe("no_action");
  });

  it("ignores Cmd+Shift+R outside dev builds", () => {
    vi.stubEnv("DEV", false);

    const result = resolveKeyboardAction({
      key: "R",
      metaKey: true,
      ctrlKey: false,
      shiftKey: true,
      targetTag: "DIV",
      selectedArticleId: null,
      contentMode: "reader",
      viewMode: "all",
    });

    expect(Result.unwrapError(result)).toBe("no_action");
  });

  it("resolves Cmd+Backslash to toggle the sidebar", () => {
    const result = resolveKeyboardAction({
      key: "\\",
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: null,
      contentMode: "empty",
      viewMode: "all",
    });

    expect(Result.unwrap(result)).toEqual({ type: "toggle-sidebar" });
  });

  it("resolves Cmd+1 to show unread articles", () => {
    const result = resolveKeyboardAction({
      key: "1",
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: null,
      contentMode: "empty",
      viewMode: "all",
    });

    expect(Result.unwrap(result)).toEqual({
      type: "set-view-mode",
      mode: "unread",
    });
  });

  it("resolves Cmd+2 to show all articles", () => {
    const result = resolveKeyboardAction({
      key: "2",
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: null,
      contentMode: "empty",
      viewMode: "unread",
    });

    expect(Result.unwrap(result)).toEqual({
      type: "set-view-mode",
      mode: "all",
    });
  });

  it("resolves Cmd+3 to show starred articles", () => {
    const result = resolveKeyboardAction({
      key: "3",
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: null,
      contentMode: "empty",
      viewMode: "all",
    });

    expect(Result.unwrap(result)).toEqual({
      type: "set-view-mode",
      mode: "starred",
    });
  });

  it("resolves h to navigate-feed backward", () => {
    const result = resolveKeyboardAction({
      key: "h",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: null,
      contentMode: "empty",
      viewMode: "all",
    });

    expect(Result.unwrap(result)).toEqual({
      type: "navigate-feed",
      direction: -1,
    });
  });

  it("resolves l to navigate-feed forward", () => {
    const result = resolveKeyboardAction({
      key: "l",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: null,
      contentMode: "empty",
      viewMode: "all",
    });

    expect(Result.unwrap(result)).toEqual({
      type: "navigate-feed",
      direction: 1,
    });
  });

  it("ignores shortcuts when a text input is focused", () => {
    const result = resolveKeyboardAction({
      key: "m",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "TEXTAREA",
      selectedArticleId: "art-1",
      contentMode: "reader",
      viewMode: "all",
    });

    expect(Result.unwrapError(result)).toBe("ignored_input");
  });

  it("emits toggle-read for m when an article is selected", () => {
    const result = resolveKeyboardAction({
      key: "m",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: "art-1",
      contentMode: "reader",
      viewMode: "all",
    });

    expect(Result.unwrap(result)).toEqual({
      type: "emit",
      eventName: keyboardEvents.toggleRead,
    });
  });

  it("cycles the view mode for f", () => {
    const result = resolveKeyboardAction({
      key: "f",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: null,
      contentMode: "empty",
      viewMode: "unread",
    });

    expect(Result.unwrap(result)).toEqual({
      type: "set-view-mode",
      mode: "starred",
    });
  });

  it("closes the browser on escape when browser mode is active", () => {
    const result = resolveKeyboardAction({
      key: "Escape",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: "art-1",
      contentMode: "browser",
      viewMode: "all",
    });

    expect(Result.unwrap(result)).toEqual({ type: "close-browser" });
  });

  it("clears the selected article on escape in reader mode", () => {
    const result = resolveKeyboardAction({
      key: "Escape",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: "art-1",
      contentMode: "reader",
      viewMode: "all",
    });

    expect(Result.unwrap(result)).toEqual({ type: "clear-article" });
  });

  it("ignores escape when a subscriptions workspace is open", () => {
    const result = resolveKeyboardAction({
      key: "Escape",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: "art-1",
      contentMode: "reader",
      viewMode: "all",
      subscriptionsWorkspaceOpen: true,
    });

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toBe("no_action");
  });

  it("formats modifier shortcuts for macOS display", () => {
    expect(formatKeyForDisplay("⌘+k", "macos")).toBe("⌘ k");
    expect(formatKeyForDisplay("⌘,", "macos")).toBe("⌘ ,");
  });

  it("formats modifier shortcuts for Windows display", () => {
    expect(formatKeyForDisplay("⌘+k", "windows")).toBe("Ctrl k");
    expect(formatKeyForDisplay("⌘,", "windows")).toBe("Ctrl ,");
  });

  it("builds h/l as the default feed navigation bindings", () => {
    const map = buildKeyToActionMap({});

    expect(map.get("h")).toBe("prev_feed");
    expect(map.get("l")).toBe("next_feed");
  });

  it("keeps shortcut ids unique in display order", () => {
    const shortcutIds = shortcutDefinitions.map((definition) => definition.id);

    expect(new Set(shortcutIds).size).toBe(shortcutDefinitions.length);
    expect(shortcutIds).toEqual([
      "next_article",
      "prev_article",
      "next_feed",
      "prev_feed",
      "reload_webview",
      "focus_sidebar",
      "toggle_sidebar",
      "toggle_read",
      "toggle_star",
      "open_in_app_browser",
      "open_external_browser",
      "mark_all_read",
      "show_unread",
      "show_all",
      "show_starred",
      "cycle_filter",
      "search",
      "open_command_palette",
      "close_or_clear",
      "open_settings",
    ]);
  });

  it("builds direct filter shortcuts into the default key map", () => {
    const map = buildKeyToActionMap({});

    expect(map.get("⌘+1")).toBe("show_unread");
    expect(map.get("⌘+2")).toBe("show_all");
    expect(map.get("⌘+3")).toBe("show_starred");
  });

  it("builds the sidebar toggle shortcut into the default key map", () => {
    const map = buildKeyToActionMap({});

    expect(map.get("⌘+\\")).toBe("toggle_sidebar");
  });

  it("keeps renamed shortcut action ids on the current binding path", () => {
    const keyToAction = buildKeyToActionMap({
      shortcut_view_in_browser: "x",
      shortcut_open_browser: "y",
    });

    expect(getRenamedShortcutPreferenceKey("shortcut_view_in_browser")).toBe(
      "shortcut_open_in_app_browser",
    );
    expect(getRenamedShortcutPreferenceKey("shortcut_open_browser")).toBe(
      "shortcut_open_external_browser",
    );
    expect(keyToAction.get("x")).toBe("open_in_app_browser");
    expect(keyToAction.get("y")).toBe("open_external_browser");
  });

  it("keeps action availability in one capability matrix for command, menu, shortcut, and dispatcher surfaces", () => {
    const baseContext: AppActionAvailabilityContext = {
      selectedAccountId: "acc-1",
      selectedArticleId: "art-1",
      contentMode: "reader",
      commandPaletteOpen: false,
      settingsOpen: false,
      shortcutsHelpOpen: false,
      isAddFeedDialogOpen: false,
      isSyncing: false,
    };

    expect(APP_ACTIONS).toContain("sync-all");
    expect(isAppActionAvailable("sync-all", "dispatcher", baseContext)).toBe(
      true,
    );
    expect(
      isAppActionAvailable("sync-all", "commandPalette", {
        ...baseContext,
        selectedAccountId: null,
      }),
    ).toBe(false);
    expect(
      isAppActionAvailable("sync-all", "nativeMenu", {
        ...baseContext,
        isSyncing: true,
      }),
    ).toBe(false);
    expect(
      isAppActionAvailable("toggle-star", "keyboardShortcut", {
        ...baseContext,
        selectedArticleId: null,
      }),
    ).toBe(false);
    expect(
      isAppActionAvailable("reload-webview", "keyboardShortcut", baseContext),
    ).toBe(false);
    expect(
      isAppActionAvailable("mark-all-read", "commandPalette", {
        ...baseContext,
        settingsOpen: true,
      }),
    ).toBe(false);
    expect(
      isAppActionAvailable("open-settings", "nativeMenu", {
        ...baseContext,
        settingsOpen: true,
      }),
    ).toBe(true);
  });

  it("disables a duplicate custom shortcut key instead of dispatching an ambiguous action", () => {
    const keyToAction = buildKeyToActionMap({
      shortcut_next_article: "x",
      shortcut_prev_article: "x",
    });

    expect(keyToAction.get("x")).toBeUndefined();

    const result = resolveKeyboardAction({
      key: "x",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: "art-1",
      contentMode: "reader",
      viewMode: "all",
      keyToAction,
    });

    expect(Result.unwrapError(result)).toBe("no_action");
  });

  it("reports duplicate custom shortcut conflicts and leaves runtime resolution disabled", () => {
    const prefs = {
      shortcut_next_article: "x",
      shortcut_prev_article: "x",
    };

    expect(getShortcutConflict("prev_article", "x", prefs)).toEqual({
      type: "duplicate",
      actionId: "next_article",
    });
    expect(buildKeyToActionMap(prefs).get("x")).toBeUndefined();
  });

  it.each(["", "   "] as const)(
    "treats a blank next-article shortcut override as disabled: %j",
    (shortcut) => {
      const keyToAction = buildKeyToActionMap({
        shortcut_next_article: shortcut,
      });

      expect(keyToAction.get(shortcut)).toBeUndefined();
      expect(keyToAction.get("j")).toBeUndefined();

      const result = resolveKeyboardAction({
        key: "j",
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        targetTag: "DIV",
        selectedArticleId: "art-1",
        contentMode: "reader",
        viewMode: "all",
        keyToAction,
      });

      expect(Result.unwrapError(result)).toBe("no_action");
    },
  );

  it.each(["input", "textarea"] as const)(
    "ignores shortcuts for lowercase %s target tags",
    (targetTag) => {
      const result = resolveKeyboardAction({
        key: "m",
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        targetTag,
        targetIsTextEditing: false,
        selectedArticleId: "art-1",
        contentMode: "reader",
        viewMode: "all",
      });

      expect(Result.unwrapError(result)).toBe("ignored_input");
    },
  );

  it("treats targetIsTextEditing as text input even when the target tag is not editable", () => {
    const result = resolveKeyboardAction({
      key: "m",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      targetIsTextEditing: true,
      selectedArticleId: "art-1",
      contentMode: "reader",
      viewMode: "all",
    });

    expect(Result.unwrapError(result)).toBe("ignored_input");
  });

  it("does not dispatch any action for duplicate custom shortcuts", () => {
    const keyToAction = buildKeyToActionMap({
      shortcut_open_settings: "z",
      shortcut_open_command_palette: "z",
      shortcut_focus_sidebar: "z",
    });

    expect(keyToAction.get("z")).toBeUndefined();
  });

  it("does not fall back to the plain key when a command-modified shortcut is unmapped", () => {
    const map = buildKeyToActionMap({
      shortcut_open_command_palette: "⌘+p",
    });

    const result = resolveKeyboardAction({
      key: "k",
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: null,
      contentMode: "empty",
      viewMode: "all",
      keyToAction: map,
    });

    expect(Result.unwrapError(result)).toBe("no_action");
  });

  it("does not fall back to the plain key when a ctrl-modified shortcut is unmapped", () => {
    const result = resolveKeyboardAction({
      key: "j",
      metaKey: false,
      ctrlKey: true,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: null,
      contentMode: "reader",
      viewMode: "all",
    });

    expect(Result.unwrapError(result)).toBe("no_action");
  });

  it.each([
    ["Alt/Option modified key", { key: "j", altKey: true }],
    ["IME composition", { key: "j", isComposing: true }],
    ["dead key", { key: "Dead" }],
    ["unidentified key", { key: "Unidentified" }],
    ["process key", { key: "Process" }],
  ] as const)(
    "does not resolve reader shortcuts during %s",
    (_label, event) => {
      const result = resolveKeyboardAction({
        key: event.key,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: "altKey" in event ? event.altKey : undefined,
        isComposing: "isComposing" in event ? event.isComposing : undefined,
        targetTag: "DIV",
        selectedArticleId: "art-1",
        contentMode: "reader",
        viewMode: "all",
      });

      expect(Result.unwrapError(result)).toBe("no_action");
    },
  );

  it("resolves mapped modifier shortcuts without using the plain-key fallback", () => {
    const result = resolveKeyboardAction({
      key: "j",
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: null,
      contentMode: "reader",
      viewMode: "all",
      keyToAction: buildKeyToActionMap({
        shortcut_next_feed: "⌘+j",
      }),
    });

    expect(Result.unwrap(result)).toEqual({
      type: "navigate-feed",
      direction: 1,
    });
  });

  it("keeps native menu item shortcut hints aligned with fixed frontend defaults", () => {
    const contracts = [
      ["prev_article", "K"],
      ["next_article", "J"],
      ["open_in_app_browser", "V"],
      ["open_external_browser", "B"],
      ["toggle_star", "S"],
      ["toggle_read", "M"],
      ["mark_all_read", "A"],
    ] as const;

    for (const [actionId, nativeMenuHint] of contracts) {
      const definition = shortcutDefinitions.find(
        (item) => item.id === actionId,
      );

      expect(definition?.defaultKey.toUpperCase()).toBe(nativeMenuHint);
    }
  });

  it.each([
    { modifier: "Cmd", metaKey: true, ctrlKey: false },
    { modifier: "Ctrl", metaKey: false, ctrlKey: true },
  ])(
    "lets the native menu own $modifier+R even when Web Preview reload is remapped to it",
    ({ metaKey, ctrlKey }) => {
      const result = resolveKeyboardAction({
        key: "r",
        metaKey,
        ctrlKey,
        shiftKey: false,
        targetTag: "DIV",
        selectedArticleId: "art-1",
        contentMode: "browser",
        viewMode: "all",
        keyToAction: buildKeyToActionMap({
          shortcut_reload_webview: "⌘+r",
        }),
      });

      expect(Result.unwrapError(result)).toBe("no_action");
    },
  );

  it("does not include native menu owned shortcuts in the runtime key map", () => {
    expect(
      buildKeyToActionMap({
        shortcut_reload_webview: "⌘+r",
      }).get("⌘+r"),
    ).toBeUndefined();
  });

  it("reports native menu owned shortcut conflicts", () => {
    expect(getShortcutConflict("reload_webview", "⌘+r", {})).toEqual({
      type: "native_menu",
    });
  });

  it("lets Web Preview reload use a non-native custom shortcut", () => {
    const result = resolveKeyboardAction({
      key: "e",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: "art-1",
      contentMode: "browser",
      viewMode: "all",
      keyToAction: buildKeyToActionMap({
        shortcut_reload_webview: "e",
      }),
    });

    expect(Result.unwrap(result)).toEqual({ type: "reload-webview" });
  });

  it.each([
    ["toggle_read", "m", keyboardEvents.toggleRead],
    ["toggle_star", "s", keyboardEvents.toggleStar],
    ["open_in_app_browser", "v", keyboardEvents.openInAppBrowser],
    ["open_external_browser", "b", keyboardEvents.openExternalBrowser],
  ] as const)(
    "skips %s when there is no selected article and emits %s when selected",
    (actionId, key, eventName) => {
      const keyToAction = buildKeyToActionMap({
        [`shortcut_${actionId}`]: key,
      });
      const missingArticleResult = resolveKeyboardAction({
        key,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        targetTag: "DIV",
        selectedArticleId: null,
        contentMode: "reader",
        viewMode: "all",
        keyToAction,
      });
      const selectedArticleResult = resolveKeyboardAction({
        key,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        targetTag: "DIV",
        selectedArticleId: "art-1",
        contentMode: "reader",
        viewMode: "all",
        keyToAction,
      });

      expect(Result.unwrapError(missingArticleResult)).toBe(
        "missing_selected_article",
      );
      expect(Result.unwrap(selectedArticleResult)).toEqual({
        type: "emit",
        eventName,
      });
    },
  );

  it.each([
    ["browser mode", "browser", "art-1"],
    ["selected article", "reader", "art-1"],
    ["no selected article", "reader", null],
  ] as const)(
    "keeps close_or_clear as a noop while subscriptions workspace is open with %s",
    (_label, contentMode, selectedArticleId) => {
      const result = resolveKeyboardAction({
        key: "Escape",
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        targetTag: "DIV",
        selectedArticleId,
        contentMode,
        viewMode: "all",
        subscriptionsWorkspaceOpen: true,
      });

      expect(Result.unwrapError(result)).toBe("no_action");
    },
  );
});
