import { useId } from "react";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getOptionLabelByValue } from "@/lib/options";
import { cn } from "@/lib/utils";
import type { LabeledSelectRowProps } from "./form-row.types";

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
          <SelectValue>{(selectedValue: string | null) => getOptionLabelByValue(options, selectedValue)}</SelectValue>
        </SelectTrigger>
        <SelectPopup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </LabeledControlRow>
  );
}
