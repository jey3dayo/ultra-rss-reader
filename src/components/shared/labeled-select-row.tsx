import { useId } from "react";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { LabeledSelectOption, LabeledSelectRowProps } from "./form-row.types";

function getOptionLabel(options: LabeledSelectOption[], value: string | null) {
  return options.find((option) => option.value === (value ?? ""))?.label ?? value ?? "";
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

  return (
    <LabeledControlRow label={label} labelId={labelId} className={rowClassName}>
      <Select
        name={name}
        value={value}
        onValueChange={(next) => next !== null && onChange(next)}
        disabled={disabled}
        open={open}
      >
        <SelectTrigger aria-labelledby={labelId} className={cn("w-full sm:w-auto", triggerClassName)}>
          <SelectValue>{(selectedValue: string | null) => getOptionLabel(options, selectedValue)}</SelectValue>
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
