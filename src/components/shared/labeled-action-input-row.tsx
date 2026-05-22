import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useId } from "react";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type LabeledActionInputRowProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  name?: string;
  inputId?: string;
  placeholder?: string;
  disabled?: boolean;
  rowClassName?: string;
  labelClassName?: string;
  controlClassName?: string;
  inputClassName?: string;
  trailingControls?: ReactNode;
  formProps?: Omit<ComponentPropsWithoutRef<"form">, "className" | "children"> & {
    "data-testid"?: string;
  };
};

export function LabeledActionInputRow({
  label,
  value,
  onChange,
  name,
  inputId,
  placeholder,
  disabled,
  rowClassName,
  labelClassName,
  controlClassName,
  inputClassName,
  trailingControls,
  formProps,
}: LabeledActionInputRowProps) {
  const generatedInputId = useId();
  const resolvedInputId = inputId ?? generatedInputId;
  const controlClassNames = cn("flex w-full items-center gap-2 sm:max-w-[30rem] sm:justify-end", controlClassName);
  const controlContent = (
    <>
      <Input
        id={resolvedInputId}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={label}
        className={cn("h-10 flex-1", inputClassName)}
      />
      {trailingControls}
    </>
  );

  return (
    <LabeledControlRow label={label} htmlFor={resolvedInputId} className={rowClassName} labelClassName={labelClassName}>
      {formProps ? (
        <form {...formProps} className={controlClassNames}>
          {controlContent}
        </form>
      ) : (
        <div className={controlClassNames}>{controlContent}</div>
      )}
    </LabeledControlRow>
  );
}
