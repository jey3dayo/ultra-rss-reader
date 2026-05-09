import { useId } from "react";
import { SelectOptionItems, SelectOptionValue } from "@/components/shared/select-option-content";
import { Select, SelectPopup, SelectTrigger } from "@/components/ui/select";
import type { OptionWithLabel } from "@/lib/ui/options";
import { cn } from "@/lib/utils";

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

type StackedSelectFieldChangeHandlerParams = {
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function createStackedSelectFieldChangeHandler({ disabled, onChange }: StackedSelectFieldChangeHandlerParams) {
  return (next: string | null) => {
    if (disabled || next === null) {
      return;
    }

    onChange(next);
  };
}

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
  const handleValueChange = createStackedSelectFieldChangeHandler({ disabled, onChange });

  return (
    <div className={cn("block text-sm text-foreground-soft", className)}>
      <span id={resolvedLabelId} className={cn("mb-1 block", labelClassName)}>
        {label}
      </span>
      <Select name={name} value={value} onValueChange={handleValueChange} disabled={disabled}>
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
