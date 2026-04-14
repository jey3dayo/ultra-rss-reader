import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import enCleanup from "@/locales/en/cleanup.json";
import enCommon from "@/locales/en/common.json";
import enReader from "@/locales/en/reader.json";
import enSettings from "@/locales/en/settings.json";
import enSidebar from "@/locales/en/sidebar.json";
import enSubscriptions from "@/locales/en/subscriptions.json";
import jaCleanup from "@/locales/ja/cleanup.json";
import jaCommon from "@/locales/ja/common.json";
import jaReader from "@/locales/ja/reader.json";
import jaSettings from "@/locales/ja/settings.json";
import jaSidebar from "@/locales/ja/sidebar.json";
import jaSubscriptions from "@/locales/ja/subscriptions.json";

export const supportedLanguages = ["en", "ja"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        cleanup: enCleanup,
        settings: enSettings,
        reader: enReader,
        sidebar: enSidebar,
        subscriptions: enSubscriptions,
      },
      ja: {
        common: jaCommon,
        cleanup: jaCleanup,
        settings: jaSettings,
        reader: jaReader,
        sidebar: jaSidebar,
        subscriptions: jaSubscriptions,
      },
    },
    fallbackLng: "en",
    defaultNS: "common",
    ns: ["common", "cleanup", "settings", "reader", "sidebar", "subscriptions"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["navigator"],
      caches: [],
    },
  });

export default i18n;
