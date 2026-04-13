import type { CopyableReadonlyFieldProps } from "@/components/shared/copyable-field.types";
import { CopyableTextField } from "@/components/shared/copyable-text-field";

export function CopyableReadonlyField({
  label,
  name,
  value,
  copyLabel,
  disabled = false,
  onCopy,
}: CopyableReadonlyFieldProps) {
  return (
    <CopyableTextField
      label={label}
      name={name}
      value={value}
      copyLabel={copyLabel}
      disabled={disabled}
      readOnly
      onCopy={onCopy}
    />
  );
}
