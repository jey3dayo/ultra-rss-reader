import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AddAccountProviderKind } from "@/lib/account/add-account-form";
import { AccountConfigForm, type AccountConfigFormProps } from "./account-config-form";
import { ServicePicker } from "./service-picker";
import { buildServicePickerCategories } from "./service-picker-categories";

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
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AccountConfigForm kind={step.kind} onBack={handleBack} debugState={debugState} />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <ServicePicker
        title={`${t("account.heading")}…`}
        categories={buildServicePickerCategories(t)}
        onSelect={handleSelect}
      />
    </div>
  );
}
