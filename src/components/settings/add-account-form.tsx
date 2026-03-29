import { useCallback, useState } from "react";
import { AccountConfigForm } from "@/components/settings/account-config-form";
import { ServicePicker } from "@/components/settings/service-picker";
import type { AddAccountProviderKind } from "@/lib/add-account-form";

type Step = { type: "pick" } | { type: "config"; kind: AddAccountProviderKind };

export function AddAccountForm() {
  const [step, setStep] = useState<Step>({ type: "pick" });

  const handleSelect = useCallback((kind: AddAccountProviderKind) => {
    setStep({ type: "config", kind });
  }, []);

  const handleBack = useCallback(() => {
    setStep({ type: "pick" });
  }, []);

  if (step.type === "config") {
    return <AccountConfigForm kind={step.kind} onBack={handleBack} />;
  }

  return <ServicePicker onSelect={handleSelect} />;
}
