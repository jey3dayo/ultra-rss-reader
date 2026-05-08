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

export const i18nResourceNamespaces = ["common", "settings", "reader", "sidebar", "subscriptions"] as const;

export const i18nResources = {
  en: {
    common: enCommon,
    settings: enSettings,
    reader: enReader,
    sidebar: enSidebar,
    subscriptions: enSubscriptions,
  },
  ja: {
    common: jaCommon,
    settings: jaSettings,
    reader: jaReader,
    sidebar: jaSidebar,
    subscriptions: jaSubscriptions,
  },
} as const;

export type I18nResourceNamespace = (typeof i18nResourceNamespaces)[number];
export type I18nDefaultResources = (typeof i18nResources)["en"];
