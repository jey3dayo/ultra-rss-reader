import { Copy, type LucideIcon } from "lucide-react";
import { Link } from "@/components/shared/link";
import { Button } from "@/components/ui/button";
import { AppTooltip } from "@/components/ui/tooltip";

export type FeedUrlRowProps = {
  label: string;
  value?: string;
  icon: LucideIcon;
  href?: string | null;
  copyLabel?: string;
  onCopy?: () => void;
  disabled?: boolean;
};

export function FeedUrlRow({
  label,
  value = "",
  icon: Icon,
  href,
  copyLabel,
  onCopy,
  disabled = false,
}: FeedUrlRowProps) {
  const canCopy = value.trim().length > 0;

  return (
    <div className="text-sm">
      <div className="flex min-w-0 items-center gap-1.5">
        {href ? (
          <Link variant="detail" href={href} target="_blank" rel="noreferrer" className="min-w-0">
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span className="underline decoration-border underline-offset-4">{label}</span>
          </Link>
        ) : (
          <span className="inline-flex min-w-0 items-center gap-1 text-foreground-soft">
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span>{label}</span>
          </span>
        )}
        {copyLabel && onCopy ? (
          <AppTooltip label={copyLabel}>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={copyLabel}
              className="ml-auto size-7 shrink-0 text-foreground-soft hover:text-foreground"
              onClick={onCopy}
              disabled={disabled || !canCopy}
            >
              <Copy className="size-3.5" aria-hidden="true" />
            </Button>
          </AppTooltip>
        ) : null}
      </div>
      {canCopy ? (
        <div className="mt-1 min-w-0 pl-5">
          <span className="break-all text-xs leading-5 text-foreground-soft">{value}</span>
        </div>
      ) : null}
    </div>
  );
}
