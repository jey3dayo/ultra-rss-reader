import { useId } from "react";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { SelectOptionItems, SelectOptionValue } from "@/components/shared/select-option-content";
import { Select, SelectPopup, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type LabeledSelectOption = {
  value: string;
  label: string;
};

type LabeledSelectRowProps = {
  label: string;
  name: string;
  value: string;
  options: LabeledSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  open?: boolean;
  rowClassName?: string;
  triggerClassName?: string;
};

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

  return (
    <LabeledControlRow label={label} labelId={labelId} className={rowClassName}>
      <Select
        name={name}
        value={value}
        onValueChange={(next) => next !== null && onChange(next)}
        disabled={disabled}
        open={open}
      >
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
