import { describe, expect, it } from "vitest";
import { supportedLanguages } from "@/lib/i18n";
import i18nSource from "@/lib/i18n.ts?raw";
import { i18nResourceFiles, i18nResourceLocales, i18nResourceNamespaces, i18nResources } from "@/lib/i18n-resources";
import type { ShortcutCategoryKey, ShortcutLabelKey } from "@/lib/keyboard/keyboard-shortcuts";
import { shortcutDefinitions } from "@/lib/keyboard/keyboard-shortcuts";
import { uiLanguagePreferences } from "@/lib/ui/ui-language";
import enReader from "@/locales/en/reader.json";
import enSettings from "@/locales/en/settings.json";
import jaReader from "@/locales/ja/reader.json";
import jaSettings from "@/locales/ja/settings.json";
import i18nextTypesSource from "@/types/i18next.d.ts?raw";

type LocaleLeaf = string | readonly string[];
type LocaleNode = LocaleLeaf | { readonly [key: string]: LocaleNode };
type ShortcutLocaleKey = ShortcutLabelKey | ShortcutCategoryKey;

function isLocaleObject(value: LocaleNode): value is { readonly [key: string]: LocaleNode } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function flattenLocaleKeys(value: LocaleNode, prefix = ""): string[] {
  if (typeof value === "string") {
    return [prefix];
  }

  if (Array.isArray(value)) {
    return value.map((_, index) => `${prefix}.${index}`);
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return isLocaleObject(child) || Array.isArray(child) || typeof child === "string"
      ? flattenLocaleKeys(child, path)
      : [];
  });
}

function missingKeys(referenceKeys: readonly string[], candidateKeys: readonly string[]) {
  const candidateKeySet = new Set(candidateKeys);
  return referenceKeys.filter((key) => !candidateKeySet.has(key));
}

const readerBrowserMeaningKeys = [
  ["reader", "view_in_browser"],
  ["reader", "open_in_external_browser"],
  ["reader", "browser_view"],
  ["reader", "back_to_reader"],
  ["reader", "display_mode_standard"],
  ["reader", "display_mode_preview"],
  ["reader", "shortcuts.view_in_browser"],
  ["reader", "shortcuts.open_external_browser"],
  ["settings", "reading.standard"],
  ["settings", "reading.preview"],
  ["settings", "reading.in_app_browser"],
  ["settings", "reading.default_browser"],
  ["settings", "reading.cmd_click_browser"],
] as const;

const meaningLocaleResources = {
  en: {
    reader: enReader,
    settings: enSettings,
  },
  ja: {
    reader: jaReader,
    settings: jaSettings,
  },
} as const;

const readerBrowserMeaningCopy = {
  en: {
    previewAction: "Open Web Preview",
    externalBrowserAction: "Open in External Browser",
    readerDisplayMode: "Article text only",
    previewDisplayMode: "Article text + Web Preview",
    inAppBrowserTarget: "Web Preview",
    externalBrowserTarget: "Default browser",
    cmdClickPreviewAction: "{{modifier}}-click opens Web Preview",
  },
  ja: {
    previewAction: "Webプレビューを開く",
    externalBrowserAction: "外部ブラウザで開く",
    readerDisplayMode: "本文のみ",
    previewDisplayMode: "本文 + Webプレビュー",
    inAppBrowserTarget: "Webプレビュー",
    externalBrowserTarget: "既定のブラウザ",
    cmdClickPreviewAction: "{{modifier}}クリックでWebプレビューを開く",
  },
} as const;

const localeResourceFilePaths = Object.keys(
  import.meta.glob<LocaleNode>("/src/locales/{en,ja}/*.json", { eager: true }),
);

function localeResourceBasenamesByLocale() {
  const basenamesByLocale = new Map<string, string[]>();

  for (const path of localeResourceFilePaths) {
    const match = /^\/src\/locales\/(?<locale>en|ja)\/(?<basename>[^/]+)\.json$/.exec(path);

    if (!match?.groups) {
      continue;
    }

    const basenames = basenamesByLocale.get(match.groups.locale) ?? [];
    basenames.push(match.groups.basename);
    basenamesByLocale.set(match.groups.locale, basenames);
  }

  return Object.fromEntries([...basenamesByLocale].map(([locale, basenames]) => [locale, basenames.sort()]));
}

describe("i18next locale contract", () => {
  it("keeps supported runtime languages aligned with locale resources and UI preferences", () => {
    const explicitUiLanguagePreferences = uiLanguagePreferences.filter((preference) => preference !== "system");

    expect([...supportedLanguages]).toEqual([...i18nResourceLocales]);
    expect(explicitUiLanguagePreferences).toEqual([...supportedLanguages]);
  });

  it("keeps runtime and type namespace sources aligned", () => {
    const namespaces = [...i18nResourceNamespaces];

    expect(Object.keys(i18nResources)).toEqual([...i18nResourceLocales]);
    expect(Object.keys(i18nResources.en)).toEqual(namespaces);
    expect(Object.keys(i18nResources.ja)).toEqual(namespaces);
    expect(i18nResourceFiles.map((file) => `${file.locale}/${file.namespace}`)).toEqual(
      i18nResourceLocales.flatMap((locale) => i18nResourceNamespaces.map((namespace) => `${locale}/${namespace}`)),
    );
    expect(i18nResourceFiles.map((file) => file.resourcePath)).toEqual(
      i18nResourceLocales.flatMap((locale) =>
        i18nResourceNamespaces.map((namespace) => `@/locales/${locale}/${namespace}.json`),
      ),
    );
    expect(i18nSource).toContain("ns: i18nResourceNamespaces");
    expect(i18nSource).toContain("resources: i18nResources");
    expect(i18nextTypesSource).toContain('import type { I18nDefaultResources } from "@/lib/i18n-resources"');
    expect(i18nextTypesSource).toContain("resources: I18nDefaultResources");
  });

  it("keeps resource namespace maps aligned with locale JSON file inventory", () => {
    const namespaces = [...i18nResourceNamespaces].sort();
    const basenamesByLocale = localeResourceBasenamesByLocale();

    expect(Object.keys(basenamesByLocale).sort()).toEqual([...i18nResourceLocales].sort());

    for (const locale of i18nResourceLocales) {
      expect(Object.keys(i18nResources[locale]).sort()).toEqual(namespaces);
      expect(basenamesByLocale[locale]).toEqual(namespaces);
    }
  });

  it("keeps locale keys aligned across supported locales", () => {
    const missingByLocale: string[] = [];

    for (const namespace of i18nResourceNamespaces) {
      const enKeys = flattenLocaleKeys(i18nResources.en[namespace]);
      const jaKeys = flattenLocaleKeys(i18nResources.ja[namespace]);

      missingByLocale.push(...missingKeys(enKeys, jaKeys).map((key) => `ja:${namespace}.${key}`));
      missingByLocale.push(...missingKeys(jaKeys, enKeys).map((key) => `en:${namespace}.${key}`));
    }

    expect(missingByLocale).toEqual([]);
  });

  it("keeps shortcut definition locale keys covered without orphan reader shortcut labels", () => {
    const expectedShortcutKeys: ReadonlySet<string> = new Set<ShortcutLocaleKey>(
      shortcutDefinitions.flatMap((definition): ShortcutLocaleKey[] => [definition.labelKey, definition.categoryKey]),
    );
    const failures: string[] = [];

    for (const locale of ["en", "ja"] as const) {
      const readerKeys = flattenLocaleKeys(meaningLocaleResources[locale].reader);
      const readerKeySet = new Set(readerKeys);
      const readerShortcutKeys = readerKeys.filter((key) => key.startsWith("shortcuts."));

      for (const key of expectedShortcutKeys) {
        if (!readerKeySet.has(key)) {
          failures.push(`${locale}:missing:${key}`);
        }
      }

      for (const key of readerShortcutKeys) {
        if (key === "shortcuts.open_shortcuts_help") {
          continue;
        }
        if (!expectedShortcutKeys.has(key)) {
          failures.push(`${locale}:orphan:${key}`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it("keeps reader, web preview, and external browser meaning keys available", () => {
    const missingMeaningKeys: string[] = [];

    for (const locale of ["en", "ja"] as const) {
      const keysByNamespace = new Map(
        (["reader", "settings"] as const).map((namespace) => [
          namespace,
          new Set(flattenLocaleKeys(meaningLocaleResources[locale][namespace])),
        ]),
      );

      for (const [namespace, key] of readerBrowserMeaningKeys) {
        if (!keysByNamespace.get(namespace)?.has(key)) {
          missingMeaningKeys.push(`${locale}:${namespace}.${key}`);
        }
      }
    }

    expect(missingMeaningKeys).toEqual([]);
  });

  it("keeps reader, web preview, and external browser meaning copy aligned by locale", () => {
    for (const locale of ["en", "ja"] as const) {
      const { reader, settings } = meaningLocaleResources[locale];
      const expected = readerBrowserMeaningCopy[locale];

      expect({
        previewAction: reader.view_in_browser,
        externalBrowserAction: reader.open_in_external_browser,
        readerDisplayMode: settings.reading.standard,
        previewDisplayMode: settings.reading.preview,
        inAppBrowserTarget: settings.reading.in_app_browser,
        externalBrowserTarget: settings.reading.default_browser,
        cmdClickPreviewAction: settings.reading.cmd_click_browser,
      }).toEqual(expected);
      expect(reader.browser_view).toBe(settings.reading.in_app_browser);
      expect(reader.display_mode_preview).toBe(settings.reading.in_app_browser);
      expect(reader.open_in_browser).toBe(reader.view_in_browser);
      expect(reader.shortcuts.view_in_browser).toBe(reader.view_in_browser);
      expect(reader.shortcuts.open_external_browser.toLowerCase()).toBe(reader.open_in_external_browser.toLowerCase());
      expect(settings.debug.browser).toBe(settings.reading.in_app_browser);
    }
  });

  it("keeps planned account provider status localized", () => {
    expect(enSettings.account.coming_soon).toBe("Coming soon");
    expect(jaSettings.account.coming_soon).toBe("準備中");
  });
});
