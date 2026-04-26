import { useId } from "react";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getOptionLabelByValue } from "@/lib/options";
import { cn } from "@/lib/utils";
import type { StackedSelectFieldProps } from "./stacked-field.types";

export function StackedSelectField({
  labelId,
  label,
  name,
  value,
  options,
  disabled,
  onChange,
  className,
  labelClassName,
  triggerClassName,
}: StackedSelectFieldProps) {
  const generatedLabelId = useId();
  const resolvedLabelId = labelId ?? generatedLabelId;

  return (
    <div className={cn("block text-sm text-foreground-soft", className)}>
      <span id={resolvedLabelId} className={cn("mb-1 block", labelClassName)}>
        {label}
      </span>
      <Select name={name} value={value} onValueChange={(next) => next !== null && onChange(next)} disabled={disabled}>
        <SelectTrigger aria-labelledby={resolvedLabelId} className={triggerClassName}>
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
    </div>
  );
}
