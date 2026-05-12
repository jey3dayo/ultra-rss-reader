import { describe, expect, it } from "vitest";
import enCommon from "@/locales/en/common.json";
import enReader from "@/locales/en/reader.json";
import enSettings from "@/locales/en/settings.json";
import enSidebar from "@/locales/en/sidebar.json";
import enSubscriptions from "@/locales/en/subscriptions.json";
import jaCommon from "@/locales/ja/common.json";
import jaReader from "@/locales/ja/reader.json";
import jaSettings from "@/locales/ja/settings.json";
import jaSidebar from "@/locales/ja/sidebar.json";
import jaSubscriptions from "@/locales/ja/subscriptions.json";

type LocaleValue = string | readonly string[] | LocaleTree;
type LocaleTree = { readonly [key: string]: LocaleValue };

function isStringList(value: LocaleValue): value is readonly string[] {
  return Array.isArray(value);
}

const namespaces: Record<string, { en: LocaleTree; ja: LocaleTree }> = {
  common: { en: enCommon, ja: jaCommon },
  reader: { en: enReader, ja: jaReader },
  settings: { en: enSettings, ja: jaSettings },
  sidebar: { en: enSidebar, ja: jaSidebar },
  subscriptions: { en: enSubscriptions, ja: jaSubscriptions },
};

const intentionalLocaleOnlyKeysByNamespace: Record<string, readonly string[]> = {
  common: [],
  reader: [],
  settings: [],
  sidebar: [],
  subscriptions: [],
};

function flattenLocale(tree: LocaleTree, prefix = ""): Map<string, string> {
  const entries = new Map<string, string>();

  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      entries.set(path, value);
    } else if (isStringList(value)) {
      value.forEach((item, index) => {
        entries.set(`${path}.${index}`, item);
      });
    } else {
      for (const [childPath, childValue] of flattenLocale(value, path)) {
        entries.set(childPath, childValue);
      }
    }
  }

  return entries;
}

function extractPlaceholders(value: string): string[] {
  const parsed = parseInterpolationTokens(value);
  return [...new Set(parsed.tokens.map((token) => token.name))].toSorted();
}

function extractPlaceholderSet(value: string): ReadonlySet<string> {
  return new Set(extractPlaceholders(value));
}

function formatPlaceholderSet(placeholders: ReadonlySet<string>): string {
  return [...placeholders].toSorted().join("|");
}

function areSetsEqual<T>(left: ReadonlySet<T>, right: ReadonlySet<T>): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

type InterpolationToken = {
  raw: string;
  name: string;
};

const interpolationTokenPattern = /{{\s*([^{}]*?)\s*}}/g;
const interpolationNamePattern = /^[a-zA-Z0-9_]+$/;

function parseInterpolationTokens(value: string): {
  tokens: InterpolationToken[];
  problems: string[];
} {
  const tokens: InterpolationToken[] = [];
  const problems: string[] = [];

  for (const match of value.matchAll(interpolationTokenPattern)) {
    const raw = match[0] ?? "";
    const tokenBody = (match[1] ?? "").trim();
    const name = (tokenBody.split(",", 1)[0] ?? "").trim();
    if (!interpolationNamePattern.test(name)) {
      problems.push(`invalid token ${raw}`);
      continue;
    }
    tokens.push({ raw, name });
  }

  const remainder = value.replace(interpolationTokenPattern, "");
  if (remainder.includes("{{") || remainder.includes("}}")) {
    problems.push("unbalanced interpolation braces");
  }

  return {
    tokens: tokens.toSorted((a, b) => a.raw.localeCompare(b.raw) || a.name.localeCompare(b.name)),
    problems,
  };
}

function formatRawTokens(tokens: readonly InterpolationToken[]): string {
  return tokens.map((token) => token.raw).join("|");
}

function formatPlaceholderNames(tokens: readonly InterpolationToken[]): string {
  return tokens.map((token) => token.name).join("|");
}

const pluralSuffixPattern = /_(zero|one|two|few|many|other)$/;

function collectPluralKeys(entries: Map<string, string>): string[] {
  return [...entries.keys()].filter((key) => pluralSuffixPattern.test(key)).toSorted();
}

function difference(left: Iterable<string>, right: ReadonlySet<string>): string[] {
  return [...left].filter((key) => !right.has(key)).toSorted();
}

function collectNamespaceLocaleContract(namespace: string, en: LocaleTree, ja: LocaleTree) {
  const enEntries = flattenLocale(en);
  const jaEntries = flattenLocale(ja);
  const enKeys = new Set(enEntries.keys());
  const jaKeys = new Set(jaEntries.keys());
  const localeOnlyKeys = new Set(intentionalLocaleOnlyKeysByNamespace[namespace] ?? []);
  const placeholderMismatches: string[] = [];

  for (const [key, enValue] of enEntries) {
    const jaValue = jaEntries.get(key);
    if (jaValue === undefined) {
      continue;
    }

    const enPlaceholders = extractPlaceholderSet(enValue);
    const jaPlaceholders = extractPlaceholderSet(jaValue);
    if (!areSetsEqual(enPlaceholders, jaPlaceholders)) {
      placeholderMismatches.push(
        `${key}: en=${formatPlaceholderSet(enPlaceholders)} ja=${formatPlaceholderSet(jaPlaceholders)}`,
      );
    }
  }

  return {
    missingInEn: difference(jaKeys, new Set([...enKeys, ...localeOnlyKeys])),
    missingInJa: difference(enKeys, new Set([...jaKeys, ...localeOnlyKeys])),
    placeholderMismatches: placeholderMismatches.toSorted(),
  };
}

const unresolvedLocaleKeyPattern = /^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*|\.[a-z][a-z0-9_]*)+$/;
const domainNamePattern = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

function isUnresolvedKeyLookingString(value: string): boolean {
  return unresolvedLocaleKeyPattern.test(value) && !domainNamePattern.test(value);
}

function collectLeafSanityProblems(tree: LocaleTree, namespace: string, prefix = ""): string[] {
  const problems: string[] = [];

  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const qualifiedPath = `${namespace}.${path}`;
    if (typeof value === "string") {
      if (value.length === 0) {
        problems.push(`${qualifiedPath}: empty string`);
      }
      if (value === path || value === qualifiedPath) {
        problems.push(`${qualifiedPath}: untranslated key string`);
      }
      if (isUnresolvedKeyLookingString(value)) {
        problems.push(`${qualifiedPath}: unresolved key-looking string ${value}`);
      }
      continue;
    }
    if (isStringList(value)) {
      if (value.length === 0) {
        problems.push(`${qualifiedPath}: empty array`);
      }
      value.forEach((item, index) => {
        if (item.length === 0) {
          problems.push(`${qualifiedPath}.${index}: empty string`);
        }
        if (item === `${path}.${index}` || item === `${qualifiedPath}.${index}`) {
          problems.push(`${qualifiedPath}.${index}: untranslated key string`);
        }
        if (isUnresolvedKeyLookingString(item)) {
          problems.push(`${qualifiedPath}.${index}: unresolved key-looking string ${item}`);
        }
      });
      continue;
    }

    problems.push(...collectLeafSanityProblems(value, namespace, path));
  }

  return problems;
}

const richTextAllowedTags = new Set(["strong"]);
const richTextTagPattern = /<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi;
const richTextAllowedSnippets = new Map([
  ["reader.confirm_delete_tag", "<strong>{{name}}</strong>"],
  ["reader.confirm_unsubscribe", "<strong>{{title}}</strong>"],
]);
const loadingOrProgressKeyPattern = /(^|_)(detecting|loading|opening|optimizing|saving|syncing|testing|updating)($|_)/;
const threePeriodEllipsisAllowlist = new Set<string>();

function collectRichTextTagSignature(value: string): string[] {
  return [...value.matchAll(richTextTagPattern)].map((match) => match[0] ?? "");
}

function collectRichTextProblems(entries: Map<string, string>, namespace: string): string[] {
  const problems: string[] = [];

  for (const [key, value] of entries) {
    const qualifiedKey = `${namespace}.${key}`;
    const allowedSnippet = richTextAllowedSnippets.get(qualifiedKey);
    const tagSignature = collectRichTextTagSignature(value);
    if (tagSignature.length > 0 && allowedSnippet === undefined) {
      problems.push(`${qualifiedKey}: rich text markup is not allowlisted`);
    }
    if (allowedSnippet !== undefined && !value.includes(allowedSnippet)) {
      problems.push(`${qualifiedKey}: missing allowlisted rich text snippet ${allowedSnippet}`);
    }
    if (allowedSnippet !== undefined && tagSignature.join("|") !== "<strong>|</strong>") {
      problems.push(`${qualifiedKey}: rich text markup must be exactly one strong pair`);
    }
    for (const match of value.matchAll(richTextTagPattern)) {
      const tag = match[1]?.toLowerCase();
      if (tag === undefined || !richTextAllowedTags.has(tag)) {
        problems.push(`${qualifiedKey}: disallowed rich text tag ${match[0]}`);
      }
      if (match[0]?.includes("=")) {
        problems.push(`${qualifiedKey}: rich text tag attributes are not allowed`);
      }
    }
  }

  return problems;
}

function collectRichTextLocaleMismatches(
  enEntries: Map<string, string>,
  jaEntries: Map<string, string>,
  namespace: string,
): string[] {
  const mismatches: string[] = [];
  const keys = new Set([...enEntries.keys(), ...jaEntries.keys()]);

  for (const key of [...keys].toSorted()) {
    const enValue = enEntries.get(key);
    const jaValue = jaEntries.get(key);
    if (enValue === undefined || jaValue === undefined) {
      continue;
    }

    const enSignature = collectRichTextTagSignature(enValue).join("|");
    const jaSignature = collectRichTextTagSignature(jaValue).join("|");
    if (enSignature !== jaSignature) {
      mismatches.push(`${namespace}.${key}: en=${enSignature} ja=${jaSignature}`);
    }
  }

  return mismatches;
}

describe("locale interpolation placeholders", () => {
  it("normalizes i18next format suffixes while preserving raw token shape", () => {
    expect(parseInterpolationTokens("Updated {{ date, datetime }} by {{name}}")).toEqual({
      tokens: [
        { raw: "{{ date, datetime }}", name: "date" },
        { raw: "{{name}}", name: "name" },
      ],
      problems: [],
    });
  });

  it("reports unknown interpolation tokens without accepting them as placeholders", () => {
    expect(parseInterpolationTokens("Broken {{ count + 1 }} and {{ }}")).toEqual({
      tokens: [],
      problems: ["invalid token {{ count + 1 }}", "invalid token {{ }}"],
    });
  });

  it("keeps English and Japanese interpolation placeholders in sync", () => {
    const mismatches: string[] = [];

    for (const [namespace, { en, ja }] of Object.entries(namespaces)) {
      const enEntries = flattenLocale(en);
      const jaEntries = flattenLocale(ja);

      for (const [key, enValue] of enEntries) {
        const jaValue = jaEntries.get(key);
        if (jaValue === undefined) {
          continue;
        }

        const enPlaceholders = extractPlaceholderSet(enValue);
        const jaPlaceholders = extractPlaceholderSet(jaValue);
        if (!areSetsEqual(enPlaceholders, jaPlaceholders)) {
          mismatches.push(
            `${namespace}.${key}: en=${formatPlaceholderSet(enPlaceholders)} ja=${formatPlaceholderSet(jaPlaceholders)}`,
          );
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("keeps missing-key and placeholder contracts explicit by namespace", () => {
    const contracts = Object.fromEntries(
      Object.entries(namespaces).map(([namespace, { en, ja }]) => [
        namespace,
        collectNamespaceLocaleContract(namespace, en, ja),
      ]),
    );

    expect(contracts).toEqual({
      common: { missingInEn: [], missingInJa: [], placeholderMismatches: [] },
      reader: { missingInEn: [], missingInJa: [], placeholderMismatches: [] },
      settings: { missingInEn: [], missingInJa: [], placeholderMismatches: [] },
      sidebar: { missingInEn: [], missingInJa: [], placeholderMismatches: [] },
      subscriptions: {
        missingInEn: [],
        missingInJa: [],
        placeholderMismatches: [],
      },
    });
  });

  it("keeps English and Japanese interpolation token syntax in sync", () => {
    const mismatches: string[] = [];

    for (const [namespace, { en, ja }] of Object.entries(namespaces)) {
      const enEntries = flattenLocale(en);
      const jaEntries = flattenLocale(ja);

      for (const [key, enValue] of enEntries) {
        const jaValue = jaEntries.get(key);
        if (jaValue === undefined) {
          continue;
        }

        const enParsed = parseInterpolationTokens(enValue);
        const jaParsed = parseInterpolationTokens(jaValue);
        const enRawTokens = formatRawTokens(enParsed.tokens);
        const jaRawTokens = formatRawTokens(jaParsed.tokens);
        const enPlaceholderNames = formatPlaceholderNames(enParsed.tokens);
        const jaPlaceholderNames = formatPlaceholderNames(jaParsed.tokens);

        if (
          enParsed.problems.length > 0 ||
          jaParsed.problems.length > 0 ||
          enRawTokens !== jaRawTokens ||
          enPlaceholderNames !== jaPlaceholderNames
        ) {
          mismatches.push(
            `${namespace}.${key}: enRaw=${enRawTokens} jaRaw=${jaRawTokens} enNames=${enPlaceholderNames} jaNames=${jaPlaceholderNames} enProblems=${enParsed.problems.join("|")} jaProblems=${jaParsed.problems.join("|")}`,
          );
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("keeps English and Japanese plural form keys in sync", () => {
    const mismatches: string[] = [];

    for (const [namespace, { en, ja }] of Object.entries(namespaces)) {
      const enPluralKeys = collectPluralKeys(flattenLocale(en));
      const jaPluralKeys = collectPluralKeys(flattenLocale(ja));

      if (enPluralKeys.join(",") !== jaPluralKeys.join(",")) {
        mismatches.push(`${namespace}: en=${enPluralKeys.join("|")} ja=${jaPluralKeys.join("|")}`);
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("keeps reader, web preview, and external browser copy distinct", () => {
    const enReading = enSettings.reading;
    const jaReading = jaSettings.reading;
    const enReaderShortcuts = enReader.shortcuts;
    const jaReaderShortcuts = jaReader.shortcuts;

    expect(enReader.back_to_reader).toContain("Reader");
    expect(enReader.view_in_browser).toContain("Web Preview");
    expect(enReader.open_in_external_browser.toLowerCase()).toContain("external browser");
    expect(enReader.browser_view).toBe(enReading.in_app_browser);
    expect(enReader.display_mode_preview).toBe(enReading.in_app_browser);
    expect(enReaderShortcuts.view_in_browser).toContain("Web Preview");
    expect(enReaderShortcuts.open_external_browser.toLowerCase()).toContain("external browser");
    expect(enReading.preview).toContain("Web Preview");
    expect(enReading.in_app_browser).toBe("Web Preview");
    expect(enReading.default_browser.toLowerCase()).toContain("browser");
    expect(enReading.cmd_click_browser).toContain("{{modifier}}-click");
    expect(enReading.cmd_click_browser).toContain("Web Preview");

    expect(jaReader.back_to_reader).toContain("記事");
    expect(jaReader.view_in_browser).toContain("Webプレビュー");
    expect(jaReader.open_in_external_browser).toContain("外部ブラウザ");
    expect(jaReader.browser_view).toBe(jaReading.in_app_browser);
    expect(jaReader.display_mode_preview).toBe(jaReading.in_app_browser);
    expect(jaReaderShortcuts.view_in_browser).toContain("Webプレビュー");
    expect(jaReaderShortcuts.open_external_browser).toContain("外部ブラウザ");
    expect(jaReading.preview).toContain("Webプレビュー");
    expect(jaReading.in_app_browser).toBe("Webプレビュー");
    expect(jaReading.default_browser).toContain("ブラウザ");
    expect(jaReading.cmd_click_browser).toContain("{{modifier}}クリック");
    expect(jaReading.cmd_click_browser).toContain("Webプレビュー");

    expect(enReader.view_in_browser).not.toBe(enReader.open_in_external_browser);
    expect(enReading.cmd_click_browser.toLowerCase()).not.toContain("external browser");
    expect(jaReader.view_in_browser).not.toBe(jaReader.open_in_external_browser);
    expect(jaReading.cmd_click_browser).not.toContain("外部ブラウザ");
  });

  it("keeps deleted resource no-op product copy on locale keys", () => {
    const enDeletedNoop = enReader.deleted_resource_noop;
    const jaDeletedNoop = jaReader.deleted_resource_noop;
    const enCommandPalette = enReader.command_palette;
    const jaCommandPalette = jaReader.command_palette;
    const enSettingsTags = enSettings.tags;
    const jaSettingsTags = jaSettings.tags;
    const enSettingsAccount = enSettings.account;
    const jaSettingsAccount = jaSettings.account;
    const enSettingsMute = enSettings.mute;
    const jaSettingsMute = jaSettings.mute;

    expect({
      en: {
        article: enDeletedNoop.article,
        feed: enDeletedNoop.feed,
        feedLanding: enCommandPalette.feed_landing_deleted_feed_noop,
        tag: enDeletedNoop.tag,
        settingsTag: enSettingsTags.deleted_resource_noop,
        account: enSettingsAccount.deleted_resource_noop,
        muteKeyword: enSettingsMute.deleted_resource_noop,
      },
      ja: {
        article: jaDeletedNoop.article,
        feed: jaDeletedNoop.feed,
        feedLanding: jaCommandPalette.feed_landing_deleted_feed_noop,
        tag: jaDeletedNoop.tag,
        settingsTag: jaSettingsTags.deleted_resource_noop,
        account: jaSettingsAccount.deleted_resource_noop,
        muteKeyword: jaSettingsMute.deleted_resource_noop,
      },
    }).toEqual({
      en: {
        article: "This article was already removed.",
        feed: "This feed was already removed.",
        feedLanding: "This feed was already removed.",
        tag: "This tag was already removed.",
        settingsTag: "This tag was already removed.",
        account: "This account was already removed.",
        muteKeyword: "This mute keyword was already removed.",
      },
      ja: {
        article: "この記事はすでに削除されています。",
        feed: "このフィードはすでに削除されています。",
        feedLanding: "このフィードはすでに削除されています。",
        tag: "このタグはすでに削除されています。",
        settingsTag: "このタグはすでに削除されています。",
        account: "このアカウントはすでに削除されています。",
        muteKeyword: "このミュートキーワードはすでに削除されています。",
      },
    });
  });

  it("keeps locale leaves non-empty and translated away from raw key strings", () => {
    const problems: string[] = [];

    for (const [namespace, { en, ja }] of Object.entries(namespaces)) {
      problems.push(...collectLeafSanityProblems(en, `${namespace}.en`));
      problems.push(...collectLeafSanityProblems(ja, `${namespace}.ja`));
    }

    expect(problems).toEqual([]);
  });

  it("keeps rich text locale markup on the allowlist", () => {
    const problems: string[] = [];

    for (const [namespace, { en, ja }] of Object.entries(namespaces)) {
      const enEntries = flattenLocale(en);
      const jaEntries = flattenLocale(ja);
      problems.push(...collectRichTextProblems(enEntries, namespace));
      problems.push(...collectRichTextProblems(jaEntries, namespace));
      problems.push(...collectRichTextLocaleMismatches(enEntries, jaEntries, namespace));
    }

    expect(problems).toEqual([]);
  });

  it("uses typographic ellipses for locale loading and progress copy", () => {
    const problems: string[] = [];

    for (const [namespace, { en, ja }] of Object.entries(namespaces)) {
      for (const [locale, tree] of [
        ["en", en],
        ["ja", ja],
      ] as const) {
        for (const [key, value] of flattenLocale(tree)) {
          const qualifiedKey = `${namespace}.${locale}.${key}`;
          const isLoadingOrProgressCopy = loadingOrProgressKeyPattern.test(key);
          if (isLoadingOrProgressCopy && value.includes("...") && !threePeriodEllipsisAllowlist.has(qualifiedKey)) {
            problems.push(qualifiedKey);
          }
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it("keeps three-period ellipses out of product locale strings", () => {
    const problems: string[] = [];

    for (const [namespace, { en, ja }] of Object.entries(namespaces)) {
      for (const [locale, tree] of [
        ["en", en],
        ["ja", ja],
      ] as const) {
        for (const [key, value] of flattenLocale(tree)) {
          const qualifiedKey = `${namespace}.${locale}.${key}`;
          if (value.includes("...") && !threePeriodEllipsisAllowlist.has(qualifiedKey)) {
            problems.push(qualifiedKey);
          }
        }
      }
    }

    expect(problems).toEqual([]);
  });
});
