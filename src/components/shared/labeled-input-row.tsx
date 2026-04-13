import { useId } from "react";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { Button } from "@/components/ui/button";
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
  actionLabel,
  actionAriaLabel,
  onAction,
  actionDisabled,
}: LabeledInputRowProps) {
  const inputId = useId();

  return (
    <LabeledControlRow label={label} htmlFor={inputId} className={rowClassName} labelClassName={labelClassName}>
      <div className="flex w-full items-center gap-2">
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
        {actionLabel && onAction ? (
          <Button
            type="button"
            variant="outline"
            onClick={onAction}
            disabled={actionDisabled}
            aria-label={actionAriaLabel ?? `${actionLabel}: ${label}`}
          >
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </LabeledControlRow>
  );
}
