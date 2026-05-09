import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { i18nResourceLocales, i18nResourceNamespaces, i18nResources } from "@/lib/i18n-resources";

export const supportedLanguages = i18nResourceLocales;
export type SupportedLanguage = (typeof supportedLanguages)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: i18nResources,
    fallbackLng: "en",
    defaultNS: "common",
    ns: i18nResourceNamespaces,
    interpolation: { escapeValue: false },
    detection: {
      order: ["navigator"],
      caches: [],
    },
  });

export default i18n;
