import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type TagChipProps = {
  label: string;
  color?: string | null;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
};

export function TagChip({ label, color, onRemove, removeLabel, className }: TagChipProps) {
  return (
    <span
      className={cn(
        "group/tag-chip inline-flex min-h-7 items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-3 text-[13px] leading-none text-foreground/92",
        className,
      )}
    >
      {color ? (
        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      ) : null}
      <span className="truncate">{label}</span>
      {onRemove && removeLabel ? (
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground/70 opacity-0 transition-[opacity,color,background-color] group-hover/tag-chip:opacity-100 group-focus-within/tag-chip:opacity-100 hover:bg-muted/70 hover:text-foreground focus-visible:opacity-100"
          aria-label={removeLabel}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}
