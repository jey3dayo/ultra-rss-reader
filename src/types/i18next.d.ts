import type enCommon from "@/locales/en/common.json";
import type enReader from "@/locales/en/reader.json";
import type enSettings from "@/locales/en/settings.json";
import type enSidebar from "@/locales/en/sidebar.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: typeof enCommon;
      settings: typeof enSettings;
      reader: typeof enReader;
      sidebar: typeof enSidebar;
    };
  }
}
