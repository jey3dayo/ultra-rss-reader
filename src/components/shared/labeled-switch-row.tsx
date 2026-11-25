import type { ReactNode } from "react";
import { GradientSwitch } from "@/components/shared/gradient-switch";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";

type LabeledSwitchRowProps = {
  label: string;
  description?: string;
  descriptionPlacement?: "column" | "below";
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  rowClassName?: string;
  labelClassName?: string;
  labelAccessory?: ReactNode;
};

export function LabeledSwitchRow({
  label,
  description,
  descriptionPlacement,
  checked,
  onChange,
  disabled,
  rowClassName,
  labelClassName,
  labelAccessory,
}: LabeledSwitchRowProps) {
  return (
    <LabeledControlRow
      label={label}
      description={description}
      descriptionPlacement={descriptionPlacement}
      className={rowClassName}
      labelClassName={labelClassName}
      labelAccessory={labelAccessory}
    >
      {({ descriptionId }) => (
        <GradientSwitch
          checked={checked}
          onCheckedChange={(nextChecked) => onChange(nextChecked)}
          disabled={disabled}
          aria-label={label}
          aria-describedby={descriptionId}
        />
      )}
    </LabeledControlRow>
  );
}
