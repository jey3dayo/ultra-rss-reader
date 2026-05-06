import { useId } from "react";
import { SelectOptionItems, SelectOptionValue } from "@/components/shared/select-option-content";
import { Select, SelectPopup, SelectTrigger } from "@/components/ui/select";
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
          <SelectOptionValue options={options} />
        </SelectTrigger>
        <SelectPopup>
          <SelectOptionItems options={options} />
        </SelectPopup>
      </Select>
    </div>
  );
}
