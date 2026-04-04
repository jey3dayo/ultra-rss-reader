import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppTooltip } from "@/components/ui/tooltip";

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
    <div className="block text-sm text-muted-foreground">
      <span className="mb-1 block">{label}</span>
      <div className="relative">
        <Input
          name={name}
          type="text"
          value={value}
          readOnly
          disabled={disabled}
          aria-label={label}
          className={copyLabel && onCopy ? "pr-11" : undefined}
          onFocus={(event) => event.currentTarget.select()}
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
              className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground transition-colors duration-200 hover:text-foreground active:not-aria-[haspopup]:-translate-y-1/2"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </AppTooltip>
        ) : null}
      </div>
    </div>
  );
}
