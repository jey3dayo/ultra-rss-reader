import { CopyableTextField } from "@/components/shared/copyable-text-field";

type CopyableReadonlyFieldProps = {
  label: string;
  name: string;
  value: string;
  copyLabel?: string;
  disabled?: boolean;
  onCopy?: () => void;
};

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
