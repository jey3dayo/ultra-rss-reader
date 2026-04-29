import { Result } from "@praha/byethrow";
import i18n from "i18next";
import { create } from "zustand";
import { getPreferences, setPreference } from "@/api/tauri-commands";
import { STORAGE_KEYS } from "@/constants/storage";
import { resolveUiLanguage } from "@/lib/ui-language";
import {
  type AfterReadingPreference,
  normalizePreferenceValue,
  parseLanguagePreference,
  parseThemePreference,
  preferenceDefaults,
  resolvePreferenceValue,
  type SortSubscriptions,
  type Theme,
} from "@/stores/preferences-schema";
import type { PreferencesActions, PreferencesState } from "@/stores/preferences-store.types";
import { useUiStore } from "@/stores/ui-store";

const objectHasOwnProperty = Object.prototype.hasOwnProperty;

const THEME_TRANSITION_CLASS = "theme-transitioning";
const THEME_TRANSITION_DURATION_MS = 240;

export type { AfterReadingPreference, SortSubscriptions, Theme };
export { preferenceDefaults, resolvePreferenceValue };

let systemThemeCleanup: (() => void) | null = null;
let themeTransitionCleanupTimeout: number | null = null;

function getSystemPrefersDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
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

function scheduleThemeTransition(root: HTMLElement): void {
  const prefersReducedMotion =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    root.classList.remove(THEME_TRANSITION_CLASS);
    return;
  }

  root.classList.add(THEME_TRANSITION_CLASS);
  if (themeTransitionCleanupTimeout !== null) {
    window.clearTimeout(themeTransitionCleanupTimeout);
  }
  themeTransitionCleanupTimeout = window.setTimeout(() => {
    root.classList.remove(THEME_TRANSITION_CLASS);
    themeTransitionCleanupTimeout = null;
  }, THEME_TRANSITION_DURATION_MS);
}

function applyResolvedTheme(root: HTMLElement, resolvedTheme: "light" | "dark", withTransition: boolean): void {
  if (withTransition) {
    scheduleThemeTransition(root);
  } else {
    root.classList.remove(THEME_TRANSITION_CLASS);
  }
  root.classList.toggle("dark", resolvedTheme === "dark");
  root.style.colorScheme = resolvedTheme;
}

function applyTheme(theme: Theme, options?: { withTransition?: boolean }): void {
  // Clean up previous system theme listener
  systemThemeCleanup?.();
  systemThemeCleanup = null;

  const root = document.documentElement;
  const withTransition = options?.withTransition ?? true;
  if (theme === "system") {
    applyResolvedTheme(root, getSystemPrefersDark() ? "dark" : "light", withTransition);
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      applyResolvedTheme(root, e.matches ? "dark" : "light", true);
    };
    mq.addEventListener("change", handler);
    systemThemeCleanup = () => mq.removeEventListener("change", handler);
  } else {
    applyResolvedTheme(root, theme === "dark" ? "dark" : "light", withTransition);
  }
}

const fontStyleClasses: Record<string, string> = {
  sans_serif: "font-sans",
  serif: "font-serif",
  monospace: "font-mono",
};

const fontSizeClasses: Record<string, string> = {
  small: "text-sm",
  medium: "text-base",
  large: "text-lg",
};

function applyFontStyle(style: string): void {
  const root = document.documentElement;
  for (const cls of Object.values(fontStyleClasses)) {
    root.classList.remove(cls);
  }
  const cls = fontStyleClasses[style] ?? fontStyleClasses.sans_serif;
  root.classList.add(cls);
}

function applyFontSize(size: string): void {
  const root = document.documentElement;
  for (const cls of Object.values(fontSizeClasses)) {
    root.classList.remove(cls);
  }
  const cls = fontSizeClasses[size] ?? fontSizeClasses.medium;
  root.classList.add(cls);
}

function applyLanguage(language: ReturnType<typeof parseLanguagePreference>): void {
  i18n.changeLanguage(resolveUiLanguage(language, navigator.language));
}

export const usePreferencesStore = create<PreferencesState & PreferencesActions>()((set, getState) => ({
  prefs: {},
  loaded: false,

  loadPreferences: async () => {
    const result = await getPreferences();
    Result.pipe(
      result,
      Result.inspect((data) => {
        set({ prefs: data, loaded: true });
        const theme = objectHasOwnProperty.call(data, "theme")
          ? resolvePreferenceValue(data, "theme")
          : (readMirroredThemePreference() ?? resolvePreferenceValue(data, "theme"));
        applyTheme(theme, { withTransition: false });
        mirrorThemePreference(theme);
        applyLanguage(resolvePreferenceValue(data, "language"));
        applyFontStyle(resolvePreferenceValue(data, "font_style"));
        applyFontSize(resolvePreferenceValue(data, "font_size"));
      }),
      Result.inspectError((e) => {
        console.error("Failed to load preferences:", e);
        set({ loaded: true });
        applyLanguage(resolvePreferenceValue({}, "language"));
      }),
    );
  },

  setPref: (key, value) => {
    const normalizedValue = normalizePreferenceValue(key, value);
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

    // Fire and forget — notify user on failure
    setPreference(key, normalizedValue).then((result) =>
      Result.pipe(
        result,
        Result.inspectError((e: { message: string }) => {
          console.error(`Failed to persist preference ${key}:`, e);
          useUiStore.getState().showToast(i18n.t("failed_to_save_setting", { message: e.message }));
        }),
      ),
    );
  },

  theme: () => resolvePreferenceValue(getState().prefs, "theme"),
  sortUnread: () => resolvePreferenceValue(getState().prefs, "sort_unread"),
  groupBy: () => resolvePreferenceValue(getState().prefs, "group_by"),
}));
