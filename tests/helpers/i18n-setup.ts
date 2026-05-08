import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { i18nResourceNamespaces, i18nResources } from "@/lib/i18n-resources";

export const testI18nResourceNamespaces = i18nResourceNamespaces;

i18n.use(initReactI18next).init({
  resources: {
    en: i18nResources.en,
  },
  lng: "en",
  fallbackLng: "en",
  defaultNS: "common",
  ns: testI18nResourceNamespaces,
  interpolation: { escapeValue: false },
});

export default i18n;
