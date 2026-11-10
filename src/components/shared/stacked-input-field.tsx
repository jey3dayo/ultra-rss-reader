import { cn } from "cn";
import { type RefObject, useId } from "react";
import { Input } from "@/components/ui/input";

type StackedInputFieldProps = {
  label: string;
  name?: string;
  type?: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  onChange: (value: string) => void;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
};

export function StackedInputField({
  label,
  name,
  type,
  value,
  placeholder,
  disabled,
  inputRef,
  ariaInvalid,
  ariaDescribedBy,
  onChange,
  className,
  labelClassName,
  inputClassName,
}: StackedInputFieldProps) {
  const inputId = useId();

  return (
    <label htmlFor={inputId} className={cn("block text-sm text-foreground-soft", className)}>
      <span className={labelClassName}>{label}</span>
      <Input
        id={inputId}
        ref={inputRef}
        name={name}
        type={type}
        value={value}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn("min-h-11", inputClassName)}
        disabled={disabled}
      />
    </label>
  );
}
