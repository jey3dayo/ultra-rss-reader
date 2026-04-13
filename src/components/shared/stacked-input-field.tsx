import { useId } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { StackedInputFieldProps } from "./stacked-field.types";

export function StackedInputField({
  label,
  name,
  type,
  value,
  placeholder,
  disabled,
  inputRef,
  onChange,
  className,
  labelClassName,
  inputClassName,
}: StackedInputFieldProps) {
  const inputId = useId();

  return (
    <label htmlFor={inputId} className={cn("block text-sm text-muted-foreground", className)}>
      <span className={labelClassName}>{label}</span>
      <Input
        id={inputId}
        ref={inputRef}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={inputClassName}
        disabled={disabled}
      />
    </label>
  );
}
