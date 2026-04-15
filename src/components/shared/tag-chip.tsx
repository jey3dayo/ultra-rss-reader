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
        "group/tag-chip inline-flex min-h-6 items-center gap-1.5 rounded-full border border-border/38 bg-transparent px-2.5 text-[12px] leading-none text-foreground/86",
        className,
      )}
    >
      {color ? (
        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      ) : null}
      <span className="truncate">{label}</span>
      {onRemove && removeLabel ? (
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground/60 opacity-0 transition-[opacity,color,background-color] group-hover/tag-chip:opacity-100 group-focus-within/tag-chip:opacity-100 hover:bg-muted/45 hover:text-foreground focus-visible:opacity-100"
          aria-label={removeLabel}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}
