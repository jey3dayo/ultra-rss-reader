import { useId } from "react";
import { SelectOptionItems, SelectOptionValue } from "@/components/shared/select-option-content";
import { Select, SelectPopup, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type StackedSelectOption = {
  value: string;
  label: string;
};

type StackedSelectFieldProps = {
  labelId?: string;
  label: string;
  name: string;
  value: string;
  options: readonly StackedSelectOption[];
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
