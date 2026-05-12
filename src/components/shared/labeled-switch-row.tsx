import { GradientSwitch } from "@/components/shared/gradient-switch";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";

type LabeledSwitchRowProps = {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  rowClassName?: string;
  labelClassName?: string;
};

export function LabeledSwitchRow({
  label,
  description,
  checked,
  onChange,
  disabled,
  rowClassName,
  labelClassName,
}: LabeledSwitchRowProps) {
  return (
    <LabeledControlRow label={label} description={description} className={rowClassName} labelClassName={labelClassName}>
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
