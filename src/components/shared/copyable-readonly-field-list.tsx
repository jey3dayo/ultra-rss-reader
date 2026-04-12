import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { CopyableReadonlyField } from "./copyable-readonly-field";

export type CopyableReadonlyFieldItem = {
  key: string;
  label: string;
  name: string;
  value: string;
  disabled?: boolean;
  copyLabel?: string;
  onCopy?: () => void;
};

export function CopyableReadonlyFieldList({
  fields,
  className,
}: {
  fields: CopyableReadonlyFieldItem[];
  className?: string;
}) {
  const Wrapper = className ? "div" : Fragment;
  const wrapperProps = className ? { className: cn("space-y-3", className) } : {};

  return (
    <Wrapper {...wrapperProps}>
      {fields.map((field) => (
        <CopyableReadonlyField
          key={field.key}
          label={field.label}
          name={field.name}
          value={field.value}
          disabled={field.disabled}
          copyLabel={field.copyLabel}
          onCopy={field.onCopy}
        />
      ))}
    </Wrapper>
  );
}
