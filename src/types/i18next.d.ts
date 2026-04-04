import type enCommon from "@/locales/en/common.json";
import type enCleanup from "@/locales/en/cleanup.json";
import type enReader from "@/locales/en/reader.json";
import type enSettings from "@/locales/en/settings.json";
import type enSidebar from "@/locales/en/sidebar.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: typeof enCommon;
      cleanup: typeof enCleanup;
      settings: typeof enSettings;
      reader: typeof enReader;
      sidebar: typeof enSidebar;
    };
  }
}
