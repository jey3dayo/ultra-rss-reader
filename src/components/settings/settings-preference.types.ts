import type { TFunction } from "i18next";
import type { PreferenceSchemaKey } from "@/schemas/preferences";

export type SettingsPreferenceSetPref = <K extends PreferenceSchemaKey>(key: K, value: string) => void;

export type SettingsPreferenceViewPropsParams = {
  t: TFunction<"settings">;
  prefs: Record<string, string>;
  setPref: SettingsPreferenceSetPref;
};
