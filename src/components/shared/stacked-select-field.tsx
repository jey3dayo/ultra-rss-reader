import { useId } from "react";
import { SelectOptionItems, SelectOptionValue } from "@/components/shared/select-option-content";
import { createSelectValueChangeHandler } from "@/components/shared/select-value-change-handler";
import { Select, SelectTrigger } from "@/components/ui/select";
import type { OptionWithLabel } from "@/lib/ui/options";
import { cn } from "@/lib/utils";
import { AppSelectPopup } from "./app-select-popup";

type StackedSelectFieldProps = {
  labelId?: string;
  label: string;
  name: string;
  value: string;
  options: readonly OptionWithLabel[];
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
  labelClassName?: string;
  triggerClassName?: string;
};

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
  const handleValueChange = createSelectValueChangeHandler({ disabled, onChange });

  return (
    <div className={cn("block text-sm text-foreground-soft", className)}>
      <span id={resolvedLabelId} className={cn("mb-1 block", labelClassName)}>
        {label}
      </span>
      <Select name={name} value={value} onValueChange={handleValueChange} disabled={disabled}>
        <SelectTrigger aria-labelledby={resolvedLabelId} className={cn("min-h-11", triggerClassName)}>
          <SelectOptionValue options={options} />
        </SelectTrigger>
        <AppSelectPopup>
          <SelectOptionItems options={options} />
        </AppSelectPopup>
      </Select>
    </div>
  );
}
