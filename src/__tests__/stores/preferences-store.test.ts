import { Result } from "@praha/byethrow";
import i18n from "i18next";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { getPreferences, setPreference } from "@/api/tauri-commands";
import { STORAGE_KEYS } from "@/constants/storage";
import { preferenceDefaults, type PreferenceWritableKey, resolvePreferenceValue } from "@/schemas/preferences";
import type { PreferencesActions } from "@/stores/preferences-store.types";
import { useUiStore } from "@/stores/ui-store";

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

function createResultDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolvePromise: (value: T) => void = () => {};
  let rejectPromise: (error: unknown) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
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

function mockSystemThemeMedia(initialMatches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQuery = {
    matches: initialMatches,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((event: string, listener: EventListenerOrEventListenerObject) => {
      if (event === "change" && typeof listener === "function") {
        listeners.add(listener as (event: MediaQueryListEvent) => void);
      }
    }),
    removeEventListener: vi.fn((event: string, listener: EventListenerOrEventListenerObject) => {
      if (event === "change" && typeof listener === "function") {
        listeners.delete(listener as (event: MediaQueryListEvent) => void);
      }
    }),
    dispatchEvent: vi.fn(() => false),
  };

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn<typeof window.matchMedia>((query) => {
      if (query === "(prefers-color-scheme: dark)") {
        return mediaQuery;
      }

      return {
        matches: false,
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

  return {
    listeners,
    addEventListener: mediaQuery.addEventListener,
    removeEventListener: mediaQuery.removeEventListener,
    dispatchChange: (matches: boolean) => {
      mediaQuery.matches = matches;
      for (const listener of listeners) {
        listener({ matches } as MediaQueryListEvent);
      }
    },
  };
}

function mockSystemThemeMediaWithLegacyListener(initialMatches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQuery = {
    matches: initialMatches,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    }),
    removeListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    }),
    dispatchEvent: vi.fn(() => false),
  };

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn<typeof window.matchMedia>((query) => {
      if (query === "(prefers-color-scheme: dark)") {
        return mediaQuery as unknown as MediaQueryList;
      }

      return {
        matches: false,
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

  return {
    listeners,
    addListener: mediaQuery.addListener,
    removeListener: mediaQuery.removeListener,
    dispatchChange: (matches: boolean) => {
      mediaQuery.matches = matches;
      for (const listener of listeners) {
        listener({ matches } as MediaQueryListEvent);
      }
    },
  };
}

describe("usePreferencesStore preferences", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.mocked(setPreference).mockResolvedValue(Result.succeed(null));
    usePreferencesStore.setState({ prefs: {}, loaded: false });
    useUiStore.setState({ toastMessage: null });
    document.documentElement.classList.remove("dark", "theme-transitioning", "vertical-wipe-transition");
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
    document.documentElement.classList.remove("dark", "theme-transitioning", "vertical-wipe-transition");
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

    expect(resolvePreferenceValue(usePreferencesStore.getState().prefs, "theme")).toBe("light");
    expect(usePreferencesStore.getState().theme()).toBe("light");
  });

  it("keeps setPref keys within the writable preference boundary", () => {
    expectTypeOf<PreferencesActions["setPref"]>().parameter(0).toExtend<PreferenceWritableKey>();
    expectTypeOf<PreferencesActions["setPref"]>().parameter(0).not.toEqualTypeOf<string>();

    const assertWritableKeys = (setPref: PreferencesActions["setPref"]) => {
      setPref("reader_mode_default", "true");
      setPref("web_preview_mode_default", "false");
      setPref("selected_account_id", "account-1");

      // @ts-expect-error Unknown preference keys must not cross the store action boundary.
      setPref("unknown_preference_key", "value");
    };
    expectTypeOf(assertWritableKeys).returns.toEqualTypeOf<void>();
  });

  it("keeps manual theme switches as Tauri document-root view transitions when supported", async () => {
    const transitionDone = createDeferred();
    const startViewTransition = vi.fn((callback: ViewTransitionUpdateCallback): ViewTransition => {
      callback();
      return createViewTransition(transitionDone.promise);
    });
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

    expect(document.documentElement).not.toHaveClass("vertical-wipe-transition");
  });

  it("switches themes immediately when view transitions are unsupported", () => {
    usePreferencesStore.getState().setPref("theme", "dark");

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).not.toHaveClass("theme-transitioning");
    expect(document.documentElement).not.toHaveClass("vertical-wipe-transition");
  });

  it("switches themes immediately when reduced motion is requested", () => {
    const startViewTransition = vi.fn((callback: ViewTransitionUpdateCallback): ViewTransition => {
      callback();
      return createViewTransition(Promise.resolve());
    });
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });
    mockReducedMotion(true);

    usePreferencesStore.getState().setPref("theme", "dark");

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).not.toHaveClass("theme-transitioning");
    expect(document.documentElement).not.toHaveClass("vertical-wipe-transition");
  });

  it.each(["light", "dark"] as const)("removes the system theme listener when switching from system to %s", (theme) => {
    const systemTheme = mockSystemThemeMedia(false);

    usePreferencesStore.getState().setPref("theme", "system");

    expect(systemTheme.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    expect(systemTheme.listeners.size).toBe(1);
    expect(document.documentElement).not.toHaveClass("dark");

    systemTheme.dispatchChange(true);
    expect(document.documentElement).toHaveClass("dark");

    usePreferencesStore.getState().setPref("theme", theme);

    expect(systemTheme.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    expect(systemTheme.listeners.size).toBe(0);
    expect(document.documentElement.classList.contains("dark")).toBe(theme === "dark");

    systemTheme.dispatchChange(theme !== "dark");

    expect(document.documentElement.classList.contains("dark")).toBe(theme === "dark");
    expect(document.documentElement.style.colorScheme).toBe(theme);
  });

  it("uses legacy system theme listeners when EventTarget listeners are unavailable", () => {
    const systemTheme = mockSystemThemeMediaWithLegacyListener(false);

    usePreferencesStore.getState().setPref("theme", "system");

    expect(systemTheme.addListener).toHaveBeenCalledWith(expect.any(Function));
    expect(systemTheme.listeners.size).toBe(1);
    expect(document.documentElement).not.toHaveClass("dark");

    systemTheme.dispatchChange(true);
    expect(document.documentElement).toHaveClass("dark");

    usePreferencesStore.getState().setPref("theme", "light");

    expect(systemTheme.removeListener).toHaveBeenCalledWith(expect.any(Function));
    expect(systemTheme.listeners.size).toBe(0);
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("keeps system theme applied when listener registration throws", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn<typeof window.matchMedia>((query) => {
        if (query === "(prefers-color-scheme: dark)") {
          return {
            matches: true,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(() => {
              throw new Error("listener unavailable");
            }),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(() => false),
          };
        }

        return {
          matches: false,
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

    expect(() => usePreferencesStore.getState().setPref("theme", "system")).not.toThrow();
    expect(document.documentElement).toHaveClass("dark");
  });

  it("falls back to legacy system theme listeners when EventTarget listener registration throws", () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const addListener = vi.fn((listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    });
    const removeListener = vi.fn((listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn<typeof window.matchMedia>((query) => {
        if (query === "(prefers-color-scheme: dark)") {
          return {
            matches: false,
            media: query,
            onchange: null,
            addListener,
            removeListener,
            addEventListener: vi.fn(() => {
              throw new Error("event target listener unavailable");
            }),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(() => false),
          };
        }

        return {
          matches: false,
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

    usePreferencesStore.getState().setPref("theme", "system");

    expect(addListener).toHaveBeenCalledWith(expect.any(Function));
    expect(listeners.size).toBe(1);

    for (const listener of listeners) {
      listener({ matches: true } as MediaQueryListEvent);
    }
    expect(document.documentElement).toHaveClass("dark");

    usePreferencesStore.getState().setPref("theme", "light");

    expect(removeListener).toHaveBeenCalledWith(expect.any(Function));
    expect(listeners.size).toBe(0);
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("does not add a transition class when applying the persisted theme during startup", async () => {
    vi.mocked(getPreferences).mockResolvedValue(Result.succeed({ theme: "dark" }));

    await usePreferencesStore.getState().loadPreferences();

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).not.toHaveClass("theme-transitioning");
    expect(document.documentElement).not.toHaveClass("vertical-wipe-transition");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("dedupes concurrent preference loads", async () => {
    const deferred = createDeferred();
    vi.mocked(getPreferences).mockReturnValue(
      deferred.promise.then(() => Result.succeed({ theme: "dark", language: "en" })),
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

  it("normalizes schema-invalid backend preferences before storing loaded state", async () => {
    vi.mocked(getPreferences).mockResolvedValue(
      Result.succeed({
        theme: "midnight",
        language: "klingon",
        layout: "narrow",
        unread_badge: "bad",
        font_style: "comic_sans",
        font_size: "huge",
        show_sidebar_unread: "maybe",
        after_reading: "mark_as_read",
        custom_backend_preference: "preserved",
      }),
    );

    await usePreferencesStore.getState().loadPreferences();

    expect(usePreferencesStore.getState().prefs).toMatchObject({
      theme: "light",
      language: "system",
      layout: "automatic",
      unread_badge: "dont_display",
      font_style: "sans_serif",
      font_size: "medium",
      show_sidebar_unread: "true",
      after_reading: "immediately",
      custom_backend_preference: "preserved",
    });
    expect(usePreferencesStore.getState().theme()).toBe("light");
  });

  it("dedupes concurrent failed preference loads and applies the default language fallback", async () => {
    const changeLanguage = vi.spyOn(i18n, "changeLanguage");
    const languageDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "language");
    Object.defineProperty(navigator, "language", {
      configurable: true,
      value: "ja-JP",
    });
    const deferred = createDeferred();
    vi.mocked(getPreferences).mockReturnValue(
      deferred.promise.then(() => Result.fail({ type: "UserVisible", message: "boom" })),
    );

    const firstLoad = usePreferencesStore.getState().loadPreferences();
    const secondLoad = usePreferencesStore.getState().loadPreferences();

    expect(getPreferences).toHaveBeenCalledTimes(1);

    try {
      deferred.resolve();
      await Promise.all([firstLoad, secondLoad]);

      expect(usePreferencesStore.getState().loaded).toBe(true);
      expect(usePreferencesStore.getState().prefs).toEqual({});
      expect(changeLanguage).toHaveBeenCalledWith("ja");
      expect(document.documentElement).toHaveClass("font-sans");
      expect(document.documentElement).toHaveClass("text-base");
    } finally {
      changeLanguage.mockRestore();
      if (languageDescriptor) {
        Object.defineProperty(navigator, "language", languageDescriptor);
      }
    }
  });

  it("recovers from rejected preference loads with defaults and allows retry", async () => {
    const changeLanguage = vi.spyOn(i18n, "changeLanguage");
    const languageDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "language");
    Object.defineProperty(navigator, "language", {
      configurable: true,
      value: "ja-JP",
    });
    vi.mocked(getPreferences)
      .mockRejectedValueOnce(new Error("transport down"))
      .mockResolvedValueOnce(
        Result.succeed({
          language: "en",
          font_style: "serif",
          font_size: "large",
        }),
      );

    try {
      await usePreferencesStore.getState().loadPreferences();

      expect(usePreferencesStore.getState().loaded).toBe(true);
      expect(usePreferencesStore.getState().prefs).toEqual({});
      expect(changeLanguage).toHaveBeenCalledWith("ja");
      expect(document.documentElement).toHaveClass("font-sans");
      expect(document.documentElement).toHaveClass("text-base");

      await usePreferencesStore.getState().loadPreferences();

      expect(getPreferences).toHaveBeenCalledTimes(2);
      expect(usePreferencesStore.getState().loaded).toBe(true);
      expect(usePreferencesStore.getState().prefs).toMatchObject({
        language: "en",
        font_style: "serif",
        font_size: "large",
      });
      expect(changeLanguage).toHaveBeenCalledWith("en");
      expect(document.documentElement).toHaveClass("font-serif");
      expect(document.documentElement).toHaveClass("text-lg");
    } finally {
      changeLanguage.mockRestore();
      if (languageDescriptor) {
        Object.defineProperty(navigator, "language", languageDescriptor);
      }
    }
  });

  it("mirrors the persisted theme into localStorage on load and manual updates", async () => {
    vi.mocked(getPreferences).mockResolvedValue(Result.succeed({ theme: "system" }));

    await usePreferencesStore.getState().loadPreferences();

    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe("system");

    usePreferencesStore.getState().setPref("theme", "dark");

    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe("dark");
    expect(vi.mocked(setPreference)).toHaveBeenCalledWith("theme", "dark");
  });

  it("reports rejected manual preference persists without rolling back optimistic theme state or mirrored cache", async () => {
    await i18n.changeLanguage("ja");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(setPreference).mockRejectedValue(new Error("db offline"));

    try {
      usePreferencesStore.getState().setPref("theme", "dark");
      await vi.waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith("Failed to persist preference theme:", expect.any(Error));
      });

      expect(usePreferencesStore.getState().prefs.theme).toBe("dark");
      expect(document.documentElement).toHaveClass("dark");
      expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe("dark");
      expect(useUiStore.getState().toastMessage).toEqual({
        message: "設定の保存に失敗しました: db offline",
      });
    } finally {
      consoleError.mockRestore();
    }
  });

  it("keeps paired reading display preset preferences optimistic when one persist fails", async () => {
    await i18n.changeLanguage("ja");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(setPreference)
      .mockResolvedValueOnce(Result.succeed(null))
      .mockResolvedValueOnce(Result.fail({ type: "UserVisible", message: "web preview write failed" }));

    try {
      usePreferencesStore.getState().setPref("reader_mode_default", "true");
      usePreferencesStore.getState().setPref("web_preview_mode_default", "true");

      await vi.waitFor(() => {
        expect(useUiStore.getState().toastMessage).toEqual({
          message: "設定の保存に失敗しました: web preview write failed",
        });
      });

      expect(usePreferencesStore.getState().prefs).toMatchObject({
        reader_mode_default: "true",
        web_preview_mode_default: "true",
      });
      expect(setPreference).toHaveBeenNthCalledWith(1, "reader_mode_default", "true");
      expect(setPreference).toHaveBeenNthCalledWith(2, "web_preview_mode_default", "true");
      expect(consoleError).toHaveBeenCalledWith("Failed to persist preference web_preview_mode_default:", {
        type: "UserVisible",
        message: "web preview write failed",
      });
    } finally {
      consoleError.mockRestore();
    }
  });

  it("falls back when a rejected preference persist has a throwing message getter", async () => {
    await i18n.changeLanguage("ja");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.defineProperty({}, "message", {
      get: () => {
        throw new Error("message unavailable");
      },
    });
    vi.mocked(setPreference).mockRejectedValue(error);

    try {
      usePreferencesStore.getState().setPref("theme", "dark");
      await vi.waitFor(() => {
        expect(useUiStore.getState().toastMessage).toEqual({
          message: "設定の保存に失敗しました: Unknown error",
        });
      });

      expect(consoleError.mock.calls[0]?.[0]).toBe("Failed to persist preference theme:");
      expect(consoleError.mock.calls[0]?.[1]).toBe(error);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("falls back when a rejected preference persist cannot be stringified", async () => {
    await i18n.changeLanguage("ja");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = {
      toString: () => {
        throw new Error("stringify unavailable");
      },
    };
    vi.mocked(setPreference).mockRejectedValue(error);

    try {
      usePreferencesStore.getState().setPref("theme", "dark");
      await vi.waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith("Failed to persist preference theme:", error);
      });

      expect(useUiStore.getState().toastMessage).toEqual({
        message: "設定の保存に失敗しました: Unknown error",
      });
    } finally {
      consoleError.mockRestore();
    }
  });

  it("ignores stale persist failures for the same preference after a newer success", async () => {
    await i18n.changeLanguage("ja");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const staleSave = createResultDeferred<Awaited<ReturnType<typeof setPreference>>>();
    const latestSave = createResultDeferred<Awaited<ReturnType<typeof setPreference>>>();
    vi.mocked(setPreference).mockReturnValueOnce(staleSave.promise).mockReturnValueOnce(latestSave.promise);

    try {
      usePreferencesStore.getState().setPref("language", "en");
      usePreferencesStore.getState().setPref("language", "ja");

      latestSave.resolve(Result.succeed(null));
      await latestSave.promise;
      await Promise.resolve();

      staleSave.reject(new Error("old write failed"));
      await staleSave.promise.catch(() => undefined);
      await Promise.resolve();

      expect(consoleError).not.toHaveBeenCalled();
      expect(useUiStore.getState().toastMessage).toBeNull();
      expect(usePreferencesStore.getState().prefs.language).toBe("ja");
    } finally {
      consoleError.mockRestore();
    }
  });

  it("does not reuse completed request ids for later preference writes", async () => {
    await i18n.changeLanguage("ja");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const firstSave = createResultDeferred<Awaited<ReturnType<typeof setPreference>>>();
    const secondSave = createResultDeferred<Awaited<ReturnType<typeof setPreference>>>();
    const thirdSave = createResultDeferred<Awaited<ReturnType<typeof setPreference>>>();
    vi.mocked(setPreference)
      .mockReturnValueOnce(firstSave.promise)
      .mockReturnValueOnce(secondSave.promise)
      .mockReturnValueOnce(thirdSave.promise);

    try {
      usePreferencesStore.getState().setPref("language", "en");
      usePreferencesStore.getState().setPref("language", "ja");

      secondSave.resolve(Result.succeed(null));
      await secondSave.promise;
      await Promise.resolve();

      usePreferencesStore.getState().setPref("language", "en");

      firstSave.reject(new Error("old write failed"));
      await firstSave.promise.catch(() => undefined);
      await Promise.resolve();

      expect(consoleError).not.toHaveBeenCalled();
      expect(useUiStore.getState().toastMessage).toBeNull();
      expect(usePreferencesStore.getState().prefs.language).toBe("en");
    } finally {
      thirdSave.resolve(Result.succeed(null));
      consoleError.mockRestore();
    }
  });

  it("still reports the latest persist failure for a preference", async () => {
    await i18n.changeLanguage("ja");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const staleSave = createResultDeferred<Awaited<ReturnType<typeof setPreference>>>();
    const latestSave = createResultDeferred<Awaited<ReturnType<typeof setPreference>>>();
    vi.mocked(setPreference).mockReturnValueOnce(staleSave.promise).mockReturnValueOnce(latestSave.promise);

    try {
      usePreferencesStore.getState().setPref("language", "en");
      usePreferencesStore.getState().setPref("language", "ja");

      staleSave.resolve(Result.succeed(null));
      latestSave.reject(new Error("new write failed"));
      await latestSave.promise.catch(() => undefined);

      await vi.waitFor(() => {
        expect(useUiStore.getState().toastMessage).toEqual({
          message: "設定の保存に失敗しました: new write failed",
        });
      });
      expect(consoleError).toHaveBeenCalledWith("Failed to persist preference language:", expect.any(Error));
    } finally {
      consoleError.mockRestore();
    }
  });

  it("reports synchronous latest manual preference persist failures", async () => {
    await i18n.changeLanguage("ja");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(setPreference).mockImplementation(() => {
      throw new Error("sync write failed");
    });

    try {
      expect(() => usePreferencesStore.getState().setPref("language", "en")).not.toThrow();

      expect(useUiStore.getState().toastMessage).toEqual({
        message: "Failed to save setting: sync write failed",
      });
      expect(consoleError).toHaveBeenCalledWith("Failed to persist preference language:", expect.any(Error));
      expect(usePreferencesStore.getState().prefs.language).toBe("en");
    } finally {
      consoleError.mockRestore();
    }
  });

  it("falls back to English when applying the system language without navigator", () => {
    const changeLanguage = vi.spyOn(i18n, "changeLanguage");

    vi.stubGlobal("navigator", undefined);

    try {
      usePreferencesStore.getState().setPref("language", "system");

      expect(changeLanguage).toHaveBeenCalledWith("en");
    } finally {
      changeLanguage.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("keeps the bootstrapped theme and mirrored cache when loading preferences fails", async () => {
    vi.mocked(getPreferences).mockResolvedValue(Result.fail({ type: "UserVisible", message: "boom" }));
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
    window.localStorage.setItem(STORAGE_KEYS.theme, "dark");

    await usePreferencesStore.getState().loadPreferences();

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe("dark");
    expect(document.documentElement).toHaveClass("font-sans");
    expect(document.documentElement).toHaveClass("text-base");
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
    expect(resolvePreferenceValue({}, "web_preview_mode_default")).toBe("false");
    expect(resolvePreferenceValue({}, "web_preview_keep_focus")).toBe("false");
    expect(resolvePreferenceValue({}, "window_always_on_top")).toBe("false");
    expect(resolvePreferenceValue({}, "after_reading")).toBe("after_0_3s");
    expect(resolvePreferenceValue({}, "debug_browser_hud")).toBe("false");
    expect(resolvePreferenceValue({}, "debug_web_preview_url")).toBe("");
    expect(resolvePreferenceValue({}, "mute_auto_mark_read")).toBe("false");
  });

  it("normalizes invalid reader and web preview defaults", () => {
    expect(resolvePreferenceValue({ reader_mode_default: "maybe" }, "reader_mode_default")).toBe("true");
    expect(resolvePreferenceValue({ web_preview_mode_default: "sometimes" }, "web_preview_mode_default")).toBe("false");
    expect(resolvePreferenceValue({ web_preview_keep_focus: "sometimes" }, "web_preview_keep_focus")).toBe("false");
    expect(resolvePreferenceValue({ window_always_on_top: "sometimes" }, "window_always_on_top")).toBe("false");
    expect(resolvePreferenceValue({ debug_browser_hud: "sometimes" }, "debug_browser_hud")).toBe("false");
    expect(resolvePreferenceValue({ mute_auto_mark_read: "sometimes" }, "mute_auto_mark_read")).toBe("false");
  });

  it("maps legacy auto-mark values to the current reading preference values", () => {
    expect(resolvePreferenceValue({ after_reading: "mark_as_read" }, "after_reading")).toBe("immediately");
    expect(resolvePreferenceValue({ after_reading: "do_nothing" }, "after_reading")).toBe("never");
    expect(resolvePreferenceValue({ after_reading: "archive" }, "after_reading")).toBe("never");
  });

  it("preserves the current auto-mark values", () => {
    expect(resolvePreferenceValue({ after_reading: "never" }, "after_reading")).toBe("never");
    expect(resolvePreferenceValue({ after_reading: "immediately" }, "after_reading")).toBe("immediately");
    expect(resolvePreferenceValue({ after_reading: "after_0_3s" }, "after_reading")).toBe("after_0_3s");
    expect(resolvePreferenceValue({ after_reading: "after_0_5s" }, "after_reading")).toBe("after_0_5s");
    expect(resolvePreferenceValue({ after_reading: "after_1s" }, "after_reading")).toBe("after_1s");
  });

  it("defaults sidebar section visibility preferences to true", () => {
    expect(resolvePreferenceValue({}, "show_sidebar_unread")).toBe("true");
    expect(resolvePreferenceValue({}, "show_sidebar_starred")).toBe("true");
    expect(resolvePreferenceValue({}, "show_sidebar_recent_articles")).toBe("true");
    expect(resolvePreferenceValue({}, "show_sidebar_tags")).toBe("true");
    expect(resolvePreferenceValue({}, "startup_folder_expansion")).toBe("all_collapsed");
  });

  it("does not expose subscription sort in preference defaults", () => {
    expect(preferenceDefaults).not.toHaveProperty("sort_subscriptions");
  });

  it("normalizes invalid sidebar visibility preferences back to true", () => {
    expect(resolvePreferenceValue({ show_sidebar_unread: "maybe" }, "show_sidebar_unread")).toBe("true");
    expect(resolvePreferenceValue({ show_sidebar_starred: "nope" }, "show_sidebar_starred")).toBe("true");
    expect(resolvePreferenceValue({ show_sidebar_recent_articles: "unset" }, "show_sidebar_recent_articles")).toBe(
      "true",
    );
    expect(resolvePreferenceValue({ show_sidebar_tags: "unset" }, "show_sidebar_tags")).toBe("true");
    expect(resolvePreferenceValue({ startup_folder_expansion: "surprise" }, "startup_folder_expansion")).toBe(
      "all_collapsed",
    );
  });

  it("defaults recently viewed history recording to enabled and normalizes invalid values", () => {
    expect(resolvePreferenceValue({}, "recent_articles_history_enabled")).toBe("true");
    expect(
      resolvePreferenceValue({ recent_articles_history_enabled: "maybe" }, "recent_articles_history_enabled"),
    ).toBe("true");
  });

  it("defaults sidebar density to normal and normalizes invalid values", () => {
    expect(resolvePreferenceValue({}, "sidebar_density")).toBe("normal");
    expect(resolvePreferenceValue({ sidebar_density: "dense" }, "sidebar_density")).toBe("normal");
  });

  it("does not expose removed share action preferences in defaults", () => {
    expect(preferenceDefaults).not.toHaveProperty("action_share");
    expect(preferenceDefaults).not.toHaveProperty("action_share_menu");
  });
});
