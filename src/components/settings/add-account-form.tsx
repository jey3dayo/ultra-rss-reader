import { useCallback, useState } from "react";
import { AccountConfigForm } from "@/components/settings/account-config-form";
import type { AccountConfigFormProps } from "@/components/settings/add-account-services.types";
import { ServicePicker } from "@/components/settings/service-picker";
import type { AddAccountProviderKind } from "@/lib/account/add-account-form";

type Step = { type: "pick" } | { type: "config"; kind: AddAccountProviderKind };

export type AddAccountFormProps = {
  initialKind?: AddAccountProviderKind;
  debugState?: AccountConfigFormProps["debugState"];
};

export function AddAccountForm({ initialKind, debugState }: AddAccountFormProps = {}) {
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

  return <ServicePicker onSelect={handleSelect} />;
}
