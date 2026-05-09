import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppTooltip } from "@/components/ui/tooltip";

type CopyableTextFieldType = "text" | "url" | "password";

type CopyableTextFieldProps = {
  label: string;
  name: string;
  value: string;
  copyLabel?: string;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  type?: CopyableTextFieldType;
  onCopy?: (value: string) => void;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
};

export function CopyableTextField({
  label,
  name,
  value,
  copyLabel,
  disabled = false,
  readOnly = false,
  placeholder,
  className,
  type = "text",
  onCopy,
  onChange,
  onBlur,
  onFocus,
}: CopyableTextFieldProps) {
  const canCopy = value.trim().length > 0;

  return (
    <div className="block text-sm text-foreground-soft">
      <span className="mb-1 block text-foreground-soft">{label}</span>
      <div className="relative">
        <Input
          name={name}
          type={type}
          value={value}
          readOnly={readOnly}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={label}
          className={copyLabel && onCopy ? `pr-11 ${className ?? ""}`.trim() : className}
          onChange={(event) => onChange?.(event.target.value)}
          onBlur={() => onBlur?.()}
          onFocus={(event) => {
            if (readOnly) {
              event.currentTarget.select();
            }
            onFocus?.();
          }}
        />
        {copyLabel && onCopy ? (
          <AppTooltip label={copyLabel}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onPointerDown={(event) => event.preventDefault()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onCopy(value)}
              disabled={disabled || !canCopy}
              aria-label={copyLabel}
              className="absolute top-1/2 right-1 -translate-y-1/2 text-foreground-soft transition-colors duration-200 hover:text-foreground active:not-aria-[haspopup]:-translate-y-1/2 motion-reduce:transition-none"
            >
              <Copy className="size-3.5" />
            </Button>
          </AppTooltip>
        ) : null}
      </div>
    </div>
  );
}
