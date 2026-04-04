import { CopyableTextField } from "@/components/shared/copyable-text-field";

export function CopyableReadonlyField({
  label,
  name,
  value,
  copyLabel,
  disabled = false,
  onCopy,
}: {
  label: string;
  name: string;
  value: string;
  copyLabel?: string;
  disabled?: boolean;
  onCopy?: () => void;
}) {
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
