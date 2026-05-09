import { Result } from "@praha/byethrow";
import i18n from "i18next";
import { create } from "zustand";
import { getPreferences, setPreference } from "@/api/tauri-commands";
import { STORAGE_KEYS } from "@/constants/storage";
import { resolveUiLanguage } from "@/lib/ui/ui-language";
import {
  type AfterReadingPreference,
  type FontSizePreference,
  type FontStylePreference,
  normalizePreferenceRecord,
  normalizePreferenceValue,
  parseLanguagePreference,
  parseThemePreference,
  preferenceDefaults,
  resolvePreferenceValue,
  type SortSubscriptions,
  type Theme,
} from "@/schemas/preferences";
import type {
  PreferencesActions,
  PreferencesState,
} from "@/stores/preferences-store.types";
import { useUiStore } from "@/stores/ui-store";

const objectHasOwnProperty = Object.prototype.hasOwnProperty;

const THEME_VIEW_TRANSITION_CLASS = "vertical-wipe-transition";
const UNKNOWN_PREFERENCE_ERROR_MESSAGE = "Unknown error";

export type { AfterReadingPreference, SortSubscriptions, Theme };
export { preferenceDefaults, resolvePreferenceValue };

let systemThemeCleanup: (() => void) | null = null;
let themeViewTransitionId = 0;
let preferencesLoadPromise: Promise<void> | null = null;
const preferencePersistRequestCounters = new Map<string, number>();
const preferencePersistRequestIds = new Map<string, number>();

function getSystemPrefersDark(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function mirrorThemePreference(theme: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.theme, theme);
  } catch {
    // Ignore storage failures; DB remains the source of truth.
  }
}

function readMirroredThemePreference(): Theme | null {
  try {
    const storedTheme = window.localStorage.getItem(STORAGE_KEYS.theme);
    if (storedTheme === null) {
      return null;
    }
    return parseThemePreference(storedTheme);
  } catch {
    return null;
  }
}

function resolveErrorMessage(error: unknown): string {
  try {
    if (error instanceof Error) {
      return error.message;
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return error.message;
    }
    return String(error);
  } catch {
    return UNKNOWN_PREFERENCE_ERROR_MESSAGE;
  }
}

function notifyPreferencePersistFailure(key: string, error: unknown): void {
  const message = resolveErrorMessage(error);
  console.error(`Failed to persist preference ${key}:`, error);
  useUiStore
    .getState()
    .showToast(i18n.t("failed_to_save_setting", { message }));
}

function getPrefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function updateResolvedTheme(
  root: HTMLElement,
  resolvedTheme: "light" | "dark",
): void {
  root.classList.toggle("dark", resolvedTheme === "dark");
  root.style.colorScheme = resolvedTheme;
}

function applyResolvedTheme(
  root: HTMLElement,
  resolvedTheme: "light" | "dark",
  withTransition: boolean,
): void {
  const canUseViewTransition =
    typeof document.startViewTransition === "function";

  if (!withTransition || !canUseViewTransition || getPrefersReducedMotion()) {
    root.classList.remove(THEME_VIEW_TRANSITION_CLASS);
    updateResolvedTheme(root, resolvedTheme);
    return;
  }

  root.classList.add(THEME_VIEW_TRANSITION_CLASS);
  const transitionId = themeViewTransitionId + 1;
  themeViewTransitionId = transitionId;
  // Tauri shell boundary: theme updates mutate documentElement outside React's tree.
  // react-doctor-disable-next-line react-doctor/no-document-start-view-transition -- React 19 ViewTransition cannot wrap document root class/color-scheme sync.
  const transition = document.startViewTransition(() => {
    updateResolvedTheme(root, resolvedTheme);
  });
  const cleanupTransitionClass = () => {
    if (transitionId === themeViewTransitionId) {
      root.classList.remove(THEME_VIEW_TRANSITION_CLASS);
    }
  };
  void transition.finished.then(cleanupTransitionClass, cleanupTransitionClass);
}

function tryAddSystemThemeListener(
  mediaQuery: MediaQueryList,
  handler: (event: MediaQueryListEvent) => void,
): (() => void) | null {
  if (typeof mediaQuery.addEventListener === "function") {
    try {
      mediaQuery.addEventListener("change", handler);
      return () => {
        try {
          mediaQuery.removeEventListener("change", handler);
        } catch {
          // Runtime listener cleanup is best-effort for older WebViews/mocks.
        }
      };
    } catch {
      // Fall through to the legacy API below.
    }
  }

  if (typeof mediaQuery.addListener === "function") {
    try {
      mediaQuery.addListener(handler);
      return () => {
        try {
          mediaQuery.removeListener(handler);
        } catch {
          // Runtime listener cleanup is best-effort for older WebViews/mocks.
        }
      };
    } catch {
      return null;
    }
  }

  return null;
}

function applyTheme(
  theme: Theme,
  options?: { withTransition?: boolean },
): void {
  // Clean up previous system theme listener
  systemThemeCleanup?.();
  systemThemeCleanup = null;

  const root = document.documentElement;
  const withTransition = options?.withTransition ?? true;
  if (theme === "system") {
    applyResolvedTheme(
      root,
      getSystemPrefersDark() ? "dark" : "light",
      withTransition,
    );
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      applyResolvedTheme(root, e.matches ? "dark" : "light", true);
    };
    systemThemeCleanup = tryAddSystemThemeListener(mq, handler);
  } else {
    applyResolvedTheme(
      root,
      theme === "dark" ? "dark" : "light",
      withTransition,
    );
  }
}

const fontStyleClasses = {
  sans_serif: "font-sans",
  serif: "font-serif",
  monospace: "font-mono",
} satisfies Record<FontStylePreference, string>;

const fontSizeClasses = {
  small: "text-sm",
  medium: "text-base",
  large: "text-lg",
} satisfies Record<FontSizePreference, string>;

function isFontStylePreference(value: string): value is FontStylePreference {
  return objectHasOwnProperty.call(fontStyleClasses, value);
}

function isFontSizePreference(value: string): value is FontSizePreference {
  return objectHasOwnProperty.call(fontSizeClasses, value);
}

function applyFontStyle(style: string): void {
  const root = document.documentElement;
  for (const cls of Object.values(fontStyleClasses)) {
    root.classList.remove(cls);
  }
  const cls = isFontStylePreference(style)
    ? fontStyleClasses[style]
    : fontStyleClasses.sans_serif;
  root.classList.add(cls);
}

function applyFontSize(size: string): void {
  const root = document.documentElement;
  for (const cls of Object.values(fontSizeClasses)) {
    root.classList.remove(cls);
  }
  const cls = isFontSizePreference(size)
    ? fontSizeClasses[size]
    : fontSizeClasses.medium;
  root.classList.add(cls);
}

function getNavigatorLanguage(): string | undefined {
  return typeof navigator === "undefined" ? undefined : navigator.language;
}

function applyLanguage(
  language: ReturnType<typeof parseLanguagePreference>,
): void {
  i18n.changeLanguage(resolveUiLanguage(language, getNavigatorLanguage()));
}

function applyDefaultLoadFallback(): void {
  applyLanguage(resolvePreferenceValue({}, "language"));
  applyFontStyle(resolvePreferenceValue({}, "font_style"));
  applyFontSize(resolvePreferenceValue({}, "font_size"));
}

export const usePreferencesStore = create<
  PreferencesState & PreferencesActions
>()((set, getState) => ({
  prefs: {},
  loaded: false,

  loadPreferences: async () => {
    if (preferencesLoadPromise) {
      return preferencesLoadPromise;
    }

    preferencesLoadPromise = (async () => {
      try {
        const result = await getPreferences();
        Result.pipe(
          result,
          Result.inspect((data) => {
            const normalizedData = normalizePreferenceRecord(data);
            const theme = objectHasOwnProperty.call(normalizedData, "theme")
              ? resolvePreferenceValue(normalizedData, "theme")
              : (readMirroredThemePreference() ??
                resolvePreferenceValue(normalizedData, "theme"));
            set({
              prefs: objectHasOwnProperty.call(normalizedData, "theme")
                ? normalizedData
                : { ...normalizedData, theme },
              loaded: true,
            });
            applyTheme(theme, { withTransition: false });
            mirrorThemePreference(theme);
            applyLanguage(resolvePreferenceValue(normalizedData, "language"));
            applyFontStyle(
              resolvePreferenceValue(normalizedData, "font_style"),
            );
            applyFontSize(resolvePreferenceValue(normalizedData, "font_size"));
          }),
          Result.inspectError((e) => {
            console.error("Failed to load preferences:", e);
            set({ loaded: true });
            applyDefaultLoadFallback();
          }),
        );
      } catch (e) {
        console.error("Failed to load preferences:", e);
        set({ loaded: true });
        applyDefaultLoadFallback();
      }
    })().finally(() => {
      preferencesLoadPromise = null;
    });

    return preferencesLoadPromise;
  },

  setPref: (key, value) => {
    const normalizedValue = normalizePreferenceValue(key, value);
    const requestId = (preferencePersistRequestCounters.get(key) ?? 0) + 1;
    preferencePersistRequestCounters.set(key, requestId);
    preferencePersistRequestIds.set(key, requestId);
    set((state) => ({
      prefs: { ...state.prefs, [key]: normalizedValue },
    }));

    if (key === "theme") {
      const theme = resolvePreferenceValue({ theme: normalizedValue }, "theme");
      applyTheme(theme, { withTransition: true });
      mirrorThemePreference(theme);
    }
    if (key === "language") {
      applyLanguage(parseLanguagePreference(normalizedValue));
    }
    if (key === "font_style") {
      applyFontStyle(normalizedValue);
    }
    if (key === "font_size") {
      applyFontSize(normalizedValue);
    }

    const clearLatestPersistRequest = () => {
      if (preferencePersistRequestIds.get(key) === requestId) {
        preferencePersistRequestIds.delete(key);
      }
    };
    const notifyLatestPersistFailure = (error: unknown) => {
      if (preferencePersistRequestIds.get(key) !== requestId) {
        return;
      }
      preferencePersistRequestIds.delete(key);
      notifyPreferencePersistFailure(key, error);
    };

    let persistPreferenceResult: ReturnType<typeof setPreference>;
    try {
      persistPreferenceResult = setPreference(key, normalizedValue);
    } catch (error) {
      notifyLatestPersistFailure(error);
      return;
    }

    // Fire and forget — notify user on latest failure only.
    persistPreferenceResult.then(
      (result) =>
        Result.pipe(
          result,
          Result.inspect(clearLatestPersistRequest),
          Result.inspectError((e: { message: string }) => {
            notifyLatestPersistFailure(e);
          }),
        ),
      (error: unknown) => notifyLatestPersistFailure(error),
    );
  },

  theme: () => resolvePreferenceValue(getState().prefs, "theme"),
  sortUnread: () => resolvePreferenceValue(getState().prefs, "sort_unread"),
  groupBy: () => resolvePreferenceValue(getState().prefs, "group_by"),
}));
