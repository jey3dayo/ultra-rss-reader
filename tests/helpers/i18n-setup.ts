import type { Resource } from "i18next";
import i18n from "i18next";
import { initReactI18next, setI18n } from "react-i18next";
import { beforeEach } from "vitest";
import { formatI18nInterpolation, registerCountFormatter } from "@/lib/i18n-count";
import { i18nResourceNamespaces, i18nResources } from "@/lib/i18n-resources";

export const testI18nResourceNamespaces = i18nResourceNamespaces;
const testI18nDefaultLanguage = "en";

function throwTestI18nMissingKey(key: string): never {
  throw new Error(`Missing i18n key in test runtime: ${key}`);
}

function createTestI18nResources(): Resource {
  return {
    en: structuredClone(i18nResources.en),
    ja: structuredClone(i18nResources.ja),
  };
}

function createTestI18nOptions() {
  return {
    resources: createTestI18nResources(),
    lng: testI18nDefaultLanguage,
    fallbackLng: testI18nDefaultLanguage,
    defaultNS: "common",
    ns: testI18nResourceNamespaces,
    interpolation: { escapeValue: false, format: formatI18nInterpolation },
    parseMissingKeyHandler: throwTestI18nMissingKey,
  } as const;
}

const testI18nReady = i18n.use(initReactI18next).init(createTestI18nOptions());
registerCountFormatter(i18n);

export async function resetTestI18nState() {
  await testI18nReady;
  await i18n.init(createTestI18nOptions());
  registerCountFormatter(i18n);
  setI18n(i18n);
}

beforeEach(async () => {
  await resetTestI18nState();
});

export default i18n;
