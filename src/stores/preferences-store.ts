import { Result } from "@praha/byethrow";
import i18n from "i18next";
import { z } from "zod";
import { create } from "zustand";
import { getPreferences, setPreference } from "@/api/tauri-commands";
import { STORAGE_KEYS } from "@/constants/storage";
import { shortcutDefaults } from "@/lib/keyboard-shortcuts";
import { resolveUiLanguage } from "@/lib/ui-language";
import { useUiStore } from "@/stores/ui-store";

const themeSchema = z.enum(["light", "dark", "system"]);
const languageSchema = z.enum(["system", "en", "ja"]);
const unreadBadgeSchema = z.enum(["dont_display", "all_unread", "only_inbox"]);
const openLinksSchema = z.enum(["in_app", "default_browser"]);
const booleanStringSchema = z.enum(["true", "false"]);
const sortOrderSchema = z.enum(["newest_first", "oldest_first"]);
const groupBySchema = z.enum(["date", "feed", "none"]);
const listSelectionStyleSchema = z.enum(["modern", "classic"]);
const sidebarDensitySchema = z.enum(["compact", "normal", "spacious"]);
const layoutSchema = z.enum(["automatic", "wide", "compact"]);
const fontStyleSchema = z.enum(["sans_serif", "serif", "monospace"]);
const fontSizeSchema = z.enum(["small", "medium", "large"]);
const imagePreviewsSchema = z.enum(["off", "small", "medium", "large"]);
const afterReadingSchema = z.enum(["mark_as_read", "do_nothing", "archive"]);
const sortSubscriptionsSchema = z.enum(["folders_first", "alphabetical", "newest_first", "oldest_first"]);
const startupFolderExpansionSchema = z.enum(["all_collapsed", "unread_folders", "restore_previous"]);
const persistedBooleanPreferenceSchema = z.enum(["true", "false"]);
const freeformStringSchema = z.string();

export type Theme = z.infer<typeof themeSchema>;
export type SortSubscriptions = z.infer<typeof sortSubscriptionsSchema>;

const preferenceSchemas = {
  language: languageSchema,
  unread_badge: unreadBadgeSchema,
  open_links: openLinksSchema,
  open_links_background: booleanStringSchema,
  sort_unread: sortOrderSchema,
  group_by: groupBySchema,
  cmd_click_browser: booleanStringSchema,
  ask_before_mark_all: booleanStringSchema,
  list_selection_style: listSelectionStyleSchema,
  sidebar_density: sidebarDensitySchema,
  layout: layoutSchema,
  theme: themeSchema,
  opaque_sidebars: booleanStringSchema,
  grayscale_favicons: booleanStringSchema,
  font_style: fontStyleSchema,
  font_size: fontSizeSchema,
  show_starred_count: booleanStringSchema,
  show_unread_count: booleanStringSchema,
  show_sidebar_unread: booleanStringSchema,
  show_sidebar_starred: booleanStringSchema,
  show_sidebar_tags: booleanStringSchema,
  startup_folder_expansion: startupFolderExpansionSchema,
  image_previews: imagePreviewsSchema,
  display_favicons: booleanStringSchema,
  text_preview: booleanStringSchema,
  dim_archived: booleanStringSchema,
  reader_mode_default: persistedBooleanPreferenceSchema,
  web_preview_mode_default: persistedBooleanPreferenceSchema,
  reading_sort: sortOrderSchema,
  after_reading: afterReadingSchema,
  scroll_to_top_on_change: booleanStringSchema,
  sort_subscriptions: sortSubscriptionsSchema,
  sync_on_startup: persistedBooleanPreferenceSchema,
  action_copy_link: booleanStringSchema,
  action_open_browser: booleanStringSchema,
  inoreader_app_id: freeformStringSchema,
  inoreader_app_key: freeformStringSchema,
  debug_browser_hud: booleanStringSchema,
  debug_web_preview_url: freeformStringSchema,
  mute_auto_mark_read: booleanStringSchema,
} as const;

type KnownPreferenceKey = keyof typeof preferenceSchemas;
type PreferenceValue<K extends KnownPreferenceKey> = z.output<(typeof preferenceSchemas)[K]>;
const objectHasOwnProperty = Object.prototype.hasOwnProperty;

const corePreferenceDefaults = {
  // General
  language: "system",
  unread_badge: "dont_display",
  open_links: "in_app",
  open_links_background: "false",
  sort_unread: "newest_first",
  group_by: "date",
  cmd_click_browser: "false",
  ask_before_mark_all: "true",
  // Appearance
  list_selection_style: "modern",
  sidebar_density: "normal",
  layout: "automatic",
  theme: "light",
  opaque_sidebars: "false",
  grayscale_favicons: "false",
  font_style: "sans_serif",
  font_size: "medium",
  show_starred_count: "true",
  show_unread_count: "true",
  show_sidebar_unread: "true",
  show_sidebar_starred: "true",
  show_sidebar_tags: "true",
  startup_folder_expansion: "all_collapsed",
  image_previews: "medium",
  display_favicons: "true",
  text_preview: "true",
  dim_archived: "true",
  // Reading
  reader_mode_default: "true",
  web_preview_mode_default: "false",
  reading_sort: "newest_first",
  after_reading: "mark_as_read",
  scroll_to_top_on_change: "true",
  // Account-level reading preferences
  sort_subscriptions: "folders_first",
  sync_on_startup: "true",
  // Actions
  action_copy_link: "true",
  action_open_browser: "true",
  inoreader_app_id: "",
  inoreader_app_key: "",
  // Debug
  debug_browser_hud: "false",
  debug_web_preview_url: "",
  mute_auto_mark_read: "false",
} satisfies { [K in KnownPreferenceKey]: z.input<(typeof preferenceSchemas)[K]> };

export const preferenceDefaults: Record<string, string> = {
  ...corePreferenceDefaults,
  ...shortcutDefaults,
};

interface PreferencesState {
  prefs: Record<string, string>;
  loaded: boolean;
}

interface PreferencesActions {
  loadPreferences: () => Promise<void>;
  setPref: (key: string, value: string) => void;
  theme: () => Theme;
  sortUnread: () => string;
  groupBy: () => string;
}

const THEME_TRANSITION_CLASS = "theme-transitioning";
const THEME_TRANSITION_DURATION_MS = 180;

function isKnownPreferenceKey(key: string): key is KnownPreferenceKey {
  return objectHasOwnProperty.call(preferenceSchemas, key);
}

function parsePreferenceValue<K extends KnownPreferenceKey>(key: K, value: string): PreferenceValue<K> | null {
  const schema = preferenceSchemas[key] as (typeof preferenceSchemas)[K];
  const result = schema.safeParse(value);
  return result.success ? (result.data as PreferenceValue<K>) : null;
}

function normalizePreferenceValue<K extends KnownPreferenceKey>(key: K, value: string): PreferenceValue<K>;
function normalizePreferenceValue(key: string, value: string): string;
function normalizePreferenceValue(key: string, value: string): string {
  if (!isKnownPreferenceKey(key)) {
    return value;
  }

  const parsedValue = parsePreferenceValue(key, value);
  if (parsedValue !== null) {
    return parsedValue;
  }

  const parsedDefault = parsePreferenceValue(key, corePreferenceDefaults[key]);
  return parsedDefault ?? "";
}

export function resolvePreferenceValue<K extends KnownPreferenceKey>(
  prefs: Record<string, string>,
  key: K,
): PreferenceValue<K>;
export function resolvePreferenceValue(prefs: Record<string, string>, key: string): string;
export function resolvePreferenceValue(prefs: Record<string, string>, key: string): string {
  return normalizePreferenceValue(key, prefs[key] ?? preferenceDefaults[key] ?? "");
}

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

function applyLanguage(language: string): void {
  i18n.changeLanguage(resolveUiLanguage(language as "system" | "ja" | "en", navigator.language));
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
        const theme = resolvePreferenceValue(data, "theme");
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
      applyLanguage(normalizedValue);
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

  theme: () => resolvePreferenceValue(getState().prefs, "theme") as Theme,
  sortUnread: () => resolvePreferenceValue(getState().prefs, "sort_unread"),
  groupBy: () => resolvePreferenceValue(getState().prefs, "group_by"),
}));
