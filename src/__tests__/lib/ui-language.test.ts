import { describe, expect, it } from "vitest";
import { supportedLanguages } from "@/lib/i18n";
import { resolveUiLanguage } from "@/lib/ui/ui-language";
import enReader from "@/locales/en/reader.json";
import enSettings from "@/locales/en/settings.json";
import jaReader from "@/locales/ja/reader.json";
import jaSettings from "@/locales/ja/settings.json";

const browserMeaningCopyByLanguage = {
  en: {
    previewAction: enReader.view_in_browser,
    externalBrowserAction: enReader.open_in_external_browser,
    readerDisplayMode: enSettings.reading.standard,
    previewDisplayMode: enSettings.reading.preview,
    inAppBrowserTarget: enSettings.reading.in_app_browser,
    externalBrowserTarget: enSettings.reading.default_browser,
  },
  ja: {
    previewAction: jaReader.view_in_browser,
    externalBrowserAction: jaReader.open_in_external_browser,
    readerDisplayMode: jaSettings.reading.standard,
    previewDisplayMode: jaSettings.reading.preview,
    inAppBrowserTarget: jaSettings.reading.in_app_browser,
    externalBrowserTarget: jaSettings.reading.default_browser,
  },
} as const;

describe("resolveUiLanguage", () => {
  it.each([
    ["system", "ja-JP", "ja"],
    ["system", "JA", "ja"],
    ["system", "fr-FR", "en"],
    ["system", "", "en"],
    ["ja", "en-US", "ja"],
    ["en", "ja-JP", "en"],
  ] as const)("matches the native menu resolver fixture %#", (preference, locale, expected) => {
    expect(resolveUiLanguage(preference, locale)).toBe(expected);
  });

  it("resolves system to Japanese for ja locales", () => {
    expect(resolveUiLanguage("system", "ja-JP")).toBe("ja");
    expect(resolveUiLanguage("system", "JA")).toBe("ja");
  });

  it("resolves system to English for non-ja locales", () => {
    expect(resolveUiLanguage("system", "en-US")).toBe("en");
    expect(resolveUiLanguage("system", "fr-FR")).toBe("en");
  });

  it("resolves system to English when the system locale is unavailable", () => {
    expect(resolveUiLanguage("system", undefined)).toBe("en");
    expect(resolveUiLanguage("system", "")).toBe("en");
  });

  it.each([
    ["ja-JP", "ja"],
    ["en-US", "en"],
    [undefined, "en"],
    ["unknown", "en"],
  ] as const)("resolves system preference from locale prefix %#", (locale, expected) => {
    expect(resolveUiLanguage("system", locale)).toBe(expected);
  });

  it("keeps explicit Japanese regardless of system locale", () => {
    expect(resolveUiLanguage("ja", "en-US")).toBe("ja");
  });

  it("keeps explicit English regardless of system locale", () => {
    expect(resolveUiLanguage("en", "ja-JP")).toBe("en");
  });

  it("keeps explicit UI language preferences aligned with supported i18n languages", () => {
    for (const language of supportedLanguages) {
      expect(resolveUiLanguage(language, "ja-JP")).toBe(language);
      expect(resolveUiLanguage(language, "en-US")).toBe(language);
    }
  });

  it.each([
    ["system", "ja-JP", browserMeaningCopyByLanguage.ja],
    ["system", "en-US", browserMeaningCopyByLanguage.en],
    ["ja", "en-US", browserMeaningCopyByLanguage.ja],
    ["en", "ja-JP", browserMeaningCopyByLanguage.en],
  ] as const)("keeps reader and browser meaning copy tied to resolved language %#", (preference, locale, copy) => {
    const language = resolveUiLanguage(preference, locale);

    expect(copy).toBe(browserMeaningCopyByLanguage[language]);
    expect(copy).toMatchObject({
      previewAction: language === "ja" ? "Webプレビューを開く" : "Open Web Preview",
      externalBrowserAction: language === "ja" ? "外部ブラウザで開く" : "Open in External Browser",
      readerDisplayMode: language === "ja" ? "本文のみ" : "Article text only",
      previewDisplayMode: language === "ja" ? "本文 + Webプレビュー" : "Article text + Web Preview",
      inAppBrowserTarget: language === "ja" ? "Webプレビュー" : "Web Preview",
      externalBrowserTarget: language === "ja" ? "既定のブラウザ" : "Default browser",
    });
    expect(copy.previewAction).not.toBe(copy.externalBrowserAction);
    expect(copy.readerDisplayMode).not.toBe(copy.previewDisplayMode);
    expect(copy.inAppBrowserTarget).not.toBe(copy.externalBrowserTarget);
  });
});
