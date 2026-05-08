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

type LocaleValue = string | LocaleTree;
type LocaleTree = { readonly [key: string]: LocaleValue };

const namespaces: Record<string, { en: LocaleTree; ja: LocaleTree }> = {
  common: { en: enCommon, ja: jaCommon },
  reader: { en: enReader, ja: jaReader },
  settings: { en: enSettings, ja: jaSettings },
  sidebar: { en: enSidebar, ja: jaSidebar },
  subscriptions: { en: enSubscriptions, ja: jaSubscriptions },
};

function flattenLocale(tree: LocaleTree, prefix = ""): Map<string, string> {
  const entries = new Map<string, string>();

  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      entries.set(path, value);
    } else {
      for (const [childPath, childValue] of flattenLocale(value, path)) {
        entries.set(childPath, childValue);
      }
    }
  }

  return entries;
}

function extractPlaceholders(value: string): string[] {
  return [...new Set([...value.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)].map((match) => match[1] ?? ""))]
    .filter(Boolean)
    .sort();
}

const pluralSuffixPattern = /_(zero|one|two|few|many|other)$/;

function collectPluralKeys(entries: Map<string, string>): string[] {
  return [...entries.keys()].filter((key) => pluralSuffixPattern.test(key)).sort();
}

describe("locale interpolation placeholders", () => {
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

        const enPlaceholders = extractPlaceholders(enValue);
        const jaPlaceholders = extractPlaceholders(jaValue);
        if (enPlaceholders.join(",") !== jaPlaceholders.join(",")) {
          mismatches.push(`${namespace}.${key}: en=${enPlaceholders.join("|")} ja=${jaPlaceholders.join("|")}`);
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
});
