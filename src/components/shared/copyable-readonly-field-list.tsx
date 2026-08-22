import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { CopyableReadonlyField, type CopyableReadonlyFieldProps } from "./copyable-readonly-field";

export type CopyableReadonlyFieldItem = CopyableReadonlyFieldProps & {
  key: string;
};

type CopyableReadonlyFieldListProps = {
  fields: CopyableReadonlyFieldItem[];
  className?: string;
};

export function CopyableReadonlyFieldList({ fields, className }: CopyableReadonlyFieldListProps) {
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
