import { Result } from "@praha/byethrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPreferences, setPreference } from "@/api/tauri-commands";
import { STORAGE_KEYS } from "@/constants/storage";
import {
  preferenceDefaults,
  resolvePreferenceValue,
} from "@/schemas/preferences";

vi.mock("@/api/tauri-commands", () => ({
  getPreferences: vi.fn(),
  setPreference: vi.fn(async () => Result.succeed(null)),
}));

import { usePreferencesStore } from "../../stores/preferences-store";

function createDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolvePromise: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

function createViewTransition(finished: Promise<void>): ViewTransition {
  return {
    finished,
    ready: Promise.resolve(),
    types: new Set<string>(),
    updateCallbackDone: Promise.resolve(),
    skipTransition: vi.fn(),
  };
}

function mockReducedMotion(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn<typeof window.matchMedia>((query) => {
      return {
        matches: query === "(prefers-reduced-motion: reduce)" ? matches : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      };
    }),
  });
}

describe("usePreferencesStore preferences", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    usePreferencesStore.setState({ prefs: {}, loaded: false });
    document.documentElement.classList.remove(
      "dark",
      "theme-transitioning",
      "vertical-wipe-transition",
    );
    document.documentElement.style.colorScheme = "";
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: undefined,
    });
    mockReducedMotion(false);
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.classList.remove(
      "dark",
      "theme-transitioning",
      "vertical-wipe-transition",
    );
    document.documentElement.style.colorScheme = "";
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: undefined,
    });
    window.localStorage.clear();
  });

  it("falls back to the default theme when the persisted value is invalid", () => {
    usePreferencesStore.setState({
      prefs: { theme: "midnight" },
      loaded: true,
    });

    expect(
      resolvePreferenceValue(usePreferencesStore.getState().prefs, "theme"),
    ).toBe("light");
    expect(usePreferencesStore.getState().theme()).toBe("light");
  });

  it("wraps manual theme switches in a vertical wipe view transition when supported", async () => {
    const transitionDone = createDeferred();
    const startViewTransition = vi.fn(
      (callback: ViewTransitionUpdateCallback): ViewTransition => {
        callback();
        return createViewTransition(transitionDone.promise);
      },
    );
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });

    usePreferencesStore.getState().setPref("theme", "dark");

    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).toHaveClass("vertical-wipe-transition");
    expect(document.documentElement).not.toHaveClass("theme-transitioning");

    transitionDone.resolve();
    await transitionDone.promise;
    await Promise.resolve();

    expect(document.documentElement).not.toHaveClass(
      "vertical-wipe-transition",
    );
  });

  it("switches themes immediately when view transitions are unsupported", () => {
    usePreferencesStore.getState().setPref("theme", "dark");

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).not.toHaveClass("theme-transitioning");
    expect(document.documentElement).not.toHaveClass(
      "vertical-wipe-transition",
    );
  });

  it("switches themes immediately when reduced motion is requested", () => {
    const startViewTransition = vi.fn(
      (callback: ViewTransitionUpdateCallback): ViewTransition => {
        callback();
        return createViewTransition(Promise.resolve());
      },
    );
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });
    mockReducedMotion(true);

    usePreferencesStore.getState().setPref("theme", "dark");

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).not.toHaveClass("theme-transitioning");
    expect(document.documentElement).not.toHaveClass(
      "vertical-wipe-transition",
    );
  });

  it("does not add a transition class when applying the persisted theme during startup", async () => {
    vi.mocked(getPreferences).mockResolvedValue(
      Result.succeed({ theme: "dark" }),
    );

    await usePreferencesStore.getState().loadPreferences();

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).not.toHaveClass("theme-transitioning");
    expect(document.documentElement).not.toHaveClass(
      "vertical-wipe-transition",
    );
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("dedupes concurrent preference loads", async () => {
    const deferred = createDeferred();
    vi.mocked(getPreferences).mockReturnValue(
      deferred.promise.then(() =>
        Result.succeed({ theme: "dark", language: "en" }),
      ),
    );

    const firstLoad = usePreferencesStore.getState().loadPreferences();
    const secondLoad = usePreferencesStore.getState().loadPreferences();

    expect(getPreferences).toHaveBeenCalledTimes(1);

    deferred.resolve();
    await Promise.all([firstLoad, secondLoad]);

    expect(usePreferencesStore.getState().loaded).toBe(true);
    expect(usePreferencesStore.getState().prefs).toMatchObject({
      theme: "dark",
      language: "en",
    });
  });

  it("mirrors the persisted theme into localStorage on load and manual updates", async () => {
    vi.mocked(getPreferences).mockResolvedValue(
      Result.succeed({ theme: "system" }),
    );

    await usePreferencesStore.getState().loadPreferences();

    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe("system");

    usePreferencesStore.getState().setPref("theme", "dark");

    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe("dark");
    expect(vi.mocked(setPreference)).toHaveBeenCalledWith("theme", "dark");
  });

  it("keeps the bootstrapped theme and mirrored cache when loading preferences fails", async () => {
    vi.mocked(getPreferences).mockResolvedValue(
      Result.fail({ type: "UserVisible", message: "boom" }),
    );
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
    window.localStorage.setItem(STORAGE_KEYS.theme, "dark");

    await usePreferencesStore.getState().loadPreferences();

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe("dark");
  });

  it("keeps the mirrored bootstrapped theme when loaded preferences omit theme", async () => {
    vi.mocked(getPreferences).mockResolvedValue(Result.succeed({}));
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
    window.localStorage.setItem(STORAGE_KEYS.theme, "dark");

    await usePreferencesStore.getState().loadPreferences();

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe("dark");
  });

  it("defaults reader and web preview preferences independently", () => {
    expect(resolvePreferenceValue({}, "reader_mode_default")).toBe("true");
    expect(resolvePreferenceValue({}, "web_preview_mode_default")).toBe(
      "false",
    );
    expect(resolvePreferenceValue({}, "web_preview_keep_focus")).toBe("false");
    expect(resolvePreferenceValue({}, "window_always_on_top")).toBe("false");
    expect(resolvePreferenceValue({}, "after_reading")).toBe("after_0_3s");
    expect(resolvePreferenceValue({}, "debug_browser_hud")).toBe("false");
    expect(resolvePreferenceValue({}, "debug_web_preview_url")).toBe("");
    expect(resolvePreferenceValue({}, "mute_auto_mark_read")).toBe("false");
  });

  it("normalizes invalid reader and web preview defaults", () => {
    expect(
      resolvePreferenceValue(
        { reader_mode_default: "maybe" },
        "reader_mode_default",
      ),
    ).toBe("true");
    expect(
      resolvePreferenceValue(
        { web_preview_mode_default: "sometimes" },
        "web_preview_mode_default",
      ),
    ).toBe("false");
    expect(
      resolvePreferenceValue(
        { web_preview_keep_focus: "sometimes" },
        "web_preview_keep_focus",
      ),
    ).toBe("false");
    expect(
      resolvePreferenceValue(
        { window_always_on_top: "sometimes" },
        "window_always_on_top",
      ),
    ).toBe("false");
    expect(
      resolvePreferenceValue(
        { debug_browser_hud: "sometimes" },
        "debug_browser_hud",
      ),
    ).toBe("false");
    expect(
      resolvePreferenceValue(
        { mute_auto_mark_read: "sometimes" },
        "mute_auto_mark_read",
      ),
    ).toBe("false");
  });

  it("maps legacy auto-mark values to the current reading preference values", () => {
    expect(
      resolvePreferenceValue(
        { after_reading: "mark_as_read" },
        "after_reading",
      ),
    ).toBe("immediately");
    expect(
      resolvePreferenceValue({ after_reading: "do_nothing" }, "after_reading"),
    ).toBe("never");
    expect(
      resolvePreferenceValue({ after_reading: "archive" }, "after_reading"),
    ).toBe("never");
  });

  it("preserves the current auto-mark values", () => {
    expect(
      resolvePreferenceValue({ after_reading: "never" }, "after_reading"),
    ).toBe("never");
    expect(
      resolvePreferenceValue({ after_reading: "immediately" }, "after_reading"),
    ).toBe("immediately");
    expect(
      resolvePreferenceValue({ after_reading: "after_0_3s" }, "after_reading"),
    ).toBe("after_0_3s");
    expect(
      resolvePreferenceValue({ after_reading: "after_0_5s" }, "after_reading"),
    ).toBe("after_0_5s");
    expect(
      resolvePreferenceValue({ after_reading: "after_1s" }, "after_reading"),
    ).toBe("after_1s");
  });

  it("defaults sidebar section visibility preferences to true", () => {
    expect(resolvePreferenceValue({}, "show_sidebar_unread")).toBe("true");
    expect(resolvePreferenceValue({}, "show_sidebar_starred")).toBe("true");
    expect(resolvePreferenceValue({}, "show_sidebar_recent_articles")).toBe(
      "true",
    );
    expect(resolvePreferenceValue({}, "show_sidebar_tags")).toBe("true");
    expect(resolvePreferenceValue({}, "startup_folder_expansion")).toBe(
      "all_collapsed",
    );
  });

  it("does not expose subscription sort in preference defaults", () => {
    expect(preferenceDefaults).not.toHaveProperty("sort_subscriptions");
  });

  it("normalizes invalid sidebar visibility preferences back to true", () => {
    expect(
      resolvePreferenceValue(
        { show_sidebar_unread: "maybe" },
        "show_sidebar_unread",
      ),
    ).toBe("true");
    expect(
      resolvePreferenceValue(
        { show_sidebar_starred: "nope" },
        "show_sidebar_starred",
      ),
    ).toBe("true");
    expect(
      resolvePreferenceValue(
        { show_sidebar_recent_articles: "unset" },
        "show_sidebar_recent_articles",
      ),
    ).toBe("true");
    expect(
      resolvePreferenceValue(
        { show_sidebar_tags: "unset" },
        "show_sidebar_tags",
      ),
    ).toBe("true");
    expect(
      resolvePreferenceValue(
        { startup_folder_expansion: "surprise" },
        "startup_folder_expansion",
      ),
    ).toBe("all_collapsed");
  });

  it("defaults recently viewed history recording to enabled and normalizes invalid values", () => {
    expect(resolvePreferenceValue({}, "recent_articles_history_enabled")).toBe(
      "true",
    );
    expect(
      resolvePreferenceValue(
        { recent_articles_history_enabled: "maybe" },
        "recent_articles_history_enabled",
      ),
    ).toBe("true");
  });

  it("defaults sidebar density to normal and normalizes invalid values", () => {
    expect(resolvePreferenceValue({}, "sidebar_density")).toBe("normal");
    expect(
      resolvePreferenceValue({ sidebar_density: "dense" }, "sidebar_density"),
    ).toBe("normal");
  });

  it("does not expose removed share action preferences in defaults", () => {
    expect(preferenceDefaults).not.toHaveProperty("action_share");
    expect(preferenceDefaults).not.toHaveProperty("action_share_menu");
  });
});
