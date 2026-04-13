import { useId } from "react";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type StackedSelectOption = {
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

function getOptionLabel(options: readonly StackedSelectOption[], value: string | null) {
  return options.find((option) => option.value === (value ?? ""))?.label ?? value ?? "";
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

  return (
    <div className={cn("block text-sm text-muted-foreground", className)}>
      <span id={resolvedLabelId} className={cn("mb-1 block", labelClassName)}>
        {label}
      </span>
      <Select name={name} value={value} onValueChange={(next) => next !== null && onChange(next)} disabled={disabled}>
        <SelectTrigger aria-labelledby={resolvedLabelId} className={triggerClassName}>
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
    </div>
  );
}
