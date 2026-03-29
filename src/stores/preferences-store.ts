import { Result } from "@praha/byethrow";
import i18n from "i18next";
import { create } from "zustand";
import { getPreferences, setPreference } from "@/api/tauri-commands";
import { shortcutDefaults } from "@/lib/keyboard-shortcuts";
import { useUiStore } from "@/stores/ui-store";

type Theme = "light" | "dark" | "system";

const defaults: Record<string, string> = {
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
  layout: "automatic",
  theme: "dark",
  opaque_sidebars: "false",
  grayscale_favicons: "false",
  font_style: "sans_serif",
  font_size: "medium",
  show_starred_count: "true",
  show_unread_count: "true",
  image_previews: "medium",
  display_favicons: "true",
  text_preview: "true",
  dim_archived: "true",
  // Reading
  reader_view: "off",
  reading_sort: "newest_first",
  after_reading: "mark_as_read",
  scroll_to_top_on_change: "true",
  // Account-level reading preferences
  sort_subscriptions: "folders_first",
  mark_article_as_read: "mark_as_read",
  // Actions
  action_copy_link: "true",
  action_open_browser: "true",
  action_share: "true",
  // Shortcuts
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

function get(prefs: Record<string, string>, key: string): string {
  return prefs[key] ?? defaults[key] ?? "";
}

let systemThemeCleanup: (() => void) | null = null;

function applyTheme(theme: Theme): void {
  // Clean up previous system theme listener
  systemThemeCleanup?.();
  systemThemeCleanup = null;

  const root = document.documentElement;
  if (theme === "system") {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    root.classList.toggle("dark", mq.matches);
    const handler = (e: MediaQueryListEvent) => root.classList.toggle("dark", e.matches);
    mq.addEventListener("change", handler);
    systemThemeCleanup = () => mq.removeEventListener("change", handler);
  } else {
    root.classList.toggle("dark", theme === "dark");
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
  if (language === "system") {
    const detected = navigator.language.startsWith("ja") ? "ja" : "en";
    i18n.changeLanguage(detected);
  } else {
    i18n.changeLanguage(language);
  }
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
        const theme = (data.theme ?? defaults.theme) as Theme;
        applyTheme(theme);
        applyLanguage(data.language ?? defaults.language);
        applyFontStyle(data.font_style ?? defaults.font_style);
        applyFontSize(data.font_size ?? defaults.font_size);
      }),
      Result.inspectError((e) => {
        console.error("Failed to load preferences:", e);
        set({ loaded: true });
        applyTheme((defaults.theme ?? "dark") as Theme);
        applyLanguage(defaults.language);
      }),
    );
  },

  setPref: (key, value) => {
    set((state) => ({
      prefs: { ...state.prefs, [key]: value },
    }));

    if (key === "theme") {
      applyTheme(value as Theme);
    }
    if (key === "language") {
      applyLanguage(value);
    }
    if (key === "font_style") {
      applyFontStyle(value);
    }
    if (key === "font_size") {
      applyFontSize(value);
    }

    // Fire and forget — notify user on failure
    setPreference(key, value).then((result) =>
      Result.pipe(
        result,
        Result.inspectError((e: { message: string }) => {
          console.error(`Failed to persist preference ${key}:`, e);
          useUiStore.getState().showToast(i18n.t("failed_to_save_setting", { message: e.message }));
        }),
      ),
    );
  },

  theme: () => get(getState().prefs, "theme") as Theme,
  sortUnread: () => get(getState().prefs, "sort_unread"),
  groupBy: () => get(getState().prefs, "group_by"),
}));
