import type { PreferenceRecord, Theme } from "@/schemas/preferences";

export type PreferencesState = {
  prefs: PreferenceRecord;
  loaded: boolean;
};

export type PreferencesActions = {
  loadPreferences: () => Promise<void>;
  setPref: (key: string, value: string) => void;
  theme: () => Theme;
  sortUnread: () => string;
  groupBy: () => string;
};
