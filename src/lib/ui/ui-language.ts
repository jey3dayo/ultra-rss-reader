import { i18nResourceLocales } from "@/lib/i18n-resources";

export const uiLanguagePreferences = ["system", ...i18nResourceLocales] as const;
export type UiLanguagePreference = (typeof uiLanguagePreferences)[number];
export type ResolvedUiLanguage = (typeof i18nResourceLocales)[number];

function isSupportedLanguage(preference: UiLanguagePreference): preference is ResolvedUiLanguage {
  return i18nResourceLocales.some((language) => language === preference);
}

export function resolveUiLanguage(preference: UiLanguagePreference, locale: string | undefined): ResolvedUiLanguage {
  if (isSupportedLanguage(preference)) {
    return preference;
  }

  return locale?.toLowerCase().startsWith("ja") ? "ja" : "en";
}
