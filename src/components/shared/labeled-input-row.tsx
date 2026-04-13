import { useId } from "react";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { Input } from "@/components/ui/input";

type LabeledInputRowProps = {
  label: string;
  name?: string;
  type?: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  rowClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
};

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
