import { Fragment } from "react";
import type {
  CopyableReadonlyFieldItem,
  CopyableReadonlyFieldListProps,
} from "@/components/shared/copyable-field.types";
import { cn } from "@/lib/utils";
import { CopyableReadonlyField } from "./copyable-readonly-field";

export type { CopyableReadonlyFieldItem };

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
