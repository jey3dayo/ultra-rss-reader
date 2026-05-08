import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enCommon from "@/locales/en/common.json";
import enReader from "@/locales/en/reader.json";
import enSettings from "@/locales/en/settings.json";
import enSidebar from "@/locales/en/sidebar.json";
import enSubscriptions from "@/locales/en/subscriptions.json";

export const testI18nResourceNamespaces = ["common", "settings", "reader", "sidebar", "subscriptions"] as const;

i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: enCommon,
      settings: enSettings,
      reader: enReader,
      sidebar: enSidebar,
      subscriptions: enSubscriptions,
    },
  },
  lng: "en",
  fallbackLng: "en",
  defaultNS: "common",
  ns: testI18nResourceNamespaces,
  interpolation: { escapeValue: false },
});

export default i18n;
