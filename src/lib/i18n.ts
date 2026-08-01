import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { registerCountFormatter } from "@/lib/i18n-count";
import {
  i18nDeferredResourceNamespaces,
  i18nResourceLocales,
  i18nResourceNamespaces,
  i18nResources,
  loadI18nResourceNamespace,
} from "@/lib/i18n-resources";

export const supportedLanguages = i18nResourceLocales;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: structuredClone(i18nResources),
    fallbackLng: "en",
    defaultNS: "common",
    ns: i18nResourceNamespaces,
    interpolation: { escapeValue: false },
    detection: {
      order: ["navigator"],
      caches: [],
    },
  });

registerCountFormatter(i18n);

function syncDocumentLanguage(language: string) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
}

syncDocumentLanguage(i18n.resolvedLanguage ?? i18n.language);
i18n.on("languageChanged", syncDocumentLanguage);

if (import.meta.env.MODE === "test") {
  await Promise.all(i18nDeferredResourceNamespaces.map((namespace) => loadI18nResourceNamespace(i18n, namespace)));
}

export default i18n;
