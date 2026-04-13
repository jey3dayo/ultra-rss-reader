import { useId } from "react";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { Input } from "@/components/ui/input";
import type { LabeledInputRowProps } from "./form-row.types";

export function LabeledInputRow({
  label,
  name,
  type,
  value,
  placeholder,
  disabled,
  onChange,
  onBlur,
  onFocus,
  rowClassName,
  labelClassName,
  inputClassName,
}: LabeledInputRowProps) {
  const inputId = useId();

  return (
    <LabeledControlRow label={label} htmlFor={inputId} className={rowClassName} labelClassName={labelClassName}>
      <Input
        id={inputId}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        onFocus={onFocus}
        placeholder={placeholder}
        className={inputClassName}
        disabled={disabled}
      />
    </LabeledControlRow>
  );
}
