import { describe, expect, it } from "vitest";
import i18n, { supportedLanguages } from "@/lib/i18n";
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

const componentAndLibSourceFiles = import.meta.glob<string>("/src/{components,hooks,lib}/**/*.{ts,tsx}", {
  eager: true,
  import: "default",
  query: "?raw",
});

function isLocaleObject(value: LocaleNode | undefined): value is { readonly [key: string]: LocaleNode } {
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

const interpolationTokenPattern = /{{\s*([^{}]*?)\s*}}/g;
const interpolationNamePattern = /^[a-zA-Z0-9_]+$/;

function extractInterpolationVariables(value: string): string[] {
  const variables = new Set<string>();

  for (const match of value.matchAll(interpolationTokenPattern)) {
    const name = ((match[1] ?? "").trim().split(",", 1)[0] ?? "").trim();
    if (interpolationNamePattern.test(name)) {
      variables.add(name);
    }
  }

  return [...variables].toSorted();
}

function getLocaleValue(resource: LocaleNode, keyPath: string): LocaleNode | undefined {
  return keyPath.split(".").reduce<LocaleNode | undefined>((current, segment) => {
    if (!isLocaleObject(current)) {
      return undefined;
    }
    return current[segment];
  }, resource);
}

function hasLocaleKey(namespace: (typeof i18nResourceNamespaces)[number], key: string): boolean {
  return (
    getLocaleValue(i18nResources.en[namespace], key) !== undefined ||
    getLocaleValue(i18nResources.en[namespace], `${key}_one`) !== undefined ||
    getLocaleValue(i18nResources.en[namespace], `${key}_other`) !== undefined
  );
}

const namespaceAliasPattern =
  /const\s*\{\s*t(?:\s*:\s*(?<alias>[A-Za-z_$][\w$]*))?\s*(?:,[^}]*)?\}\s*=\s*useTranslation\(\s*(?:"(?<double>[^"]+)"|'(?<single>[^']+)')?\s*\)/g;
const staticTranslationCallPattern =
  /\b(?<callee>[A-Za-z_$][\w$]*(?:\.t)?)\(\s*(?:"(?<double>[^"]+)"|'(?<single>[^']+)')/g;
const staticTranslationArrayCallPattern =
  /\b(?<callee>[A-Za-z_$][\w$]*(?:\.t)?)\(\s*\[\s*(?:"(?<double>[^"]+)"|'(?<single>[^']+)')/g;

function collectStaticTranslationKeyProblems(filePath: string, source: string): string[] {
  const namespacesByCallee = new Map<string, string>([["i18n.t", "common"]]);
  const problems: string[] = [];

  for (const match of source.matchAll(namespaceAliasPattern)) {
    const alias = match.groups?.alias ?? "t";
    const namespace = match.groups?.double ?? match.groups?.single ?? "common";
    namespacesByCallee.set(alias, namespace);
  }

  for (const pattern of [staticTranslationCallPattern, staticTranslationArrayCallPattern]) {
    for (const match of source.matchAll(pattern)) {
      const callee = match.groups?.callee;
      const rawKey = match.groups?.double ?? match.groups?.single;
      if (callee === undefined || rawKey === undefined) {
        continue;
      }

      const defaultNamespace = namespacesByCallee.get(callee);
      if (defaultNamespace === undefined) {
        continue;
      }

      const [namespace, key] = rawKey.includes(":") ? rawKey.split(":", 2) : [defaultNamespace, rawKey];
      if (!i18nResourceNamespaces.includes(namespace as (typeof i18nResourceNamespaces)[number])) {
        problems.push(`${filePath}: unknown namespace ${namespace} for ${rawKey}`);
        continue;
      }

      if (!hasLocaleKey(namespace as (typeof i18nResourceNamespaces)[number], key)) {
        problems.push(`${filePath}: missing ${namespace}.${key}`);
      }
    }
  }

  return problems.toSorted();
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

  return Object.fromEntries([...basenamesByLocale].map(([locale, basenames]) => [locale, basenames.toSorted()]));
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
    const namespaces = [...i18nResourceNamespaces].toSorted();
    const basenamesByLocale = localeResourceBasenamesByLocale();

    expect(Object.keys(basenamesByLocale).toSorted()).toEqual([...i18nResourceLocales].toSorted());

    for (const locale of i18nResourceLocales) {
      expect(Object.keys(i18nResources[locale]).toSorted()).toEqual(namespaces);
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

  it("keeps interpolation variable names aligned across supported locales", () => {
    const mismatches: string[] = [];

    for (const namespace of i18nResourceNamespaces) {
      const enKeys = flattenLocaleKeys(i18nResources.en[namespace]);
      const jaKeys = flattenLocaleKeys(i18nResources.ja[namespace]);
      const localeKeys = new Set([...enKeys, ...jaKeys]);

      for (const key of [...localeKeys].toSorted()) {
        const enValue = getLocaleValue(i18nResources.en[namespace], key);
        const jaValue = getLocaleValue(i18nResources.ja[namespace], key);
        if (typeof enValue !== "string" || typeof jaValue !== "string") {
          continue;
        }

        const enVariables = extractInterpolationVariables(enValue);
        const jaVariables = extractInterpolationVariables(jaValue);
        if (enVariables.join("|") !== jaVariables.join("|")) {
          mismatches.push(`${namespace}.${key}: en=${enVariables.join("|")} ja=${jaVariables.join("|")}`);
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("keeps static component translation calls backed by locale resource keys", () => {
    const problems = Object.entries(componentAndLibSourceFiles).flatMap(([filePath, source]) =>
      collectStaticTranslationKeyProblems(filePath, source),
    );

    expect(problems).toEqual([]);
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

  it("keeps plural count display keys resolving instead of falling back to locale keys", async () => {
    const pluralCountCases = [
      {
        key: "subscriptions:summary_total_caption",
        en: { one: "1 feed in this workspace", other: "2 feeds in this workspace" },
        ja: { one: "このワークスペースで 1 件の購読", other: "このワークスペースで 2 件の購読" },
      },
      {
        key: "subscriptions:summary_review_caption",
        en: { one: "1 feed needs a decision", other: "2 feeds need a decision" },
        ja: { one: "1 件が判断待ちです", other: "2 件が判断待ちです" },
      },
      {
        key: "subscriptions:summary_stale_caption",
        en: { one: "1 feed has gone quiet", other: "2 feeds have gone quiet" },
        ja: { one: "1 件が長く止まっています", other: "2 件が長く止まっています" },
      },
    ] as const;

    for (const locale of ["en", "ja"] as const) {
      await i18n.changeLanguage(locale);

      for (const { key, en, ja } of pluralCountCases) {
        const expected = locale === "en" ? en : ja;

        expect(i18n.t(key, { count: 1 })).toBe(expected.one);
        expect(i18n.t(key, { count: 2 })).toBe(expected.other);
        expect(i18n.t(key, { count: 2 })).not.toBe(key);
      }
    }
  });
});
