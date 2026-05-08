export type UiLanguagePreference = "system" | "ja" | "en";
export type ResolvedUiLanguage = "ja" | "en";

export function resolveUiLanguage(preference: UiLanguagePreference, locale: string | undefined): ResolvedUiLanguage {
  if (preference === "ja" || preference === "en") {
    return preference;
  }

  return locale?.toLowerCase().startsWith("ja") ? "ja" : "en";
}
