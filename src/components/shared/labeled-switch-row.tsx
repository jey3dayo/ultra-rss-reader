import { GradientSwitch } from "@/components/shared/gradient-switch";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";

type LabeledSwitchRowProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  rowClassName?: string;
};

export function LabeledSwitchRow({ label, checked, onChange, disabled, rowClassName }: LabeledSwitchRowProps) {
  return (
    <LabeledControlRow label={label} className={rowClassName}>
      <GradientSwitch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
    </LabeledControlRow>
  );
}
