import type { ComponentType } from "react";
import type { AddAccountProviderKind } from "@/lib/add-account-form";

export type ServiceKind = AddAccountProviderKind | "Fever";

export type ServiceDefinition = {
  kind: ServiceKind;
  icon: ComponentType<{ className?: string }>;
  iconBg: string;
  nameKey: string;
  descKey: string;
  disabled?: boolean;
};

export type ServiceCategory = {
  labelKey: string;
  services: ServiceDefinition[];
};

export type ServicePickerProps = {
  onSelect: (kind: AddAccountProviderKind) => void;
};

export type AccountConfigFormProps = {
  kind: AddAccountProviderKind;
  onBack: () => void;
};
