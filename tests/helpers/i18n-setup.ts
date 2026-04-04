import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enCleanup from "@/locales/en/cleanup.json";
import enCommon from "@/locales/en/common.json";
import enReader from "@/locales/en/reader.json";
import enSettings from "@/locales/en/settings.json";
import enSidebar from "@/locales/en/sidebar.json";

i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, cleanup: enCleanup, settings: enSettings, reader: enReader, sidebar: enSidebar },
  },
  lng: "en",
  fallbackLng: "en",
  defaultNS: "common",
  ns: ["common", "cleanup", "settings", "reader", "sidebar"],
  interpolation: { escapeValue: false },
});

export default i18n;
