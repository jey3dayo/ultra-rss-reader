import { describe, expect, it } from "vitest";
import i18nSource from "@/lib/i18n.ts?raw";
import { i18nResourceNamespaces, i18nResources } from "@/lib/i18n-resources";
import i18nextTypesSource from "@/types/i18next.d.ts?raw";

type LocaleLeaf = string | readonly string[];
type LocaleNode = LocaleLeaf | { readonly [key: string]: LocaleNode };

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

describe("i18next locale contract", () => {
  it("keeps runtime and type namespace sources aligned", () => {
    const namespaces = [...i18nResourceNamespaces];

    expect(Object.keys(i18nResources.en)).toEqual(namespaces);
    expect(Object.keys(i18nResources.ja)).toEqual(namespaces);
    expect(i18nSource).toContain("ns: i18nResourceNamespaces");
    expect(i18nSource).toContain("resources: i18nResources");
    expect(i18nextTypesSource).toContain('import type { I18nDefaultResources } from "@/lib/i18n-resources"');
    expect(i18nextTypesSource).toContain("resources: I18nDefaultResources");
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
});
