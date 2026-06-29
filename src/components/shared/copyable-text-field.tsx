import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
      <div className={cn("flex min-w-0 items-center", copyLabel && onCopy ? "gap-2" : undefined)}>
        <Input
          name={name}
          type={type}
          value={value}
          readOnly={readOnly}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={label}
          className={cn("min-w-0 flex-1", className)}
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
              className="size-9 shrink-0 border-transparent bg-transparent text-foreground-soft shadow-none transition-colors duration-200 hover:bg-transparent hover:text-foreground motion-reduce:transition-none"
            >
              <Copy className="size-3.5" />
            </Button>
          </AppTooltip>
        ) : null}
      </div>
    </div>
  );
}
