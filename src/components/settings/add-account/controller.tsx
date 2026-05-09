import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AddAccountProviderKind } from "@/lib/account/add-account-form";
import { AccountConfigForm, type AccountConfigFormProps } from "./account-config-form";
import { ServicePicker, type ServicePickerCategory } from "./service-picker";
import { SERVICE_CATEGORIES } from "./services";
import type { ServiceCategoryLabelKey, ServiceDescriptionKey, ServiceNameKey } from "./services.types";

type Step = { type: "pick" } | { type: "config"; kind: AddAccountProviderKind };

export type AddAccountFormProps = {
  initialKind?: AddAccountProviderKind;
  debugState?: AccountConfigFormProps["debugState"];
};

export function AddAccountForm({ initialKind, debugState }: AddAccountFormProps = {}) {
  const { t } = useTranslation("settings");
  const [step, setStep] = useState<Step>(() =>
    initialKind ? { type: "config", kind: initialKind } : { type: "pick" },
  );

  const handleSelect = useCallback((kind: AddAccountProviderKind) => {
    setStep({ type: "config", kind });
  }, []);

  const handleBack = useCallback(() => {
    setStep({ type: "pick" });
  }, []);

  if (step.type === "config") {
    return <AccountConfigForm kind={step.kind} onBack={handleBack} debugState={debugState} />;
  }

  return (
    <ServicePicker
      title={`${t("account.heading")}…`}
      categories={buildServicePickerCategories(t)}
      onSelect={handleSelect}
    />
  );
}

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
