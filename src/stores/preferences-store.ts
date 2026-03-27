import { Result } from "@praha/byethrow";
import { create } from "zustand";
import { getPreferences, setPreference } from "@/api/tauri-commands";

type Theme = "light" | "dark" | "system";

const defaults: Record<string, string> = {
  // General
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
  show_all_count: "true",
  image_previews: "medium",
  display_favicons: "true",
  text_preview: "true",
  dim_archived: "true",
  // Reading
  reader_view: "off",
  reading_sort: "newest_first",
  after_reading: "mark_as_read",
  scroll_to_top_on_change: "true",
  // Actions
  action_copy_link: "true",
  action_open_browser: "true",
  action_share: "false",
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
      }),
      Result.inspectError((e) => {
        console.error("Failed to load preferences:", e);
        set({ loaded: true });
        applyTheme((defaults.theme ?? "dark") as Theme);
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

    // Fire and forget — log errors but don't block UI
    setPreference(key, value).then((result) =>
      Result.pipe(
        result,
        Result.inspectError((e) => console.error(`Failed to persist preference ${key}:`, e)),
      ),
    );
  },

  theme: () => get(getState().prefs, "theme") as Theme,
  sortUnread: () => get(getState().prefs, "sort_unread"),
  groupBy: () => get(getState().prefs, "group_by"),
}));
