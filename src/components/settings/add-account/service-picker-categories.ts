import type { ServicePickerCategory } from "./service-picker";
import type { ServiceCategoryLabelKey, ServiceDescriptionKey, ServiceNameKey } from "./services";
import { SERVICE_CATEGORIES } from "./services";

type ServicePickerTranslationKey =
  | ServiceCategoryLabelKey
  | ServiceNameKey
  | ServiceDescriptionKey
  | "account.coming_soon";

type SettingsTranslator = (key: ServicePickerTranslationKey) => string;

export function buildServicePickerCategories(t: SettingsTranslator): ServicePickerCategory[] {
  return SERVICE_CATEGORIES.map((category) => ({
    id: category.labelKey,
    label: t(category.labelKey),
    services: category.services.map((service) => {
      if (service.disabled) {
        return {
          kind: service.kind,
          icon: service.icon,
          iconBg: service.iconBg,
          name: t(service.nameKey),
          description: t(service.descKey),
          disabled: true,
          disabledLabel: t("account.coming_soon"),
        };
      }

      return {
        kind: service.kind,
        icon: service.icon,
        iconBg: service.iconBg,
        name: t(service.nameKey),
        description: t(service.descKey),
      };
    }),
  }));
}
