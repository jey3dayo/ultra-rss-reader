import type { TFunction } from "i18next";
import type { KnownPreferenceKey } from "@/schemas/preferences";

export type SettingsPreferenceViewPropsParams = {
  t: TFunction<"settings">;
  prefs: Record<string, string>;
  setPref: <K extends KnownPreferenceKey>(key: K, value: string) => void;
};
