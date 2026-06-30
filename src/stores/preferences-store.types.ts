import type { PreferenceRecord, PreferenceWritableKey, Theme } from "@/schemas/preference-values";

export type PreferencesState = {
  prefs: PreferenceRecord;
  loaded: boolean;
  pendingPreferenceSaves: number;
};

export type PreferencesActions = {
  loadPreferences: () => Promise<void>;
  setPref: <K extends PreferenceWritableKey>(key: K, value: string) => void;
  theme: () => Theme;
  sortUnread: () => string;
  groupBy: () => string;
};
