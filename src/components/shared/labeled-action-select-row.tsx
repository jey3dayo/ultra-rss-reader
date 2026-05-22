import type { ReactNode } from "react";
import { useId } from "react";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { SelectOptionItems, SelectOptionValue } from "@/components/shared/select-option-content";
import { Select, SelectTrigger } from "@/components/ui/select";
import type { OptionWithLabel } from "@/lib/ui/options";
import { cn } from "@/lib/utils";
import { AppSelectPopup } from "./app-select-popup";

type LabeledActionSelectRowProps = {
  label: string;
  value: string;
  options: readonly OptionWithLabel[];
  onValueChange: (value: string | null) => void;
  name?: string;
  disabled?: boolean;
  selectAriaLabel?: string;
  rowClassName?: string;
  labelClassName?: string;
  controlClassName?: string;
  triggerClassName?: string;
  trailingControls?: ReactNode;
};

type ActionSelectControlProps = {
  label: string;
  value: string;
  options: readonly OptionWithLabel[];
  onValueChange: (value: string | null) => void;
  name?: string;
  disabled?: boolean;
  ariaLabel?: string;
  labelId?: string;
  triggerClassName?: string;
};

export function ActionSelectControl({
  label,
  value,
  options,
  onValueChange,
  name,
  disabled,
  ariaLabel,
  labelId,
  triggerClassName,
}: ActionSelectControlProps) {
  return (
    <Select name={name} value={value} onValueChange={(nextValue) => onValueChange(nextValue)} disabled={disabled}>
      <SelectTrigger
        aria-label={ariaLabel ?? (labelId ? undefined : label)}
        aria-labelledby={ariaLabel ? undefined : labelId}
        className={cn("h-10 w-full sm:flex-1", triggerClassName)}
      >
        <SelectOptionValue options={options} />
      </SelectTrigger>
      <AppSelectPopup>
        <SelectOptionItems options={options} />
      </AppSelectPopup>
    </Select>
  );
}

export function LabeledActionSelectRow({
  label,
  value,
  options,
  onValueChange,
  name,
  disabled,
  selectAriaLabel,
  rowClassName,
  labelClassName,
  controlClassName,
  triggerClassName,
  trailingControls,
}: LabeledActionSelectRowProps) {
  const labelId = useId();

  return (
    <LabeledControlRow label={label} labelId={labelId} className={rowClassName} labelClassName={labelClassName}>
      <div
        className={cn(
          "flex w-full flex-col gap-2 sm:max-w-[30rem] sm:flex-row sm:items-center sm:justify-end",
          controlClassName,
        )}
      >
        <ActionSelectControl
          label={label}
          labelId={labelId}
          name={name}
          ariaLabel={selectAriaLabel}
          value={value}
          options={options}
          onValueChange={onValueChange}
          disabled={disabled}
          triggerClassName={triggerClassName}
        />
        {trailingControls}
      </div>
    </LabeledControlRow>
  );
}
