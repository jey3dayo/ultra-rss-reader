import { useId } from "react";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { SelectOptionItems, SelectOptionValue } from "@/components/shared/select-option-content";
import { Select, SelectPopup, SelectTrigger } from "@/components/ui/select";
import type { OptionWithLabel } from "@/lib/ui/options";
import { cn } from "@/lib/utils";

type LabeledSelectRowProps = {
  label: string;
  name: string;
  value: string;
  options: readonly OptionWithLabel[];
  onChange: (value: string) => void;
  disabled?: boolean;
  open?: boolean;
  rowClassName?: string;
  triggerClassName?: string;
};

type LabeledSelectRowChangeHandlerParams = {
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function createLabeledSelectRowChangeHandler({ disabled, onChange }: LabeledSelectRowChangeHandlerParams) {
  return (next: string | null) => {
    if (disabled || next === null) {
      return;
    }

    onChange(next);
  };
}

export function LabeledSelectRow({
  label,
  name,
  value,
  options,
  onChange,
  disabled,
  open,
  rowClassName,
  triggerClassName,
}: LabeledSelectRowProps) {
  const labelId = useId();
  const handleValueChange = createLabeledSelectRowChangeHandler({ disabled, onChange });

  return (
    <LabeledControlRow label={label} labelId={labelId} className={rowClassName}>
      <Select name={name} value={value} onValueChange={handleValueChange} disabled={disabled} open={open}>
        <SelectTrigger aria-labelledby={labelId} className={cn("w-full sm:w-[220px]", triggerClassName)}>
          <SelectOptionValue options={options} />
        </SelectTrigger>
        <SelectPopup>
          <SelectOptionItems options={options} />
        </SelectPopup>
      </Select>
    </LabeledControlRow>
  );
}
