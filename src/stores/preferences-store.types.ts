import type { Theme } from "@/stores/preferences-schema";

export interface PreferencesState {
  prefs: Record<string, string>;
  loaded: boolean;
}

export interface PreferencesActions {
  loadPreferences: () => Promise<void>;
  setPref: (key: string, value: string) => void;
  theme: () => Theme;
  sortUnread: () => string;
  groupBy: () => string;
}
