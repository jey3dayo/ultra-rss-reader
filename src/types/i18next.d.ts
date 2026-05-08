import type { I18nDefaultResources } from "@/lib/i18n-resources";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: I18nDefaultResources;
  }
}
