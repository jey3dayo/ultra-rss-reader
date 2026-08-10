import { useId } from "react";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { SelectOptionItems, SelectOptionValue } from "@/components/shared/select-option-content";
import { createSelectValueChangeHandler } from "@/components/shared/select-value-change-handler";
import { Select, SelectTrigger } from "@/components/ui/select";
import type { OptionWithLabel } from "@/lib/ui/options";
import { cn } from "@/lib/utils";
import { AppSelectPopup } from "./app-select-popup";

export type LabeledSelectRowProps = {
  labelId?: string;
  label: string;
  name: string;
  value: string;
  options: readonly OptionWithLabel[];
  onChange: (value: string) => void;
  disabled?: boolean;
  open?: boolean;
  rowClassName?: string;
  labelClassName?: string;
  triggerClassName?: string;
  popupClassName?: string;
};

export function LabeledSelectRow({
  labelId,
  label,
  name,
  value,
  options,
  onChange,
  disabled,
  open,
  rowClassName,
  labelClassName,
  triggerClassName,
  popupClassName,
}: LabeledSelectRowProps) {
  const generatedLabelId = useId();
  const resolvedLabelId = labelId ?? generatedLabelId;
  const handleValueChange = createSelectValueChangeHandler({
    disabled,
    onChange,
  });

  return (
    <LabeledControlRow
      label={label}
      labelId={resolvedLabelId}
      className={rowClassName}
      labelClassName={cn("whitespace-nowrap", labelClassName)}
    >
      <Select name={name} value={value} onValueChange={handleValueChange} disabled={disabled} open={open}>
        <SelectTrigger aria-labelledby={resolvedLabelId} className={cn("w-full sm:w-[220px]", triggerClassName)}>
          <SelectOptionValue options={options} />
        </SelectTrigger>
        <AppSelectPopup className={popupClassName}>
          <SelectOptionItems options={options} />
        </AppSelectPopup>
      </Select>
    </LabeledControlRow>
  );
}
