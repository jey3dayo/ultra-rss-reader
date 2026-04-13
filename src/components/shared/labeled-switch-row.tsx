import { GradientSwitch } from "@/components/shared/gradient-switch";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import type { LabeledSwitchRowProps } from "./form-row.types";

export function LabeledSwitchRow({ label, checked, onChange, disabled, rowClassName }: LabeledSwitchRowProps) {
  return (
    <LabeledControlRow label={label} className={rowClassName}>
      <GradientSwitch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
    </LabeledControlRow>
  );
}
