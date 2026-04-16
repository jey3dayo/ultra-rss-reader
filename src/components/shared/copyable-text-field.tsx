import { Copy } from "lucide-react";
import type { CopyableTextFieldProps } from "@/components/shared/copyable-field.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppTooltip } from "@/components/ui/tooltip";

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
              onMouseDown={(event) => event.preventDefault()}
              onClick={onCopy}
              disabled={disabled || !value}
              aria-label={copyLabel}
              className="absolute top-1/2 right-1 -translate-y-1/2 text-foreground-soft transition-colors duration-200 hover:text-foreground active:not-aria-[haspopup]:-translate-y-1/2"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </AppTooltip>
        ) : null}
      </div>
    </div>
  );
}
